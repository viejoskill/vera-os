"""File endpoints. Uploads go to private Supabase buckets via StorageService;
only metadata + object paths are stored in Postgres. Reads use signed URLs."""
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

import config
from db import get_db
from db_models import PropertyDocument, PropertyImage
from property_repository import property_repository
from schemas import DocumentResponse, ImageResponse
from serializers import document_to_response, image_to_response
from storage_service import get_storage

router = APIRouter(prefix="/properties", tags=["files"])


def _ensure_ready() -> None:
    if not config.db_configured():
        raise HTTPException(503, "Database is not configured. Set DATABASE_URL.")
    if not config.storage_configured():
        raise HTTPException(503, "Storage is not configured. Set SUPABASE_URL / key.")


@router.post("/{property_id}/images", response_model=ImageResponse, status_code=201)
async def upload_image(
    property_id: str, file: UploadFile = File(...), db: AsyncSession = Depends(get_db)
):
    _ensure_ready()
    prop = await property_repository.get(db, property_id)
    if prop is None:
        raise HTTPException(404, "Property not found")

    object_path, stored_name = get_storage().build_object_path(
        prop.workspace_id, property_id, "images", file.filename or "image"
    )
    content = await file.read()
    await get_storage().upload(
        config.BUCKET_IMAGES, object_path, content, file.content_type or "application/octet-stream"
    )

    image = PropertyImage(
        property_id=property_id,
        workspace_id=prop.workspace_id,
        bucket=config.BUCKET_IMAGES,
        object_path=object_path,
        original_name=file.filename or stored_name,
        stored_name=stored_name,
        mime_type=file.content_type or "",
        size_bytes=len(content),
        position=len(prop.images),
        is_cover=len(prop.images) == 0,
    )
    await property_repository.add_image(db, image)
    return await image_to_response(image)


@router.post("/{property_id}/documents", response_model=DocumentResponse, status_code=201)
async def upload_document(
    property_id: str,
    file: UploadFile = File(...),
    doc_type: str = Form("plano"),
    db: AsyncSession = Depends(get_db),
):
    _ensure_ready()
    prop = await property_repository.get(db, property_id)
    if prop is None:
        raise HTTPException(404, "Property not found")

    object_path, stored_name = get_storage().build_object_path(
        prop.workspace_id, property_id, "documents", file.filename or "document"
    )
    content = await file.read()
    await get_storage().upload(
        config.BUCKET_DOCUMENTS,
        object_path,
        content,
        file.content_type or "application/octet-stream",
    )

    doc = PropertyDocument(
        property_id=property_id,
        workspace_id=prop.workspace_id,
        doc_type=doc_type,
        bucket=config.BUCKET_DOCUMENTS,
        object_path=object_path,
        original_name=file.filename or stored_name,
        stored_name=stored_name,
        mime_type=file.content_type or "",
        size_bytes=len(content),
    )
    await property_repository.add_document(db, doc)
    return await document_to_response(doc)


@router.delete("/{property_id}/images/{image_id}", status_code=204)
async def delete_image(property_id: str, image_id: str, db: AsyncSession = Depends(get_db)):
    _ensure_ready()
    image = await property_repository.get_image(db, image_id)
    if image is None or image.property_id != property_id:
        raise HTTPException(404, "Image not found")
    await get_storage().delete(image.bucket, image.object_path)
    await property_repository.delete_image(db, image)


@router.delete("/{property_id}/documents/{doc_id}", status_code=204)
async def delete_document(property_id: str, doc_id: str, db: AsyncSession = Depends(get_db)):
    _ensure_ready()
    doc = await property_repository.get_document(db, doc_id)
    if doc is None or doc.property_id != property_id:
        raise HTTPException(404, "Document not found")
    await get_storage().delete(doc.bucket, doc.object_path)
    await property_repository.delete_document(db, doc)
