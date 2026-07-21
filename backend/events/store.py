"""Event Store — log append-only e INMUTABLE en MongoDB (colección `events`).
Fuente única de verdad de todo lo que le ocurre a personas y propiedades.
Sólo permite INSERTAR y LEER: nunca update ni delete."""
from __future__ import annotations

import logging

from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING

import config

logger = logging.getLogger("vera")

_client: AsyncIOMotorClient | None = None
_indexed = False


def _db():
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(config.MONGO_URL)
    return _client[config.DB_NAME]


async def _ensure_indexes() -> None:
    global _indexed
    if _indexed:
        return
    col = _db()["events"]
    # Dedupe: idempotency_key único cuando está presente.
    await col.create_index(
        [("idempotency_key", ASCENDING)],
        unique=True,
        partialFilterExpression={"idempotency_key": {"$type": "string"}},
        name="uniq_idempotency",
    )
    await col.create_index([("person_id", ASCENDING), ("occurred_at", DESCENDING)], name="by_person")
    await col.create_index([("subject.property_id", ASCENDING), ("occurred_at", DESCENDING)], name="by_property")
    await col.create_index([("occurred_at", DESCENDING)], name="by_time")
    _indexed = True


def _shape(doc: dict) -> dict:
    return {
        "id": str(doc.get("_id")),
        "type": doc.get("type"),
        "eventVersion": doc.get("event_version"),
        "source": doc.get("source"),
        "personId": doc.get("person_id"),
        "subject": doc.get("subject") or {},
        "contact": doc.get("contact") or {},
        "payload": doc.get("payload") or {},
        "idempotencyKey": doc.get("idempotency_key"),
        "occurredAt": doc.get("occurred_at"),
        "receivedAt": doc.get("received_at"),
    }


async def find_by_idempotency(key: str) -> dict | None:
    await _ensure_indexes()
    doc = await _db()["events"].find_one({"idempotency_key": key})
    return _shape(doc) if doc else None


async def append(event: dict) -> dict:
    """Inserta un evento inmutable. Devuelve el evento con su id."""
    await _ensure_indexes()
    res = await _db()["events"].insert_one(dict(event))
    event["_id"] = res.inserted_id
    return _shape(event)


async def list_events(
    person_id: str | None = None,
    property_id: str | None = None,
    event_type: str | None = None,
    source: str | None = None,
    limit: int = 100,
) -> list[dict]:
    await _ensure_indexes()
    q: dict = {}
    if person_id:
        q["person_id"] = person_id
    if property_id:
        q["subject.property_id"] = property_id
    if event_type:
        q["type"] = event_type
    if source:
        q["source"] = source
    cur = _db()["events"].find(q).sort("occurred_at", DESCENDING).limit(min(limit, 500))
    return [_shape(d) async for d in cur]
