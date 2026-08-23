"""Row (PostgREST dict) -> API response mapping. Signed URLs are generated here so
the frontend receives ready-to-use, time-limited links and never touches Supabase."""
import asyncio
import time

import config
from schemas import DocumentResponse, ImageResponse, PropertyDetailResponse, PropertyResponse, VisitResponse
from storage_service import get_storage

# Cache TTL de Signed URLs: {bucket/object_path: (url, expiry_monotonic)}.
_SIGN_CACHE: dict[str, tuple[str, float]] = {}


def _property_code(pid: str) -> str:
    """Stable, human-friendly internal code derived from the id (no DB column)."""
    try:
        n = int(pid.replace("-", "")[:8], 16) % 1000000
    except Exception:
        n = 0
    return f"VAR-{n:06d}"


def visit_to_response(v: dict) -> VisitResponse:
    return VisitResponse(
        id=v["id"],
        property_id=v.get("property_id", ""),
        date=v.get("date", "") or "",
        time=v.get("time", "") or "",
        interested=v.get("interested", "") or "",
        agent=v.get("agent", "") or "",
        comment=v.get("comment", "") or "",
        notify_owner=v.get("notify_owner", False) or False,
        created_at=v["created_at"],
    )


async def _sign(bucket: str, object_path: str) -> str:
    if not config.supabase_configured():
        return ""
    # Cache en memoria: las Signed URLs valen SIGNED_URL_TTL_SECONDS; reusarlas
    # evita re-firmar en cada request (lista/detalle cargan casi al instante).
    key = f"{bucket}/{object_path}"
    now = time.monotonic()
    hit = _SIGN_CACHE.get(key)
    if hit and hit[1] > now:
        return hit[0]
    try:
        url = await get_storage().signed_url(bucket, object_path, config.SIGNED_URL_TTL_SECONDS)
        _SIGN_CACHE[key] = (url, now + max(60, config.SIGNED_URL_TTL_SECONDS - 300))
        return url
    except Exception:
        return ""


async def image_to_response(img: dict) -> ImageResponse:
    return ImageResponse(
        id=img["id"],
        original_name=img.get("original_name", ""),
        mime_type=img.get("mime_type", ""),
        size_bytes=img.get("size_bytes", 0),
        position=img.get("position", 0),
        is_cover=img.get("is_cover", False),
        url=await _sign(img["bucket"], img["object_path"]),
    )


async def document_to_response(doc: dict) -> DocumentResponse:
    return DocumentResponse(
        id=doc["id"],
        doc_type=doc.get("doc_type", "plano"),
        original_name=doc.get("original_name", ""),
        mime_type=doc.get("mime_type", ""),
        size_bytes=doc.get("size_bytes", 0),
        url=await _sign(doc["bucket"], doc["object_path"]),
    )


async def property_to_response(prop: dict) -> PropertyResponse:
    import web_publisher  # deferido para evitar ciclo

    images = prop.get("property_images") or []
    cover = next((i for i in images if i.get("is_cover")), None) or (
        images[0] if images else None
    )
    cover_url = await _sign(cover["bucket"], cover["object_path"]) if cover else ""
    return PropertyResponse(
        id=prop["id"],
        code=(prop.get("codigo") or "").strip() or _property_code(prop["id"]),
        title=prop.get("title", ""),
        operation=prop.get("operation", "venta"),
        type=prop.get("type", "departamento"),
        price=prop.get("price", 0) or 0,
        currency=prop.get("currency", "USD"),
        address=prop.get("address", "") or "",
        neighborhood=prop.get("neighborhood", "") or "",
        city=prop.get("city", "") or "",
        bedrooms=prop.get("bedrooms", 0) or 0,
        bathrooms=prop.get("bathrooms", 0) or 0,
        area_m2=prop.get("area_m2", 0) or 0,
        year_built=prop.get("year_built", "") or "",
        video_url=prop.get("video_url", "") or "",
        status=prop.get("status", "active"),
        cover_image=cover_url,
        description=prop.get("description", "") or "",
        owner_id=prop.get("owner_id", "") or "",
        owner_observations=prop.get("owner_observations", "") or "",
        latitude=prop.get("latitude"),
        longitude=prop.get("longitude"),
        google_place_id=prop.get("google_place_id", "") or "",
        formatted_address=prop.get("formatted_address", "") or "",
        province=prop.get("province", "") or "",
        postal_code=prop.get("postal_code", "") or "",
        country=prop.get("country", "") or "",
        lot_area_m2=prop.get("lot_area_m2", 0) or 0,
        semi_covered_area_m2=prop.get("semi_covered_area_m2", 0) or 0,
        rooms=prop.get("rooms", 0) or 0,
        toilettes=prop.get("toilettes", 0) or 0,
        floors=prop.get("floors", 0) or 0,
        floor_number=prop.get("floor_number"),
        parking_covered=prop.get("parking_covered", 0) or 0,
        parking_uncovered=prop.get("parking_uncovered", 0) or 0,
        orientation=prop.get("orientation", "") or "",
        condition=prop.get("condition", "") or "",
        amenities=prop.get("amenities") or [],
        radar=prop.get("radar", False) or False,
        key_number=(prop.get("publications") or {}).get("keyNumber"),
        auto_stamp=(prop.get("publications") or {}).get("autoStamp", True),
        publications=prop.get("publications") or {},
        public_url=web_publisher.stored_public_url(prop),
        archived=prop.get("archived", False) or False,
        created_at=prop["created_at"],
        updated_at=prop.get("updated_at") or prop["created_at"],
    )


async def property_to_detail(prop: dict) -> PropertyDetailResponse:
    base = await property_to_response(prop)
    images_rows = sorted(prop.get("property_images") or [], key=lambda i: i.get("position", 0))
    # Firmamos imágenes y documentos en paralelo (evita el N+1 secuencial).
    images = list(await asyncio.gather(*(image_to_response(i) for i in images_rows)))
    documents = list(await asyncio.gather(
        *(document_to_response(d) for d in (prop.get("property_documents") or []))
    ))
    return PropertyDetailResponse(**base.model_dump(), images=images, documents=documents)
