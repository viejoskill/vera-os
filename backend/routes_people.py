"""Endpoints CRUD de Personas (People). Base de la App Personas."""
from typing import Optional

from fastapi import APIRouter, HTTPException

import config
from people.repository import people_repository
from schemas import PersonCreate, PersonResponse, PersonUpdate

router = APIRouter(prefix="/people", tags=["people"])


def _ensure() -> None:
    if not config.supabase_configured():
        raise HTTPException(503, "Supabase no está configurado.")


def _to_response(r: dict) -> dict:
    return {
        "id": r["id"],
        "full_name": r.get("full_name", "") or "",
        "phone": r.get("phone", "") or "",
        "email": r.get("email", "") or "",
        "notes": r.get("notes", "") or "",
        "roles": r.get("roles") or [],
        "created_at": r.get("created_at"),
    }


@router.get("", response_model=list[PersonResponse])
async def list_people(role: Optional[str] = None):
    _ensure()
    rows = await people_repository.list(role)
    return [_to_response(r) for r in rows]


@router.post("", response_model=PersonResponse, status_code=201)
async def create_person(payload: PersonCreate):
    _ensure()
    if not payload.full_name.strip():
        raise HTTPException(422, "El nombre es obligatorio.")
    data = {
        "full_name": payload.full_name.strip(),
        "phone": payload.phone.strip(),
        "email": payload.email.strip(),
        "notes": payload.notes.strip(),
        "roles": payload.roles or ["propietario"],
    }
    row = await people_repository.create(data, config.DEFAULT_WORKSPACE_ID)
    return _to_response(row)


@router.get("/{person_id}", response_model=PersonResponse)
async def get_person(person_id: str):
    _ensure()
    row = await people_repository.get(person_id)
    if row is None:
        raise HTTPException(404, "Persona no encontrada.")
    return _to_response(row)


@router.patch("/{person_id}", response_model=PersonResponse)
async def update_person(person_id: str, payload: PersonUpdate):
    _ensure()
    row = await people_repository.update(person_id, payload.model_dump(exclude_none=True, by_alias=False))
    if row is None:
        raise HTTPException(404, "Persona no encontrada.")
    return _to_response(row)
