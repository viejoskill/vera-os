"""Timeline de Persona sobre el Event Store unificado (fuente única de verdad).

Este módulo es un envoltorio delgado sobre `events` para el dominio Personas.
Los eventos son inmutables y versionados; la UI renderiza según `type`."""
from __future__ import annotations

from events import pipeline
from events.store import list_events

# Reexport de tipos canónicos usados por el dominio Personas.
PERSON_CREATED = "PersonCreated"
CONVERSATION_STARTED = "ConversationStarted"
PROPERTY_VISITED = "PropertyVisited"
PROPERTY_INQUIRY = "PropertyInquiry"
OPPORTUNITY_CREATED = "OpportunityCreated"
OFFER_SENT = "OfferSent"
PROPERTY_RESERVED = "PropertyReserved"
PROPERTY_SOLD = "PropertySold"


async def record(person_id: str, event_type: str, meta: dict | None = None, occurred_at: str | None = None) -> dict:
    """Emite un evento asociado a una persona (source=app)."""
    return await pipeline.emit(
        event_type,
        source="app",
        person_id=person_id,
        payload=meta or {},
        occurred_at=occurred_at,
    )


async def list_for(person_id: str) -> list[dict]:
    """Eventos de la persona (más recientes primero) desde el store unificado."""
    events = await list_events(person_id=person_id, limit=200)
    return [
        {"id": e["id"], "type": e["type"], "meta": e.get("payload") or {}, "occurredAt": e.get("occurredAt")}
        for e in events
    ]
