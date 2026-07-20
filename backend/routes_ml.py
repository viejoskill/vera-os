"""Endpoints de Mercado Libre: conexión OAuth y publicar/actualizar/finalizar avisos.
Refleja el estado en `properties.publications['mercadolibre']` para el panel de VERA."""
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse

import config
from mercadolibre import service as ml
from property_repository import property_repository
from serializers import _sign  # reutiliza el firmador de imágenes

router = APIRouter(prefix="/ml", tags=["mercadolibre"])
logger = logging.getLogger("vera")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ensure() -> None:
    if not config.meli_configured():
        raise HTTPException(503, "Mercado Libre no está configurado en el servidor.")


@router.get("/oauth/start")
async def oauth_start(origin: str):
    _ensure()
    url = await ml.build_auth_url(origin)
    return {"auth_url": url}


@router.get("/callback")
async def oauth_callback(code: str = "", state: str = ""):
    _ensure()
    try:
        origin = await ml.exchange_code(code, state)
    except Exception as e:  # noqa: BLE001
        logger.exception("ML callback error")
        raise HTTPException(400, f"No se pudo conectar Mercado Libre: {e}")
    return RedirectResponse(f"{origin}/propiedades?ml=connected")


@router.get("/status")
async def ml_status():
    if not config.meli_configured():
        return {"connected": False, "configured": False}
    st = await ml.status()
    st["configured"] = True
    return st


@router.post("/disconnect")
async def ml_disconnect():
    await ml.disconnect()
    return {"connected": False}


async def _images(prop: dict) -> list[dict]:
    out = []
    for img in prop.get("property_images") or []:
        url = await _sign(img.get("bucket"), img.get("object_path"))
        if url:
            out.append({"url": url})
    return out


async def _set_channel(prop: dict, patch: dict) -> None:
    pubs = dict(prop.get("publications") or {})
    current = dict(pubs.get("mercadolibre") or {})
    current.update(patch)
    pubs["mercadolibre"] = current
    await property_repository.update(prop["id"], {"publications": pubs})


@router.post("/listings/{property_id}/publish")
async def publish_listing(property_id: str):
    _ensure()
    prop = await property_repository.get(property_id)
    if not prop:
        raise HTTPException(404, "Propiedad no encontrada.")
    existing = ((prop.get("publications") or {}).get("mercadolibre") or {}).get("itemId")
    try:
        res = await ml.publish(prop, await _images(prop), existing)
    except ml.MeliError as e:
        await _set_channel(prop, {"status": "error", "lastSync": _now(), "error": e.detail[:300]})
        raise HTTPException(400, f"Mercado Libre rechazó la publicación: {e.detail[:300]}")
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, str(e))
    await _set_channel(prop, {
        "status": "published", "lastSync": _now(),
        "url": res["permalink"], "itemId": res["item_id"], "error": None,
    })
    return {"status": "published", "itemId": res["item_id"], "url": res["permalink"]}


@router.post("/listings/{property_id}/close")
async def close_listing(property_id: str):
    _ensure()
    prop = await property_repository.get(property_id)
    if not prop:
        raise HTTPException(404, "Propiedad no encontrada.")
    item_id = ((prop.get("publications") or {}).get("mercadolibre") or {}).get("itemId")
    if not item_id:
        raise HTTPException(400, "Esta propiedad no tiene una publicación de Mercado Libre.")
    try:
        await ml.close(item_id)
    except ml.MeliError as e:
        raise HTTPException(400, f"No se pudo finalizar en Mercado Libre: {e.detail[:300]}")
    await _set_channel(prop, {"status": "none", "lastSync": _now(), "error": None})
    return {"status": "none"}
