"""Property CRUD endpoints. All persistence goes through SupabasePropertyRepository."""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException

import config
from property_repository import property_repository
from schemas import (
    PropertyCreate,
    PropertyDetailResponse,
    PropertyResponse,
    PropertyUpdate,
    PublicationAction,
    VisitCreate,
    VisitResponse,
)
from serializers import property_to_detail, property_to_response, visit_to_response
from storage_service import get_storage

router = APIRouter(prefix="/properties", tags=["properties"])


def _ensure() -> None:
    if not config.supabase_configured():
        raise HTTPException(503, "Supabase is not configured.")


@router.get("", response_model=list[PropertyResponse])
async def list_properties(status: Optional[str] = None, query: Optional[str] = None):
    _ensure()
    rows = await property_repository.list_properties(status=status, query=query)
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


@router.patch("/{property_id}/archive", response_model=PropertyDetailResponse)
async def archive_property(property_id: str):
    _ensure()
    prop = await property_repository.set_archived(property_id, True)
    if prop is None:
        raise HTTPException(404, "Property not found")
    return await property_to_detail(prop)


@router.patch("/{property_id}/restore", response_model=PropertyDetailResponse)
async def restore_property(property_id: str):
    _ensure()
    prop = await property_repository.set_archived(property_id, False)
    if prop is None:
        raise HTTPException(404, "Property not found")
    return await property_to_detail(prop)


@router.get("/{property_id}/visits", response_model=list[VisitResponse])
async def list_visits(property_id: str):
    _ensure()
    rows = await property_repository.list_visits(property_id)
    return [visit_to_response(r) for r in rows]


@router.post("/{property_id}/visits", response_model=VisitResponse, status_code=201)
async def create_visit(property_id: str, payload: VisitCreate):
    _ensure()
    data = {**payload.model_dump(), "property_id": property_id}
    row = await property_repository.add_visit(data)
    if row is None:
        raise HTTPException(500, "Could not register visit")
    await property_repository.touch(property_id)
    return visit_to_response(row)


@router.post("/{property_id}/publications/{channel}", response_model=PropertyDetailResponse)
async def set_publication(property_id: str, channel: str, payload: PublicationAction):
    """Manual publication status board (no live portal API yet). VERA never publishes
    automatically — the agent operates the state; VERA only records and shows it."""
    _ensure()
    if channel not in config.ENABLED_PUBLICATION_CHANNELS:
        raise HTTPException(422, f"Canal no disponible: {channel}")
    if payload.action not in ("publish", "update", "unpublish"):
        raise HTTPException(422, f"Acción no válida: {payload.action}")

    prop = await property_repository.get(property_id)
    if prop is None:
        raise HTTPException(404, "Property not found")

    publications = dict(prop.get("publications") or {})
    if payload.action == "unpublish":
        publications[channel] = {"status": "none", "lastSync": None}
    else:  # publish | update
        publications[channel] = {
            "status": "published",
            "lastSync": datetime.now(timezone.utc).isoformat(),
        }

    updated = await property_repository.update(property_id, {"publications": publications})
    if updated is None:
        raise HTTPException(500, "Could not update publications")
    return await property_to_detail(updated)


@router.delete("/{property_id}", status_code=204)
async def delete_property(property_id: str):
    _ensure()
    prop = await property_repository.get(property_id)
    if prop is None:
        raise HTTPException(404, "Property not found")
    # Remove storage objects first so private buckets don't accumulate orphans.
    for asset in (prop.get("property_images") or []) + (prop.get("property_documents") or []):
        try:
            await get_storage().delete(asset["bucket"], asset["object_path"])
        except Exception:
            pass
    await property_repository.delete(property_id)
