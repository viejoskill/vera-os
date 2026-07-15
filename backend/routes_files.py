"""File endpoints. Uploads go to private Supabase buckets via StorageService;
only metadata + object paths are stored in the DB. Reads use signed URLs."""
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

import config
from property_repository import property_repository
from schemas import DocumentResponse, ImageResponse
from serializers import document_to_response, image_to_response
from storage_service import get_storage

router = APIRouter(prefix="/properties", tags=["files"])


def _ensure() -> None:
    if not config.supabase_configured():
        raise HTTPException(503, "Supabase is not configured.")


@router.post("/{property_id}/images", response_model=ImageResponse, status_code=201)
async def upload_image(property_id: str, file: UploadFile = File(...)):
    _ensure()
    prop = await property_repository.get(property_id)
    if prop is None:
        raise HTTPException(404, "Property not found")

    existing = prop.get("property_images") or []
    workspace_id = prop.get("workspace_id", config.DEFAULT_WORKSPACE_ID)
    object_path, stored_name = get_storage().build_object_path(
        workspace_id, property_id, "images", file.filename or "image"
    )
    content = await file.read()
    await get_storage().upload(
        config.BUCKET_IMAGES, object_path, content, file.content_type or "application/octet-stream"
    )

    row = await property_repository.add_image(
        {
            "property_id": property_id,
            "workspace_id": workspace_id,
            "bucket": config.BUCKET_IMAGES,
            "object_path": object_path,
            "original_name": file.filename or stored_name,
            "stored_name": stored_name,
            "mime_type": file.content_type or "",
            "size_bytes": len(content),
            "position": len(existing),
            "is_cover": len(existing) == 0,
        }
    )
    return await image_to_response(row)


@router.post("/{property_id}/documents", response_model=DocumentResponse, status_code=201)
async def upload_document(
    property_id: str, file: UploadFile = File(...), doc_type: str = Form("plano")
):
    _ensure()
    prop = await property_repository.get(property_id)
    if prop is None:
        raise HTTPException(404, "Property not found")

    workspace_id = prop.get("workspace_id", config.DEFAULT_WORKSPACE_ID)
    object_path, stored_name = get_storage().build_object_path(
        workspace_id, property_id, "documents", file.filename or "document"
    )
    content = await file.read()
    await get_storage().upload(
        config.BUCKET_DOCUMENTS,
        object_path,
        content,
        file.content_type or "application/octet-stream",
    )

    row = await property_repository.add_document(
        {
            "property_id": property_id,
            "workspace_id": workspace_id,
            "doc_type": doc_type,
            "bucket": config.BUCKET_DOCUMENTS,
            "object_path": object_path,
            "original_name": file.filename or stored_name,
            "stored_name": stored_name,
            "mime_type": file.content_type or "",
            "size_bytes": len(content),
        }
    )
    return await document_to_response(row)


@router.patch("/{property_id}/images/{image_id}/cover", status_code=204)
async def set_cover(property_id: str, image_id: str):
    _ensure()
    image = await property_repository.get_image(image_id)
    if image is None or image.get("property_id") != property_id:
        raise HTTPException(404, "Image not found")
    await property_repository.set_cover(property_id, image_id)


@router.delete("/{property_id}/images/{image_id}", status_code=204)
async def delete_image(property_id: str, image_id: str):
    _ensure()
    image = await property_repository.get_image(image_id)
    if image is None or image.get("property_id") != property_id:
        raise HTTPException(404, "Image not found")
    await get_storage().delete(image["bucket"], image["object_path"])
    await property_repository.delete_image(image_id)


@router.delete("/{property_id}/documents/{doc_id}", status_code=204)
async def delete_document(property_id: str, doc_id: str):
    _ensure()
    doc = await property_repository.get_document(doc_id)
    if doc is None or doc.get("property_id") != property_id:
        raise HTTPException(404, "Document not found")
    await get_storage().delete(doc["bucket"], doc["object_path"])
    await property_repository.delete_document(doc_id)
