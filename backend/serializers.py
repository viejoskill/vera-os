"""Row (PostgREST dict) -> API response mapping. Signed URLs are generated here so
the frontend receives ready-to-use, time-limited links and never touches Supabase."""
import config
from schemas import DocumentResponse, ImageResponse, PropertyDetailResponse, PropertyResponse, VisitResponse
from storage_service import get_storage


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
    try:
        return await get_storage().signed_url(bucket, object_path, config.SIGNED_URL_TTL_SECONDS)
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
    images = prop.get("property_images") or []
    cover = next((i for i in images if i.get("is_cover")), None) or (
        images[0] if images else None
    )
    cover_url = await _sign(cover["bucket"], cover["object_path"]) if cover else ""
    return PropertyResponse(
        id=prop["id"],
        code=_property_code(prop["id"]),
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
        archived=prop.get("archived", False) or False,
        created_at=prop["created_at"],
        updated_at=prop.get("updated_at") or prop["created_at"],
    )


async def property_to_detail(prop: dict) -> PropertyDetailResponse:
    base = await property_to_response(prop)
    images_rows = sorted(prop.get("property_images") or [], key=lambda i: i.get("position", 0))
    images = [await image_to_response(i) for i in images_rows]
    documents = [await document_to_response(d) for d in (prop.get("property_documents") or [])]
    return PropertyDetailResponse(**base.model_dump(), images=images, documents=documents)
