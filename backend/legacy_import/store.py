"""Persistencia de la migración legacy en MongoDB:
- mapa idempotente legacy_id → property_id (permite reimportar sin duplicar);
- log completo de cada corrida para AUDITORÍA.
No toca la cartera (Supabase). El legacy_id queda como referencia histórica.
"""
from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorClient

import config

_client: AsyncIOMotorClient | None = None


def _db():
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(config.MONGO_URL)
    return _client[config.DB_NAME]


async def get_map(legacy_id: str) -> dict | None:
    return await _db()["legacy_property_map"].find_one({"legacy_id": legacy_id})


async def set_map(legacy_id: str, property_id: str, workspace_id: str) -> None:
    await _db()["legacy_property_map"].update_one(
        {"legacy_id": legacy_id},
        {"$set": {
            "legacy_id": legacy_id,
            "property_id": property_id,
            "workspace_id": workspace_id,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )


async def save_log(doc: dict) -> None:
    await _db()["legacy_migration_log"].insert_one({**doc, "_id": doc.get("job_id")})
