"""Mercado Libre (API real). OAuth 2.0 (authorization code + refresh) para operar en
nombre de la cuenta vendedor de Varela, y publicar/actualizar/finalizar avisos.
El Client Secret vive solo acá (backend). Tokens y estado en Mongo."""
from __future__ import annotations

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
    }


_EDITABLE_STATUS = {"active", "paused"}
_PENDING_STATUS = {"not_yet_active", "payment_required", "under_review"}


async def _item_status(access: str, item_id: str) -> str | None:
    try:
        async with httpx.AsyncClient(timeout=20) as h:
            r = await h.get(
                f"{config.MELI_API}/items/{item_id}?attributes=status",
                headers={"Authorization": f"Bearer {access}"},
            )
        return r.json().get("status") if r.status_code == 200 else None
    except Exception:  # noqa: BLE001
        return None


async def publish(prop: dict, images: list[dict], existing_item_id: str | None) -> dict:
    """Crea (POST /items) o actualiza (PUT /items/{id}) el aviso. Devuelve item id + permalink.
    ML NO permite modificar title ni currency_id, y un item cerrado/finalizado no es editable
    (en ese caso se crea uno nuevo)."""
    access = await _valid_token()
    category_id, _ = await _resolve_listing(access, prop)
    attributes = await _category_attributes(access, category_id, prop)
    location = await _location(access, prop)
    payload = _payload(prop, images, category_id, attributes, location)
    headers = {"Authorization": f"Bearer {access}", "Content-Type": "application/json"}

    status = await _item_status(access, existing_item_id) if existing_item_id else None
    if status in _PENDING_STATUS:
        raise ValueError(
            "El aviso todavía se está activando en Mercado Libre (puede tardar unos minutos). "
            "Reintentá en un rato."
        )

    async with httpx.AsyncClient(timeout=40) as h:
        if existing_item_id and status in _EDITABLE_STATUS:
            # Solo campos modificables (title y currency_id no lo son en ML).
            upd = {"price": payload["price"], "pictures": payload["pictures"]}
            r = await h.put(f"{config.MELI_API}/items/{existing_item_id}", headers=headers, json=upd)
            if r.status_code < 400:
                await h.put(
                    f"{config.MELI_API}/items/{existing_item_id}/description",
                    headers=headers, json={"plain_text": payload["description"]["plain_text"]},
                )
            fallback_id = existing_item_id
        else:
            # Sin publicación previa o item cerrado/no editable → crear uno nuevo.
            r = await h.post(f"{config.MELI_API}/items", headers=headers, json=payload)
            fallback_id = None
    if r.status_code >= 400:
        raise MeliError(r.status_code, r.text)
    data = r.json()
    return {"item_id": data.get("id", fallback_id), "permalink": data.get("permalink", "")}


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
