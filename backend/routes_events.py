"""Endpoints del Conversation Event Pipeline.
- POST /api/events        → ingesta (contrato con Arturito/web/CRM)
- GET  /api/events        → Event Log técnico (dev/debug)
- GET  /api/events/contract → contrato vigente (tipos + versión)
"""
from typing import Optional

from fastapi import APIRouter, HTTPException

from events import pipeline, store
from events.contract import EVENT_SOURCES, EVENT_TYPES, EVENT_VERSION, EventEnvelope

router = APIRouter(prefix="/events", tags=["events"])


@router.get("/contract")
async def event_contract():
    return {
        "eventVersion": EVENT_VERSION,
        "types": sorted(EVENT_TYPES),
        "sources": sorted(EVENT_SOURCES),
    }


@router.get("")
async def list_events(
    person_id: Optional[str] = None,
    property_id: Optional[str] = None,
    type: Optional[str] = None,
    source: Optional[str] = None,
    limit: int = 100,
):
    return {"events": await store.list_events(person_id, property_id, type, source, limit)}


@router.post("", status_code=201)
async def ingest_event(envelope: EventEnvelope):
    """Contrato definitivo capa conversacional → VERA Core. Arturito sólo emite
    eventos estructurados; VERA resuelve la persona y aplica la lógica."""
    try:
        return await pipeline.ingest(envelope)
    except ValueError as e:
        raise HTTPException(422, str(e))
