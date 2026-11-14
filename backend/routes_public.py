"""Vista pública de VERA. La web NO es un sistema aparte: lee EN VIVO la cartera de
VERA. VERA es la única fuente de verdad. Una propiedad es visible solo si está
'active', no archivada y publicada en el canal Web (`publications['web-varela']`).
Al venderse/archivarse desaparece sola; precio/fotos/descripción reflejan el dato
actual porque se lee en cada request. Endpoints públicos (sin auth, sin datos privados)."""
import asyncio
import time

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import config
import inquiries
import web_publisher
from property_repository import property_repository
from serializers import property_to_detail, property_to_response

router = APIRouter(prefix="/public", tags=["public"])

_SUMMARY_KEYS = {
    "id", "code", "title", "type", "operation", "price", "currency", "address", "city",
    "neighborhood", "coverImage", "bedrooms", "bathrooms", "areaM2", "lotAreaM2", "rooms", "status", "radar",
    "autoStamp", "latitude", "longitude",
}
# Nunca exponer datos internos/privados al público.
_DETAIL_DROP = {
    "ownerId", "ownerObservations", "publications", "documents",
    "googlePlaceId", "formattedAddress",
}

# Estados visibles en la web pública. Mantenemos Reservada/Vendida (con sello) para
# mostrar que Varela vende y atraer leads de propietarios vendedores.
_PUBLIC_STATUSES = {"active", "reserved", "sold"}

# El listado público lo pega tráfico anónimo (bots, ads, visitantes reales) de forma
# constante; sin este cache cada request re-leía TODA la cartera y re-firmaba cada
# cover image en serie, saturando CPU. 45s es imperceptible para un humano y listo
# para seguir sirviendo rápido bajo tráfico sostenido.
_LISTINGS_CACHE_TTL = 45
_listings_cache: tuple[float, list[dict]] | None = None


def _web_published(row: dict) -> bool:
    return inquiries.is_web_published(row)


@router.get("/listings")
async def public_listings():
    global _listings_cache
    if not config.supabase_configured():
        return []
    now = time.monotonic()
    if _listings_cache and _listings_cache[0] > now:
        return _listings_cache[1]
    rows = await property_repository.list_properties(status="all")
    published = [r for r in rows if _web_published(r)]
    # Serializar + firmar la cover image en paralelo (antes era un for-loop secuencial
    # con un round-trip de firma por propiedad, el principal cuello de botella de CPU).
    responses = await asyncio.gather(*(property_to_response(r) for r in published))
    out = []
    for r, resp_model in zip(published, responses):
        resp = resp_model.model_dump(by_alias=True)
        item = {k: resp.get(k) for k in _SUMMARY_KEYS}
        item["whatsappUrl"] = inquiries.whatsapp_url(r)
        item["publicUrl"] = web_publisher.stored_public_url(r)
        item["hasVideo"] = bool(r.get("video_url"))
        out.append(item)
    _listings_cache = (now + _LISTINGS_CACHE_TTL, out)
    return out


@router.get("/listings/{property_id}")
async def public_listing(property_id: str):
    if not config.supabase_configured():
        raise HTTPException(404, "Propiedad no disponible.")
    row = await property_repository.get(property_id)
    if not row or not _web_published(row):
        raise HTTPException(404, "Propiedad no disponible.")
    detail = (await property_to_detail(row)).model_dump(by_alias=True)
    for k in _DETAIL_DROP:
        detail.pop(k, None)
    detail["whatsappUrl"] = inquiries.whatsapp_url(row)
    detail["publicUrl"] = web_publisher.stored_public_url(row)
    return detail


class InquiryRequest(BaseModel):
    property_id: str


@router.post("/inquiries")
async def create_inquiry(payload: InquiryRequest):
    """Registra la consulta por WhatsApp (evento base para Arturito) y devuelve el
    deep link de WhatsApp con el contexto de la propiedad ya precompletado."""
    if not config.supabase_configured():
        raise HTTPException(404, "Propiedad no disponible.")
    row = await property_repository.get(payload.property_id)
    if not row or not _web_published(row):
        raise HTTPException(404, "Propiedad no disponible.")
    event = await inquiries.register_inquiry(row)
    return {
        "whatsappUrl": inquiries.whatsapp_url(row),
        "publicUrl": web_publisher.stored_public_url(row),
        "inquiryId": event.get("id"),
    }
