"""Endpoints de la App Personas (VERA Core). CRUD + relaciones (sólo lectura) +
timeline por eventos + PersonResolver (identidad única por `person_id`)."""
from typing import Optional

from fastapi import APIRouter, HTTPException

import config
from people import events, service
from people.repository import people_repository
from people.resolver import person_resolver
from schemas import (
    PersonCreate,
    PersonListItem,
    PersonResolveRequest,
    PersonResponse,
    PersonUpdate,
)

router = APIRouter(prefix="/people", tags=["people"])


def _ensure() -> None:
    if not config.supabase_configured():
        raise HTTPException(503, "Supabase no está configurado.")


def _to_response(r: dict) -> dict:
    return {
        "id": r["id"],
        "full_name": r.get("full_name", "") or "",
        "primary_phone": r.get("primary_phone") or r.get("phone", "") or "",
        "primary_email": r.get("primary_email") or r.get("email", "") or "",
        "phones": r.get("phones") or ([r["phone"]] if r.get("phone") else []),
        "emails": r.get("emails") or ([r["email"]] if r.get("email") else []),
        "document": r.get("document", "") or "",
        "notes": r.get("notes", "") or "",
        "roles": r.get("roles") or [],
        "status": r.get("status") or "active",
        "created_at": r.get("created_at"),
    }


@router.get("", response_model=list[PersonListItem])
async def list_people(role: Optional[str] = None):
    _ensure()
    rows = await people_repository.list(role)
    counts = await service.owner_counts()
    out = []
    for r in rows:
        item = _to_response(r)
        item.update(await service.enrich_list_item(r, counts))
        out.append(item)
    return out


@router.post("", response_model=PersonResponse, status_code=201)
async def create_person(payload: PersonCreate):
    _ensure()
    if not payload.full_name.strip():
        raise HTTPException(422, "El nombre es obligatorio.")
    data = payload.model_dump(exclude_none=True)
    data["full_name"] = data["full_name"].strip()
    data.setdefault("roles", ["propietario"])
    row = await people_repository.create(data, config.DEFAULT_WORKSPACE_ID)
    await events.record(row["id"], events.PERSON_CREATED, {"source": "app"})
    return _to_response(row)


@router.post("/resolve", response_model=PersonResponse)
async def resolve_person(payload: PersonResolveRequest):
    """PersonResolver: ubica (o crea) la persona por los identificadores disponibles.
    Punto de integración para Arturito / web / CRM. Devuelve la identidad única."""
    _ensure()
    result = await person_resolver.resolve(payload.model_dump(exclude_none=True))
    return _to_response(result["person"])


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


@router.get("/{person_id}/relations")
async def person_relations(person_id: str):
    """Relaciones de la persona (sólo lectura). Hoy: propiedades donde es propietario."""
    _ensure()
    if await people_repository.get(person_id) is None:
        raise HTTPException(404, "Persona no encontrada.")
    return {"properties": await service.properties_owned(person_id)}


@router.get("/{person_id}/conversations")
async def person_conversations(person_id: str):
    """Conversaciones asociadas (sólo listado, read-only). Cada una abre Arturito.
    HOY el proveedor está MOCKEADO."""
    _ensure()
    row = await people_repository.get(person_id)
    if row is None:
        raise HTTPException(404, "Persona no encontrada.")
    return {"conversations": await service.conversations_for(row)}


@router.get("/{person_id}/timeline")
async def person_timeline(person_id: str):
    _ensure()
    row = await people_repository.get(person_id)
    if row is None:
        raise HTTPException(404, "Persona no encontrada.")
    return {"events": await service.timeline_for(row)}


@router.get("/{person_id}/knowledge")
async def person_knowledge(person_id: str):
    """Lo que VERA SABE de la persona (conocimiento estructurado y acumulativo)."""
    _ensure()
    if await people_repository.get(person_id) is None:
        raise HTTPException(404, "Persona no encontrada.")
    from knowledge import service as knowledge_service

    return await knowledge_service.person_knowledge(person_id)


@router.post("/{person_id}/knowledge/learn")
async def person_knowledge_learn(person_id: str, payload: dict):
    """Aprende de un resumen de forma síncrona (útil para pruebas/backfill manual)."""
    _ensure()
    row = await people_repository.get(person_id)
    if row is None:
        raise HTTPException(404, "Persona no encontrada.")
    from knowledge import service as knowledge_service

    summary = (payload or {}).get("summary", "")
    result = await knowledge_service.learn_from_summary(
        person_id, summary, (payload or {}).get("sourceRef", "manual"),
        source="manual", person_name=row.get("full_name", ""),
    )
    result["knowledge"] = await knowledge_service.person_knowledge(person_id)
    return result
