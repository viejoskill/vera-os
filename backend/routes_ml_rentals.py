"""Mercado Libre para el módulo de Alquileres (publica como 'Alquiler temporal').
Reutiliza el servicio real de ML (OAuth + publish/close/state) y refleja el estado
en `rental_properties.publications['mercadolibre']`."""
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient

import config
from mercadolibre import service as ml
from serializers import _sign

router = APIRouter(prefix="/ml/rentals", tags=["mercadolibre-rentals"])
logger = logging.getLogger("vera")

_client: AsyncIOMotorClient | None = None

_ML_STATE_LABEL = {
    "active": ("Activo en Mercado Libre", "published"),
    "paused": ("Pausado", "pending"),
    "not_yet_active": ("Activándose…", "syncing"),
    "under_review": ("En revisión", "syncing"),
    "payment_required": ("Pago pendiente", "pending"),
    "closed": ("Finalizado", "none"),
    "inactive": ("Inactivo", "none"),
}


def _props():
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(config.MONGO_URL)
    return _client[config.DB_NAME]["rental_properties"]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ensure() -> None:
    if not config.meli_configured():
        raise HTTPException(503, "Mercado Libre no está configurado en el servidor.")


async def _get(pid: str) -> dict:
    p = await _props().find_one({"_id": pid})
    if not p:
        raise HTTPException(404, "Alquiler no encontrado.")
    return p


def _norm_currency(m: str | None) -> str:
    return "USD" if (m or "").upper().startswith("US") or (m or "").upper() == "USD" else "ARS"


def _rental_to_prop(r: dict) -> dict:
    """Adapta un alquiler al dict que espera el servicio de ML, como Alquiler Temporal."""
    tipo = (r.get("tipo") or "casa").lower()
    if tipo not in ("casa", "departamento", "ph"):
        tipo = "casa"
    return {
        "id": r["_id"],
        "type": tipo,
        "operation": "alquiler_temporario",
        "title": r.get("titulo") or "Alquiler temporal",
        "description": r.get("descripcion") or r.get("titulo") or "",
        "price": r.get("precioNoche") or 1,
        "currency": _norm_currency(r.get("moneda")),
        "address": r.get("direccion") or "",
        "city": r.get("localidad") or "",
        "province": "Buenos Aires",
        "latitude": None, "longitude": None,
        "bedrooms": r.get("dormitorios"),
        "rooms": r.get("dormitorios"),
        "bathrooms": r.get("banos"),
        "capacity": r.get("capacidad"),
        "area_m2": r.get("superficieM2") or None,
        "lot_area_m2": r.get("superficieM2") or None,
    }


async def _images(r: dict) -> list[dict]:
    imgs = sorted(r.get("imagenes") or [], key=lambda i: (not i.get("isCover", False), i.get("position", 0)))
    out = []
    for img in imgs:
        url = await _sign(img.get("bucket"), img.get("object_path"))
        if url:
            out.append({"url": url})
    return out


async def _set_channel(pid: str, patch: dict) -> None:
    r = await _get(pid)
    pubs = dict(r.get("publications") or {})
    current = dict(pubs.get("mercadolibre") or {})
    current.update(patch)
    pubs["mercadolibre"] = current
    await _props().update_one({"_id": pid}, {"$set": {"publications": pubs}})


@router.post("/{pid}/publish")
async def publish_rental(pid: str):
    _ensure()
    r = await _get(pid)
    images = await _images(r)
    if not images:
        raise HTTPException(400, "Agregá al menos una foto antes de publicar en Mercado Libre.")
    if not (r.get("precioNoche") or 0) > 0:
        raise HTTPException(400, "Cargá el precio por noche antes de publicar en Mercado Libre.")
    existing = ((r.get("publications") or {}).get("mercadolibre") or {}).get("itemId")
    try:
        res = await ml.publish(_rental_to_prop(r), images, existing)
    except ml.MeliError as e:
        logger.error("ML rental publish rechazado (%s): %s", pid, e.detail)
        await _set_channel(pid, {"status": "error", "lastSync": _now(), "error": e.detail[:800]})
        raise HTTPException(400, f"Mercado Libre rechazó la publicación: {e.detail[:800]}")
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, str(e))
    await _set_channel(pid, {
        "status": "published", "lastSync": _now(),
        "url": res["permalink"], "itemId": res["item_id"], "error": None,
    })
    return {"status": "published", "itemId": res["item_id"], "url": res["permalink"]}


@router.get("/{pid}/state")
async def rental_state(pid: str):
    if not config.meli_configured():
        return {"hasListing": False}
    r = await _get(pid)
    item_id = ((r.get("publications") or {}).get("mercadolibre") or {}).get("itemId")
    if not item_id:
        return {"hasListing": False}
    try:
        st = await ml.item_state(item_id)
    except Exception:  # noqa: BLE001
        return {"hasListing": True, "itemId": item_id, "status": None, "label": "—", "tone": "none", "activating": False}
    label, tone = _ML_STATE_LABEL.get(st.get("status"), ("—", "none"))
    sub = st.get("sub_status") or []
    activating = st.get("status") in ("not_yet_active", "under_review", "payment_required") or (
        "picture_download_pending" in sub or "pack_quota_pending" in sub
    )
    return {
        "hasListing": True, "itemId": item_id, "status": st.get("status"),
        "subStatus": sub, "label": label, "tone": tone,
        "activating": activating, "url": st.get("permalink") or "",
    }


@router.post("/{pid}/close")
async def close_rental(pid: str):
    _ensure()
    r = await _get(pid)
    item_id = ((r.get("publications") or {}).get("mercadolibre") or {}).get("itemId")
    if not item_id:
        raise HTTPException(400, "Este alquiler no tiene una publicación de Mercado Libre.")
    try:
        await ml.close(item_id)
    except ml.MeliError as e:
        raise HTTPException(400, f"No se pudo finalizar en Mercado Libre: {e.detail[:300]}")
    await _set_channel(pid, {"status": "none", "lastSync": _now(), "error": None})
    return {"status": "none"}
