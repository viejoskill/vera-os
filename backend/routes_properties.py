"""Property CRUD endpoints. All persistence goes through SupabasePropertyRepository."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

import config
from db import get_db
from property_repository import property_repository
from schemas import PropertyCreate, PropertyDetailResponse, PropertyResponse, PropertyUpdate
from serializers import property_to_detail, property_to_response

router = APIRouter(prefix="/properties", tags=["properties"])


def _ensure_db() -> None:
    if not config.db_configured():
        raise HTTPException(503, "Database is not configured. Set DATABASE_URL.")


@router.get("", response_model=list[PropertyResponse])
async def list_properties(
    status: Optional[str] = None,
    query: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    _ensure_db()
    items = await property_repository.list(db, status=status, query=query)
    return [await property_to_response(p) for p in items]


@router.post("", response_model=PropertyDetailResponse, status_code=201)
async def create_property(payload: PropertyCreate, db: AsyncSession = Depends(get_db)):
    _ensure_db()
    prop = await property_repository.create(
        db, payload.model_dump(), workspace_id=config.DEFAULT_WORKSPACE_ID
    )
    return await property_to_detail(prop)


@router.get("/{property_id}", response_model=PropertyDetailResponse)
async def get_property(property_id: str, db: AsyncSession = Depends(get_db)):
    _ensure_db()
    prop = await property_repository.get(db, property_id)
    if prop is None:
        raise HTTPException(404, "Property not found")
    return await property_to_detail(prop)


@router.patch("/{property_id}", response_model=PropertyDetailResponse)
async def update_property(
    property_id: str, payload: PropertyUpdate, db: AsyncSession = Depends(get_db)
):
    _ensure_db()
    patch = payload.model_dump(exclude_none=True)
    prop = await property_repository.update(db, property_id, patch)
    if prop is None:
        raise HTTPException(404, "Property not found")
    return await property_to_detail(prop)


@router.delete("/{property_id}", status_code=204)
async def delete_property(property_id: str, db: AsyncSession = Depends(get_db)):
    _ensure_db()
    ok = await property_repository.delete(db, property_id)
    if not ok:
        raise HTTPException(404, "Property not found")
