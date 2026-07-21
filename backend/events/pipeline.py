"""Conversation Event Pipeline — orquesta la ingesta de eventos en VERA Core.

Flujo: (1) dedupe por idempotencyKey → (2) PersonResolver (identidad única) →
(3) persistir evento inmutable en el store → (4) proyecciones (VERA Core).
Arturito sólo emite eventos; toda la lógica vive acá."""
from __future__ import annotations

from datetime import datetime, timezone

from events import projections
from events.contract import EVENT_VERSION, EventEnvelope, validate_envelope
from events.store import append, find_by_idempotency
from people.resolver import person_resolver

# Tipos que NO deben crear personas si no existen (eventos anónimos, p.ej. web).
_NO_AUTO_PERSON = {"system"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def ingest(env: EventEnvelope) -> dict:
    """Ingresa un evento estructurado. Devuelve {personId, eventId, deduped}."""
    validate_envelope(env)

    # (1) Idempotencia — si ya se procesó, devolver el existente (no duplicar).
    if env.idempotency_key:
        existing = await find_by_idempotency(env.idempotency_key)
        if existing:
            return {"personId": existing.get("personId"), "eventId": existing["id"], "deduped": True}

    # (2) PersonResolver — resolver/crear la persona desde el contacto.
    person_id = None
    contact = env.contact.model_dump(exclude_none=True)
    has_identifier = any(contact.get(k) for k in ("phone", "whatsapp", "email", "document", "crm_id"))
    if has_identifier:
        identifiers = dict(contact)
        if env.contact.name:
            identifiers["full_name"] = env.contact.name
        result = await person_resolver.resolve(identifiers)
        person_id = result["person"]["id"]

    # (3) Persistir evento INMUTABLE.
    stored = {
        "type": env.type,
        "event_version": EVENT_VERSION,
        "source": env.source,
        "person_id": person_id,
        "subject": env.subject.model_dump(exclude_none=True),
        "contact": contact,
        "payload": env.payload,
        "idempotency_key": env.idempotency_key,
        "occurred_at": env.occurred_at or _now(),
        "received_at": _now(),
    }
    event = await append(stored)

    # (4) Proyecciones — VERA Core consume el evento.
    await projections.apply({**stored, "_id": event["id"]})

    return {"personId": person_id, "eventId": event["id"], "deduped": False}


async def emit(
    event_type: str,
    source: str,
    *,
    person_id: str | None = None,
    subject: dict | None = None,
    payload: dict | None = None,
    idempotency_key: str | None = None,
    occurred_at: str | None = None,
) -> dict:
    """Atajo interno para que módulos de VERA emitan eventos ya con person_id resuelto
    (sin pasar por PersonResolver). Respeta inmutabilidad + versionado."""
    stored = {
        "type": event_type,
        "event_version": EVENT_VERSION,
        "source": source,
        "person_id": person_id,
        "subject": subject or {},
        "contact": {},
        "payload": payload or {},
        "idempotency_key": idempotency_key,
        "occurred_at": occurred_at or _now(),
        "received_at": _now(),
    }
    if idempotency_key:
        existing = await find_by_idempotency(idempotency_key)
        if existing:
            return existing
    event = await append(stored)
    await projections.apply({**stored, "_id": event["id"]})
    return event
