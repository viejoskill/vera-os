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

# status real de ML → (etiqueta en español, tono del punto de estado en la UI)
_ML_STATE_LABEL = {
    "active": ("Activo en Mercado Libre", "published"),
    "paused": ("Pausado", "pending"),
    "not_yet_active": ("Activándose…", "syncing"),
    "under_review": ("En revisión", "syncing"),
    "payment_required": ("Pago pendiente", "pending"),
    "closed": ("Finalizado", "none"),
    "inactive": ("Inactivo", "none"),
}


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
        logger.error("ML publish rechazado (%s): %s", property_id, e.detail)
        await _set_channel(prop, {"status": "error", "lastSync": _now(), "error": e.detail[:800]})
        raise HTTPException(400, f"Mercado Libre rechazó la publicación: {e.detail[:800]}")
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, str(e))
    await _set_channel(prop, {
        "status": "published", "lastSync": _now(),
        "url": res["permalink"], "itemId": res["item_id"], "error": None,
    })
    return {"status": "published", "itemId": res["item_id"], "url": res["permalink"]}


@router.get("/listings/{property_id}/state")
async def listing_state(property_id: str):
    """Estado EN VIVO del aviso de ML para reflejarlo en VERA (activándose/activo/pausado/finalizado)."""
    if not config.meli_configured():
        return {"hasListing": False}
    prop = await property_repository.get(property_id)
    if not prop:
        raise HTTPException(404, "Propiedad no encontrada.")
    item_id = ((prop.get("publications") or {}).get("mercadolibre") or {}).get("itemId")
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
        "hasListing": True,
        "itemId": item_id,
        "status": st.get("status"),
        "subStatus": sub,
        "label": label,
        "tone": tone,
        "activating": activating,
        "url": st.get("permalink") or "",
    }


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
