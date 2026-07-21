"""Timeline de Persona basada en EVENTOS TIPADOS (no texto plano).

La UI renderiza cada evento según su `type`. Tipos canónicos previstos:
  PersonCreated, ConversationStarted, PropertyVisited, PropertyInquiry,
  OpportunityCreated, OfferSent, PropertyReserved, PropertySold.

Hoy se persisten los eventos reales que VERA ya conoce (p.ej. PersonCreated) y se
derivan otros de fuentes disponibles (conversaciones — hoy mockeadas). Cuando existan
los módulos comerciales, sólo registran su evento acá: la UI no cambia.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorClient

import config

logger = logging.getLogger("vera")

_client: AsyncIOMotorClient | None = None

# Tipos de evento conocidos (contrato con la UI y con Arturito → VERA).
PERSON_CREATED = "PersonCreated"
CONVERSATION_STARTED = "ConversationStarted"
PROPERTY_VISITED = "PropertyVisited"
PROPERTY_INQUIRY = "PropertyInquiry"
OPPORTUNITY_CREATED = "OpportunityCreated"
OFFER_SENT = "OfferSent"
PROPERTY_RESERVED = "PropertyReserved"
PROPERTY_SOLD = "PropertySold"


def _db():
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(config.MONGO_URL)
    return _client[config.DB_NAME]


async def record(person_id: str, event_type: str, meta: dict | None = None, occurred_at: str | None = None) -> dict:
    doc = {
        "person_id": person_id,
        "type": event_type,
        "meta": meta or {},
        "occurred_at": occurred_at or datetime.now(timezone.utc).isoformat(),
    }
    try:
        res = await _db()["person_events"].insert_one(dict(doc))
        doc["id"] = str(res.inserted_id)
    except Exception:  # noqa: BLE001 — el registro es best-effort
        logger.warning("No se pudo registrar el evento %s para %s", event_type, person_id)
    return doc


async def list_for(person_id: str) -> list[dict]:
    """Eventos persistidos de la persona, más recientes primero."""
    cur = _db()["person_events"].find({"person_id": person_id})
    out = []
    async for d in cur:
        out.append({
            "id": str(d.get("_id")),
            "type": d.get("type"),
            "meta": d.get("meta") or {},
            "occurredAt": d.get("occurred_at"),
        })
    return out
