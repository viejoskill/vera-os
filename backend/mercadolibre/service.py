"""Mercado Libre (API real). OAuth 2.0 (authorization code + refresh) para operar en
nombre de la cuenta vendedor de Varela, y publicar/actualizar/finalizar avisos.
El Client Secret vive solo acá (backend). Tokens y estado en Mongo."""
from __future__ import annotations

import asyncio
import logging
import secrets
from datetime import datetime, timedelta, timezone

import httpx
from motor.motor_asyncio import AsyncIOMotorClient

import config

logger = logging.getLogger("vera")

_client: AsyncIOMotorClient | None = None


def _db():
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(config.MONGO_URL)
    return _client[config.DB_NAME]


def _now() -> datetime:
    return datetime.now(timezone.utc)


# --- OAuth ---------------------------------------------------------------- #
async def build_auth_url(origin: str) -> str:
    state = secrets.token_urlsafe(24)
    redirect_uri = f"{origin.rstrip('/')}/api/ml/callback"
    await _db()["ml_oauth_states"].insert_one(
        {"_id": state, "redirect_uri": redirect_uri, "created_at": _now()}
    )
    return (
        f"{config.MELI_AUTH_HOST}/authorization?response_type=code"
        f"&client_id={config.MELI_APP_ID}&redirect_uri={redirect_uri}&state={state}"
    )


async def exchange_code(code: str, state: str) -> str:
    st = await _db()["ml_oauth_states"].find_one({"_id": state})
    if not st:
        raise ValueError("Estado OAuth inválido o expirado.")
    redirect_uri = st["redirect_uri"]
    async with httpx.AsyncClient(timeout=30) as h:
        r = await h.post(
            f"{config.MELI_API}/oauth/token",
            data={
                "grant_type": "authorization_code",
                "client_id": config.MELI_APP_ID,
                "client_secret": config.MELI_CLIENT_SECRET,
                "code": code,
                "redirect_uri": redirect_uri,
            },
        )
    r.raise_for_status()
    tok = r.json()
    await _save_tokens(tok)
    return redirect_uri.split("/api/")[0]  # origin, para volver al front


async def _save_tokens(tok: dict) -> None:
    await _db()["ml_tokens"].update_one(
        {"_id": "connected"},
        {"$set": {
            "seller_id": tok["user_id"],
            "access_token": tok["access_token"],
            "refresh_token": tok["refresh_token"],
            "expires_at": _now() + timedelta(seconds=tok.get("expires_in", 21600)),
            "scope": tok.get("scope"),
            "updated_at": _now(),
        }},
        upsert=True,
    )


async def _valid_token() -> str:
    tok = await _db()["ml_tokens"].find_one({"_id": "connected"})
    if not tok:
        raise ValueError("Mercado Libre no está conectado.")
    expires_at = tok["expires_at"]
    if isinstance(expires_at, datetime) and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)  # Mongo devuelve fechas naive
    if expires_at > _now() + timedelta(minutes=5):
        return tok["access_token"]
    async with httpx.AsyncClient(timeout=30) as h:
        r = await h.post(
            f"{config.MELI_API}/oauth/token",
            data={
                "grant_type": "refresh_token",
                "client_id": config.MELI_APP_ID,
                "client_secret": config.MELI_CLIENT_SECRET,
                "refresh_token": tok["refresh_token"],
            },
        )
    r.raise_for_status()
    fresh = r.json()
    await _save_tokens(fresh)
    return fresh["access_token"]


async def status() -> dict:
    tok = await _db()["ml_tokens"].find_one({"_id": "connected"})
    if not tok:
        return {"connected": False}
    nickname = None
    try:
        access = await _valid_token()
        async with httpx.AsyncClient(timeout=20) as h:
            me = await h.get(f"{config.MELI_API}/users/me", headers={"Authorization": f"Bearer {access}"})
            if me.status_code == 200:
                nickname = me.json().get("nickname")
    except Exception:  # noqa: BLE001
        logger.warning("ML status: no se pudo validar el token")
    return {"connected": True, "seller_id": tok.get("seller_id"), "nickname": nickname}


async def disconnect() -> None:
    await _db()["ml_tokens"].delete_one({"_id": "connected"})


# --- Publicación ---------------------------------------------------------- #
# Categorías HOJA reales del árbol de Inmuebles (MLA1459), por tipo + operación.
# Todas aceptan USD y ARS. NO se usa domain_discovery: para inmuebles devuelve
# categorías equivocadas que no son propiedades (p.ej. "terreno en venta" →
# "Escenografía y Terrenos", solo ARS), lo que rompía la publicación.
_CATEGORY = {
    ("casa", "venta"): "MLA401685",
    ("casa", "alquiler"): "MLA1467",
    ("casa", "alquiler_temporario"): "MLA50278",
    ("departamento", "venta"): "MLA401686",
    ("departamento", "alquiler"): "MLA1473",
    ("departamento", "alquiler_temporario"): "MLA50279",
    ("ph", "venta"): "MLA105182",
    ("ph", "alquiler"): "MLA105181",
    ("ph", "alquiler_temporario"): "MLA105180",
    ("terreno", "venta"): "MLA401687",
    ("terreno", "alquiler"): "MLA1494",
    ("local", "venta"): "MLA79244",
    ("local", "alquiler"): "MLA79243",
    ("oficina", "venta"): "MLA401684",
    ("oficina", "alquiler"): "MLA50539",
}


async def _resolve_listing(access: str, prop: dict) -> tuple[str, list[dict]]:
    """Categoría HOJA correcta del árbol de Inmuebles por tipo+operación.
    Si no hay match exacto, cae a la variante 'venta' del mismo tipo, y en última
    instancia a Casas · Venta (MLA401685)."""
    t = prop.get("type")
    op = prop.get("operation")
    category = _CATEGORY.get((t, op)) or _CATEGORY.get((t, "venta")) or "MLA401685"
    return category, []

_AI_IMAGE_DISCLAIMER = (
    "Algunas imágenes de esta publicación pueden haber sido optimizadas digitalmente "
    "mediante inteligencia artificial con fines ilustrativos, con el objetivo de mostrar "
    "el potencial de la propiedad. Las características reales deberán verificarse durante la visita."
)


def _description_with_disclaimer(prop: dict) -> str:
    base = (prop.get("description") or prop.get("title") or "").strip()
    return f"{base}\n\n{_AI_IMAGE_DISCLAIMER}" if base else _AI_IMAGE_DISCLAIMER


def _int(value) -> int:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return 0


import unicodedata

_STATES_CACHE: list[dict] = []


def _norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "")
    return "".join(c for c in s if not unicodedata.combining(c)).strip().lower()


async def _ar_states(access: str) -> list[dict]:
    global _STATES_CACHE
    if not _STATES_CACHE:
        try:
            async with httpx.AsyncClient(timeout=20) as h:
                r = await h.get(
                    f"{config.MELI_API}/classified_locations/countries/AR",
                    headers={"Authorization": f"Bearer {access}"},
                )
            if r.status_code == 200:
                _STATES_CACHE = r.json().get("states", [])
        except Exception:  # noqa: BLE001
            logger.warning("ML: no se pudo leer el catálogo de provincias")
    return _STATES_CACHE


async def _resolve_state_id(access: str, prop: dict) -> str | None:
    states = await _ar_states(access)
    prov = _norm(prop.get("province"))
    if not states:
        return None
    for s in states:  # match exacto por nombre
        if _norm(s["name"]) == prov:
            return s["id"]
    if "buenos aires" in prov:  # zona costera de Varela → Interior
        for s in states:
            if _norm(s["name"]) == "buenos aires interior":
                return s["id"]
    for s in states:  # match parcial
        if prov and prov in _norm(s["name"]):
            return s["id"]
    return None


async def _location(access: str, prop: dict) -> dict:
    """ML valida la ubicación hasta nivel ciudad. Se resuelve la provincia contra el
    catálogo oficial (state.id) + city.name libre + coordenadas."""
    loc: dict = {
        "address_line": prop.get("address") or "",
        "country": {"id": "AR"},
        "city": {"name": prop.get("city") or ""},
    }
    state_id = await _resolve_state_id(access, prop)
    loc["state"] = {"id": state_id} if state_id else {"name": prop.get("province") or ""}
    lat, lng = prop.get("latitude"), prop.get("longitude")
    if lat is not None and lng is not None:
        loc["latitude"] = lat
        loc["longitude"] = lng
    return loc


# Mapeo id-de-atributo-ML → valor numérico tomado de la propiedad VERA.
_ATTR_VALUE = {
    "TOTAL_AREA": lambda p: str(_int(p.get("lot_area_m2")) or _int(p.get("area_m2"))),
    "COVERED_AREA": lambda p: str(_int(p.get("area_m2")) or _int(p.get("lot_area_m2"))),
    "BEDROOMS": lambda p: str(_int(p.get("bedrooms"))),
    "ROOMS": lambda p: str(_int(p.get("rooms")) or _int(p.get("bedrooms"))),
    "FULL_BATHROOMS": lambda p: str(_int(p.get("bathrooms"))),
    "PARKING_LOTS": lambda p: str(_int(p.get("parking_covered")) + _int(p.get("parking_uncovered"))),
    "GUESTS": lambda p: str(_int(p.get("capacity")) or 2),  # alquiler temporal (huéspedes)
}

# Defaults para atributos-lista OBLIGATORIOS que ML exige pero que VERA no modela
# (p.ej. terrenos requieren LAND_ACCESS). Se usan solo si la categoría los pide.
_ATTR_DEFAULT = {
    "LAND_ACCESS": {"id": "LAND_ACCESS", "value_id": "245046"},  # Asfalto
}


async def _category_attributes(access: str, category_id: str, prop: dict) -> list[dict]:
    """Consulta el esquema de la categoría y arma SOLO los atributos obligatorios que
    sabemos mapear desde la propiedad, con el formato exacto (number_unit usa la unidad
    permitida por ML, p.ej. 'm²'). Evita mandar atributos fijos/ocultos (los pone ML)."""
    try:
        async with httpx.AsyncClient(timeout=20) as h:
            r = await h.get(
                f"{config.MELI_API}/categories/{category_id}/attributes",
                headers={"Authorization": f"Bearer {access}"},
            )
        schema = r.json() if r.status_code == 200 else []
    except Exception:  # noqa: BLE001
        logger.warning("ML: no se pudo leer el esquema de %s", category_id)
        schema = []

    out: list[dict] = []
    for attr in schema:
        tags = attr.get("tags") or {}
        if not tags.get("required") or tags.get("hidden") or tags.get("fixed"):
            continue
        aid = attr.get("id")
        provider = _ATTR_VALUE.get(aid)
        if not provider:
            default = _ATTR_DEFAULT.get(aid)
            if default:
                out.append(dict(default))
            continue
        value = provider(prop)
        if attr.get("value_type") == "number_unit":
            units = attr.get("allowed_units") or [{}]
            unit = next((u.get("id") for u in units if u.get("id") in ("m²", "m2")), None) or units[0].get("id", "m²")
            out.append({"id": aid, "value_name": f"{value} {unit}"})
        else:
            out.append({"id": aid, "value_name": value})
    return out


def _payload(prop: dict, images: list[dict], category_id: str, attributes: list[dict], location: dict) -> dict:
    pics = [{"source": i["url"]} for i in images if i.get("url")][:12]
    return {
        "title": (prop.get("title") or "Propiedad")[:60],
        "category_id": category_id,
        "price": prop.get("price") or 1,
        "currency_id": "USD" if (prop.get("currency") == "USD") else "ARS",
        "available_quantity": 1,
        "buying_mode": "classified",
        "listing_type_id": "silver",
        "condition": "not_specified",
        "pictures": pics,
        "description": {"plain_text": _description_with_disclaimer(prop)},
        "location": location,
        "attributes": attributes,
        "seller_custom_field": str(prop.get("id") or ""),
        # Requerido por ML para inmuebles: sin esto, el aviso queda "activo" (el link
        # anda) pero pierde visibilidad en el buscador. country_code2/phone2 = WhatsApp.
        "seller_contact": {
            "contact": "Inmobiliaria Varela",
            "country_code": "54", "area_code": "", "phone": config.ML_CONTACT_PHONE,
            "country_code2": "54", "phone2": config.ML_CONTACT_PHONE,
            "email": config.ML_CONTACT_EMAIL, "webpage": config.PUBLIC_WEB_BASE_URL,
        },
    }


_EDITABLE_STATUS = {"active", "paused"}
_PENDING_STATUS = {"not_yet_active", "payment_required", "under_review"}
# Estados "muertos": el aviso ya no se puede editar. Solo se relista (crea uno nuevo)
# en una publicación MANUAL; nunca en la re-sync automática al guardar.
_DEAD_STATUS = {"closed", "inactive", "not_found"}


async def _item_status(access: str, item_id: str) -> str | None:
    """Status real del item; 'not_found' si ML responde 404 (borrado), None si no se
    pudo verificar (error de red/token). Distinguir None de 'not_found' evita duplicar
    un aviso vivo por un fallo transitorio."""
    try:
        async with httpx.AsyncClient(timeout=20) as h:
            r = await h.get(
                f"{config.MELI_API}/items/{item_id}?attributes=status",
                headers={"Authorization": f"Bearer {access}"},
            )
        if r.status_code == 404:
            return "not_found"
        return r.json().get("status") if r.status_code == 200 else None
    except Exception:  # noqa: BLE001
        return None


_bg_tasks: set = set()


async def set_description(item_id: str, text: str) -> bool:
    """Setea (o reemplaza) la descripción de un aviso. POST y, si ya existe, PUT.
    ML rechaza el POST durante los primeros ~20-30s del alta; por eso se reintenta
    desde el polling de estado hasta que ML lo acepta."""
    access = await _valid_token()
    headers = {"Authorization": f"Bearer {access}", "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=20) as h:
        r = await h.post(f"{config.MELI_API}/items/{item_id}/description", headers=headers, json={"plain_text": text})
        if r.status_code < 400:
            return True
        rp = await h.put(f"{config.MELI_API}/items/{item_id}/description", headers=headers, json={"plain_text": text})
        return rp.status_code < 400


async def _set_description(h, headers, item_id: str, text: str) -> bool:
    """Setea la descripción de un aviso YA activo/pausado (update). POST y, si ya existe, PUT."""
    r = await h.post(f"{config.MELI_API}/items/{item_id}/description", headers=headers, json={"plain_text": text})
    if r.status_code < 400:
        return True
    rp = await h.put(f"{config.MELI_API}/items/{item_id}/description", headers=headers, json={"plain_text": text})
    if rp.status_code >= 400:
        logger.error("ML: no se pudo setear descripción de %s: %s", item_id, rp.text[:300])
    return rp.status_code < 400


async def _set_description_deferred(item_id: str, text: str) -> None:
    """(Reservado) — la descripción en altas se setea de forma perezosa desde /state."""
    return None


async def _match_existing(access: str, prop: dict) -> str | None:
    """Busca en la cuenta del vendedor un aviso VIVO (active/paused) ya existente para
    esta propiedad. Red anti-duplicados: reusa el aviso en vez de crear otro cuando el
    itemId se perdió/quedó desvinculado en la DB. Dos estrategias, en orden:

    1) EXACTA — `seller_custom_field == property_id` (avisos creados por VERA).
    2) HEURÍSTICA (avisos LEGACY sin `seller_custom_field`, p.ej. previos al sistema
       anti-duplicados o importados): mismo título normalizado + mismo precio + misma
       moneda. Evita que un aviso viejo "invisible" (scf vacío) provoque un duplicado.

    El endpoint items/search NO filtra por seller_custom_field, así que traemos los ids
    del vendedor (devuelve activos/pausados) y verificamos con multiget. Devuelve el
    itemId reutilizable o None."""
    pid = str(prop.get("id") or "")
    tok = await _db()["ml_tokens"].find_one({"_id": "connected"})
    seller_id = tok and (tok.get("seller_id") or tok.get("user_id"))
    if not seller_id:
        return None
    want_title = _norm((prop.get("title") or "")[:60])
    want_price = _int(prop.get("price"))
    want_cur = "USD" if prop.get("currency") == "USD" else "ARS"
    headers = {"Authorization": f"Bearer {access}"}
    heuristic_match: str | None = None
    try:
        async with httpx.AsyncClient(timeout=25) as h:
            ids: list[str] = []
            offset = 0
            while offset < 400:  # tope de seguridad
                r = await h.get(
                    f"{config.MELI_API}/users/{seller_id}/items/search",
                    headers=headers, params={"limit": 50, "offset": offset},
                )
                if r.status_code != 200:
                    break
                page = r.json().get("results") or []
                ids += page
                if len(page) < 50:
                    break
                offset += 50
            for i in range(0, len(ids), 20):
                batch = ids[i:i + 20]
                m = await h.get(
                    f"{config.MELI_API}/items",
                    headers=headers,
                    params={"ids": ",".join(batch), "attributes": "id,seller_custom_field,status,title,price,currency_id"},
                )
                if m.status_code != 200:
                    continue
                for entry in m.json():
                    b = entry.get("body") or {}
                    if b.get("status") not in _EDITABLE_STATUS:
                        continue  # solo reusamos avisos vivos (nunca uno cerrado)
                    scf = b.get("seller_custom_field")
                    if pid and scf == pid:
                        return b.get("id")  # match fuerte → gana siempre
                    if not scf and want_title and _norm(b.get("title") or "") == want_title \
                            and _int(b.get("price")) == want_price and (b.get("currency_id") or "") == want_cur:
                        heuristic_match = heuristic_match or b.get("id")
    except Exception:  # noqa: BLE001
        return heuristic_match
    return heuristic_match


async def publish(prop: dict, images: list[dict], existing_item_id: str | None, *, allow_relist: bool = True) -> dict:
    """Crea (POST /items) o ACTUALIZA (PUT /items/{id}) el aviso. Devuelve item id + permalink.

    Regla anti-duplicados: si ya hay un `existing_item_id`, NUNCA se crea un aviso nuevo
    en silencio. Solo se relista (crea uno nuevo) cuando el aviso está realmente muerto
    (closed/inactive/borrado) Y `allow_relist=True` (publicación manual). En la re-sync
    automática al guardar (`allow_relist=False`) jamás se crea uno nuevo.
    En inmuebles ML SÍ permite editar título, precio y fotos por PUT."""
    access = await _valid_token()
    category_id, _ = await _resolve_listing(access, prop)
    attributes = await _category_attributes(access, category_id, prop)
    location = await _location(access, prop)
    payload = _payload(prop, images, category_id, attributes, location)
    headers = {"Authorization": f"Bearer {access}", "Content-Type": "application/json"}

    async def _do_update(item_id: str) -> dict:
        """Edita un aviso VIVO (título/precio/fotos/descripción) y lo re-vincula (scf)."""
        async with httpx.AsyncClient(timeout=40) as h:
            upd = {
                "title": payload["title"],
                "price": payload["price"],
                "pictures": payload["pictures"],
                "seller_custom_field": str(prop.get("id") or ""),
                "seller_contact": payload["seller_contact"],
            }
            r = await h.put(f"{config.MELI_API}/items/{item_id}", headers=headers, json=upd)
            if r.status_code >= 400:
                # Si rechaza el título (categorías que lo bloquean), reintenta sin él.
                logger.warning("ML update con título rechazado (%s): %s", item_id, r.text[:200])
                r = await h.put(
                    f"{config.MELI_API}/items/{item_id}",
                    headers=headers,
                    json={"price": payload["price"], "pictures": payload["pictures"],
                          "seller_custom_field": str(prop.get("id") or ""), "seller_contact": payload["seller_contact"]},
                )
            if r.status_code >= 400:
                raise MeliError(r.status_code, r.text)
            await _set_description(h, headers, item_id, payload["description"]["plain_text"])
            data = r.json()
        return {"item_id": item_id, "permalink": data.get("permalink", "")}

    # Red anti-duplicados: si no tenemos itemId guardado (p.ej. se perdió en la
    # migración o el vínculo se rompió), buscamos si YA existe un aviso VIVO de esta
    # propiedad en ML (por scf o por heurística legacy) antes de crear.
    if not existing_item_id:
        existing_item_id = await _match_existing(access, prop)

    if existing_item_id:
        status = await _item_status(access, existing_item_id)
        if status in _PENDING_STATUS:
            raise ValueError(
                "El aviso todavía se está activando en Mercado Libre (puede tardar unos minutos). "
                "Reintentá en un rato."
            )
        if status in _EDITABLE_STATUS:
            return await _do_update(existing_item_id)
        # Aviso muerto o no verificable: ANTES de relistar, verificá si ya hay OTRO
        # aviso vivo de esta propiedad (evita duplicar cuando el itemId guardado quedó
        # obsoleto pero el aviso real sigue publicado con otro id).
        live = await _match_existing(access, prop)
        if live and live != existing_item_id:
            return await _do_update(live)
        # Estado muerto o no verificable → no duplicar salvo relist manual explícito.
        if not (allow_relist and status in _DEAD_STATUS):
            raise ValueError(
                "No pudimos actualizar el aviso de Mercado Libre y no creamos uno nuevo "
                "para evitar duplicados. Reintentá en unos minutos; si el aviso quedó "
                "finalizado en Mercado Libre, volvé a publicarlo a mano para relistarlo."
            )
        # allow_relist y aviso muerto sin otro vivo → sigue a crear uno nuevo (relistar).

    async with httpx.AsyncClient(timeout=40) as h:
        r = await h.post(f"{config.MELI_API}/items", headers=headers, json=payload)
        if r.status_code >= 400:
            raise MeliError(r.status_code, r.text)
        data = r.json()
    return {"item_id": data.get("id"), "permalink": data.get("permalink", "")}


async def sync_status(item_id: str, desired: str) -> str | None:
    """Ajusta el estado del aviso a `desired` ('active' | 'paused') SOLO si difiere del
    actual y el item es editable (no cerrado/pendiente). Devuelve el estado final.
    Se usa para pausar el aviso cuando la propiedad pasa a Reservada/Vendida y
    reactivarlo cuando vuelve a Disponible."""
    access = await _valid_token()
    current = await _item_status(access, item_id)
    if current is None or current == desired or current not in _EDITABLE_STATUS:
        return current
    async with httpx.AsyncClient(timeout=30) as h:
        headers = {"Authorization": f"Bearer {access}", "Content-Type": "application/json"}
        r = await h.put(f"{config.MELI_API}/items/{item_id}", headers=headers, json={"status": desired})
    if r.status_code >= 400:
        raise MeliError(r.status_code, r.text)
    return desired


async def find_property_items(property_id: str) -> list[dict]:
    """Devuelve TODOS los avisos (activos/pausados) de la cuenta cuyo
    seller_custom_field == property_id, con detalle. Sirve para detectar duplicados."""
    if not property_id or not config.meli_configured():
        return []
    access = await _valid_token()
    tok = await _db()["ml_tokens"].find_one({"_id": "connected"})
    seller_id = tok and (tok.get("seller_id") or tok.get("user_id"))
    if not seller_id:
        return []
    headers = {"Authorization": f"Bearer {access}"}
    out: list[dict] = []
    try:
        async with httpx.AsyncClient(timeout=25) as h:
            ids: list[str] = []
            offset = 0
            while offset < 400:
                r = await h.get(
                    f"{config.MELI_API}/users/{seller_id}/items/search",
                    headers=headers, params={"limit": 50, "offset": offset},
                )
                if r.status_code != 200:
                    break
                page = r.json().get("results") or []
                ids += page
                if len(page) < 50:
                    break
                offset += 50
            attrs = "id,seller_custom_field,status,price,currency_id,title,permalink"
            for i in range(0, len(ids), 20):
                m = await h.get(
                    f"{config.MELI_API}/items",
                    headers=headers, params={"ids": ",".join(ids[i:i + 20]), "attributes": attrs},
                )
                if m.status_code != 200:
                    continue
                for entry in m.json():
                    b = entry.get("body") or {}
                    if b.get("seller_custom_field") == property_id and b.get("status") in ("active", "paused"):
                        out.append({
                            "itemId": b.get("id"), "status": b.get("status"),
                            "price": b.get("price"), "currency": b.get("currency_id"),
                            "title": b.get("title"), "url": b.get("permalink"),
                        })
    except Exception:  # noqa: BLE001
        return out
    return out


async def pause(item_id: str) -> None:
    """Pausa un aviso (status 'paused'). Reversible."""
    access = await _valid_token()
    async with httpx.AsyncClient(timeout=30) as h:
        r = await h.put(
            f"{config.MELI_API}/items/{item_id}",
            headers={"Authorization": f"Bearer {access}", "Content-Type": "application/json"},
            json={"status": "paused"},
        )
        if r.status_code >= 400:
            raise MeliError(r.status_code, r.text)


async def close(item_id: str) -> None:
    access = await _valid_token()
    async with httpx.AsyncClient(timeout=30) as h:
        headers = {"Authorization": f"Bearer {access}", "Content-Type": "application/json"}
        # Pausar primero, luego cerrar (requisito de ML).
        await h.put(f"{config.MELI_API}/items/{item_id}", headers=headers, json={"status": "paused"})
        r = await h.put(f"{config.MELI_API}/items/{item_id}", headers=headers, json={"status": "closed"})
    if r.status_code >= 400:
        raise MeliError(r.status_code, r.text)


async def item_state(item_id: str) -> dict:
    """Estado real del aviso en ML (status + sub_status + permalink)."""
    access = await _valid_token()
    async with httpx.AsyncClient(timeout=20) as h:
        r = await h.get(
            f"{config.MELI_API}/items/{item_id}?attributes=status,sub_status,permalink",
            headers={"Authorization": f"Bearer {access}"},
        )
    if r.status_code != 200:
        return {"status": None, "sub_status": [], "permalink": ""}
    d = r.json()
    return {"status": d.get("status"), "sub_status": d.get("sub_status") or [], "permalink": d.get("permalink") or ""}


class MeliError(Exception):
    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail
        super().__init__(f"ML {status_code}: {detail[:300]}")
