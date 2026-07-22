"""Notificaciones in-app de VERA (colección Mongo `notifications`).

Aviso liviano y nativo (sin proveedores externos): cuando un cliente firma un
documento, VERA crea una notificación que el asesor ve en la campanita 🔔.
La arquitectura queda lista para sumar email/WhatsApp como canales adicionales.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorClient

import config

_client: AsyncIOMotorClient | None = None


def _col():
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(config.MONGO_URL)
    return _client[config.DB_NAME]["notifications"]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def create(*, type: str, title: str, message: str,
                 document_id: str | None = None, link: str | None = None) -> dict:
    doc = {
        "id": str(uuid.uuid4()),
        "type": type,
        "title": title,
        "message": message,
        "documentId": document_id,
        "link": link,
        "read": False,
        "createdAt": _now(),
    }
    await _col().insert_one({**doc, "_id": doc["id"]})
    return doc


async def list_recent(limit: int = 30) -> list[dict]:
    cur = _col().find({}, {"_id": 0}).sort("createdAt", -1).limit(limit)
    return [d async for d in cur]


async def unread_count() -> int:
    return await _col().count_documents({"read": False})


async def mark_read(notification_id: str) -> None:
    await _col().update_one({"id": notification_id}, {"$set": {"read": True}})


async def mark_all_read() -> None:
    await _col().update_many({"read": False}, {"$set": {"read": True}})
