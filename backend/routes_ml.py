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


async def _stamped_images(prop: dict, status: str) -> list[dict]:
    """Portada con sello (VENDIDA/RESERVADA) primero + el resto de las fotos.
    Si no se puede generar el sello, cae a las fotos normales."""
    from property_stamp import stamped_cover_url, cover_row

    stamped = await stamped_cover_url(prop, status)
    if not stamped:
        return await _images(prop)
    cover = cover_row(prop) or {}
    rest = []
    for img in prop.get("property_images") or []:
        if img.get("object_path") == cover.get("object_path"):
            continue  # la portada original se reemplaza por la sellada
        url = await _sign(img.get("bucket"), img.get("object_path"))
        if url:
            rest.append({"url": url})
    return [{"url": stamped}] + rest


async def _set_channel(prop: dict, patch: dict) -> None:
    pubs = dict(prop.get("publications") or {})
    current = dict(pubs.get("mercadolibre") or {})
    current.update(patch)
    pubs["mercadolibre"] = current
    await property_repository.update(prop["id"], {"publications": pubs})


async def ml_resync_patch(prop: dict) -> dict:
    """Re-sincroniza el aviso de Mercado Libre con los datos actuales (título, precio,
    descripción, fotos) y devuelve el patch de `publications` (sin escribir en DB).
    Best-effort: si falla, devuelve el canal en estado 'error'. Solo actúa si ya hay
    un aviso publicado (itemId)."""
    ml_pub = (prop.get("publications") or {}).get("mercadolibre") or {}
    item_id = ml_pub.get("itemId")
    if not item_id or not config.meli_configured():
        return {}
    # Solo resincroniza avisos que hoy están publicados. Un aviso finalizado/en error
    # no se toca al guardar (evita reactivarlo o duplicarlo sin que el usuario lo pida).
    if ml_pub.get("status") != "published":
        return {}
    # Si está Reservada/Vendida, la portada del aviso lleva el sello quemado; el aviso
    # NO se pausa automáticamente (el usuario lo pausa a mano si lo necesita).
    status = prop.get("status")
    try:
        _stamp_on = (prop.get("publications") or {}).get("autoStamp", True)
        images = await _stamped_images(prop, status) if (status in ("reserved", "sold") and _stamp_on) else await _images(prop)
        # allow_relist=False: al guardar NUNCA se crea un aviso nuevo (anti-duplicados).
        res = await ml.publish(prop, images, item_id, allow_relist=False)
    except Exception as e:  # noqa: BLE001 — best-effort
        detail = getattr(e, "detail", str(e))
        logger.error("ML re-sync error (%s): %s", prop.get("id"), detail)
        return {"mercadolibre": {**ml_pub, "status": "error", "lastSync": _now(), "error": str(detail)[:800]}}
    return {"mercadolibre": {
        **ml_pub, "status": "published", "lastSync": _now(),
        "url": res["permalink"], "itemId": res["item_id"], "error": None,
    }}


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


@router.get("/listings/{property_id}/duplicates")
async def listing_duplicates(property_id: str):
    """Lista todos los avisos ML (activos/pausados) de esta propiedad para detectar
    duplicados. Marca cuál es el vinculado en el CRM (itemId guardado)."""
    _ensure()
    prop = await property_repository.get(property_id)
    if not prop:
        raise HTTPException(404, "Propiedad no encontrada.")
    linked = ((prop.get("publications") or {}).get("mercadolibre") or {}).get("itemId")
    items = await ml.find_property_items(property_id)
    for it in items:
        it["linked"] = (it["itemId"] == linked)
    return {"linkedItemId": linked, "count": len(items), "items": items}


@router.post("/items/{item_id}/pause")
async def pause_item(item_id: str):
    """Pausa un aviso puntual (para limpiar un duplicado suelto). Reversible."""
    _ensure()
    try:
        await ml.pause(item_id)
    except ml.MeliError as e:
        raise HTTPException(400, f"No se pudo pausar el aviso: {e.detail[:300]}")
    return {"itemId": item_id, "status": "paused"}


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


@router.post("/listings/{property_id}/reactivate")
async def reactivate_listing(property_id: str):
    """Reactiva (status 'active') el aviso pausado en Mercado Libre, SIN cambiar el
    estado de la propiedad en el CRM."""
    _ensure()
    prop = await property_repository.get(property_id)
    if not prop:
        raise HTTPException(404, "Propiedad no encontrada.")
    item_id = ((prop.get("publications") or {}).get("mercadolibre") or {}).get("itemId")
    if not item_id:
        raise HTTPException(400, "Esta propiedad no tiene una publicación de Mercado Libre.")
    try:
        final = await ml.sync_status(item_id, "active")
    except ml.MeliError as e:
        raise HTTPException(400, f"No se pudo reactivar en Mercado Libre: {e.detail[:300]}")
    await _set_channel(prop, {"status": "published", "lastSync": _now(), "error": None})
    return {"status": final or "active"}
