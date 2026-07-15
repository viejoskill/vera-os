"""Property CRUD endpoints. All persistence goes through SupabasePropertyRepository."""
from typing import Optional

from fastapi import APIRouter, HTTPException

import config
from property_repository import property_repository
from schemas import PropertyCreate, PropertyDetailResponse, PropertyResponse, PropertyUpdate
from serializers import property_to_detail, property_to_response

router = APIRouter(prefix="/properties", tags=["properties"])


def _ensure() -> None:
    if not config.supabase_configured():
        raise HTTPException(503, "Supabase is not configured.")


@router.get("", response_model=list[PropertyResponse])
async def list_properties(status: Optional[str] = None, query: Optional[str] = None):
    _ensure()
    rows = await property_repository.list(status=status, query=query)
    return [await property_to_response(r) for r in rows]


@router.post("", response_model=PropertyDetailResponse, status_code=201)
async def create_property(payload: PropertyCreate):
    _ensure()
    prop = await property_repository.create(
        payload.model_dump(), workspace_id=config.DEFAULT_WORKSPACE_ID
    )
    if prop is None:
        raise HTTPException(500, "Could not create property")
    return await property_to_detail(prop)


@router.get("/{property_id}", response_model=PropertyDetailResponse)
async def get_property(property_id: str):
    _ensure()
    prop = await property_repository.get(property_id)
    if prop is None:
        raise HTTPException(404, "Property not found")
    return await property_to_detail(prop)


@router.patch("/{property_id}", response_model=PropertyDetailResponse)
async def update_property(property_id: str, payload: PropertyUpdate):
    _ensure()
    prop = await property_repository.update(property_id, payload.model_dump(exclude_none=True))
    if prop is None:
        raise HTTPException(404, "Property not found")
    return await property_to_detail(prop)


@router.delete("/{property_id}", status_code=204)
async def delete_property(property_id: str):
    _ensure()
    ok = await property_repository.delete(property_id)
    if not ok:
        raise HTTPException(404, "Property not found")
