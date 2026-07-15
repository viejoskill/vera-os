"""ORM -> API response mapping. Signed URLs are generated here so the frontend
receives ready-to-use, time-limited links and never touches Supabase."""
import config
from db_models import Property, PropertyDocument, PropertyImage
from schemas import DocumentResponse, ImageResponse, PropertyDetailResponse, PropertyResponse
from storage_service import get_storage


async def _sign(bucket: str, object_path: str) -> str:
    if not config.storage_configured():
        return ""
    try:
        return await get_storage().signed_url(bucket, object_path, config.SIGNED_URL_TTL_SECONDS)
    except Exception:
        return ""


async def image_to_response(image: PropertyImage) -> ImageResponse:
    return ImageResponse(
        id=image.id,
        original_name=image.original_name,
        mime_type=image.mime_type,
        size_bytes=image.size_bytes,
        position=image.position,
        is_cover=image.is_cover,
        url=await _sign(image.bucket, image.object_path),
    )


async def document_to_response(doc: PropertyDocument) -> DocumentResponse:
    return DocumentResponse(
        id=doc.id,
        doc_type=doc.doc_type,
        original_name=doc.original_name,
        mime_type=doc.mime_type,
        size_bytes=doc.size_bytes,
        url=await _sign(doc.bucket, doc.object_path),
    )


async def property_to_response(prop: Property) -> PropertyResponse:
    cover = next((i for i in prop.images if i.is_cover), None) or (
        prop.images[0] if prop.images else None
    )
    cover_url = await _sign(cover.bucket, cover.object_path) if cover else ""
    return PropertyResponse(
        id=prop.id,
        title=prop.title,
        operation=prop.operation,
        type=prop.type,
        price=prop.price,
        currency=prop.currency,
        address=prop.address,
        neighborhood=prop.neighborhood,
        city=prop.city,
        bedrooms=prop.bedrooms,
        bathrooms=prop.bathrooms,
        area_m2=prop.area_m2,
        year_built=prop.year_built,
        video_url=prop.video_url,
        status=prop.status,
        cover_image=cover_url,
        description=prop.description,
        created_at=prop.created_at,
    )


async def property_to_detail(prop: Property) -> PropertyDetailResponse:
    base = await property_to_response(prop)
    images = [await image_to_response(i) for i in prop.images]
    documents = [await document_to_response(d) for d in prop.documents]
    return PropertyDetailResponse(**base.model_dump(), images=images, documents=documents)
