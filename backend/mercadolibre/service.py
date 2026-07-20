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
_CATEGORY = {
    "casa": "MLA1466", "departamento": "MLA1472", "ph": "MLA1476",
    "terreno": "MLA1493", "local": "MLA1499", "oficina": "MLA1497",
}
_OPERATION = {"venta": "Venta", "alquiler": "Alquiler", "alquiler_temporario": "Alquiler temporal"}

_AI_IMAGE_DISCLAIMER = (
    "Algunas imágenes de esta publicación pueden haber sido optimizadas digitalmente "
    "mediante inteligencia artificial con fines ilustrativos, con el objetivo de mostrar "
    "el potencial de la propiedad. Las características reales deberán verificarse durante la visita."
)


def _description_with_disclaimer(prop: dict) -> str:
    base = (prop.get("description") or prop.get("title") or "").strip()
    return f"{base}\n\n{_AI_IMAGE_DISCLAIMER}" if base else _AI_IMAGE_DISCLAIMER


def _payload(prop: dict, images: list[dict]) -> dict:
    pics = [{"source": i["url"]} for i in images if i.get("url")][:12]
    op = _OPERATION.get(prop.get("operation"), "Venta")
    return {
        "title": (prop.get("title") or "Propiedad")[:60],
        "category_id": _CATEGORY.get(prop.get("type"), "MLA1466"),
        "price": prop.get("price") or 1,
        "currency_id": "USD" if (prop.get("currency") == "USD") else "ARS",
        "available_quantity": 1,
        "buying_mode": "classified",
        "listing_type_id": "silver",
        "condition": "not_specified",
        "pictures": pics,
        "description": {"plain_text": _description_with_disclaimer(prop)},
        "location": {
            "address_line": prop.get("address") or "",
            "city": {"name": prop.get("city") or ""},
            "state": {"name": prop.get("province") or "Buenos Aires"},
            "neighborhood": {"name": prop.get("neighborhood") or ""},
        },
        "attributes": [
            {"id": "OPERATION", "value_name": op},
            {"id": "TOTAL_AREA", "value_name": f"{int(prop.get('lot_area_m2') or prop.get('area_m2') or 0)} m²"},
            {"id": "COVERED_AREA", "value_name": f"{int(prop.get('area_m2') or 0)} m²"},
            {"id": "BEDROOMS", "value_name": str(int(prop.get("bedrooms") or 0))},
            {"id": "FULL_BATHROOMS", "value_name": str(int(prop.get("bathrooms") or 0))},
        ],
    }


async def publish(prop: dict, images: list[dict], existing_item_id: str | None) -> dict:
    """Crea (POST /items) o actualiza (PUT /items/{id}) el aviso. Devuelve item id + permalink."""
    access = await _valid_token()
    payload = _payload(prop, images)
    async with httpx.AsyncClient(timeout=40) as h:
        headers = {"Authorization": f"Bearer {access}", "Content-Type": "application/json"}
        if existing_item_id:
            # En update no se reenvían category/buying_mode (inmutables tras crear).
            upd = {k: payload[k] for k in ("title", "price", "currency_id", "pictures", "available_quantity")}
            r = await h.put(f"{config.MELI_API}/items/{existing_item_id}", headers=headers, json=upd)
            await h.put(
                f"{config.MELI_API}/items/{existing_item_id}/description",
                headers=headers, json={"plain_text": payload["description"]["plain_text"]},
            )
        else:
            r = await h.post(f"{config.MELI_API}/items", headers=headers, json=payload)
    if r.status_code >= 400:
        raise MeliError(r.status_code, r.text)
    data = r.json()
    return {"item_id": data.get("id", existing_item_id), "permalink": data.get("permalink", "")}


async def close(item_id: str) -> None:
    access = await _valid_token()
    async with httpx.AsyncClient(timeout=30) as h:
        headers = {"Authorization": f"Bearer {access}", "Content-Type": "application/json"}
        # Pausar primero, luego cerrar (requisito de ML).
        await h.put(f"{config.MELI_API}/items/{item_id}", headers=headers, json={"status": "paused"})
        r = await h.put(f"{config.MELI_API}/items/{item_id}", headers=headers, json={"status": "closed"})
    if r.status_code >= 400:
        raise MeliError(r.status_code, r.text)


class MeliError(Exception):
    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail
        super().__init__(f"ML {status_code}: {detail[:300]}")
