"""Disparador del Knowledge Engine: escucha el Event Pipeline y, cuando un evento
trae un RESUMEN (típicamente lead.attended de Arturito), aprende de él.

La extracción usa el LLM (lenta/costosa) → se ejecuta en background para no
bloquear la ingesta ni el webhook. VERA aprende sin frenar la conversación."""
from __future__ import annotations

import asyncio
import logging

from events import projections
from knowledge import service

logger = logging.getLogger("vera")


async def _on_event(event: dict) -> None:
    payload = event.get("payload") or {}
    summary = (payload.get("summary") or "").strip()
    person_id = event.get("person_id") or event.get("personId")
    if not person_id or len(summary) < 15:
        return
    source_ref = payload.get("arturitoEventId") or str(event.get("_id") or event.get("id") or "")
    # Fire-and-forget: no bloquea la ingesta.
    asyncio.create_task(service.learn_from_summary(person_id, summary, source_ref))


projections.register(_on_event)
