"""VERA Studio — persistencia sincronizada del estado (`/api/studio`).

Studio (herramienta de contenido) corre embebida en el OS. Su estado — identidad,
logo y plan del mes — se guarda acá, atado al usuario (`u`), en Mongo. Así el plan
sigue al usuario entre dispositivos en lugar de quedar en el localStorage de una PC.

Claves usadas por el tool: `ev_identidad`, `ev_logo`, `ev_plan`.
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel

import config

router = APIRouter(prefix="/studio", tags=["studio"])

_client: AsyncIOMotorClient | None = None


def _col():
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(config.MONGO_URL)
    return _client[config.DB_NAME]["studio_kv"]


class KVBody(BaseModel):
    value: str | None = None


@router.get("/kv/{key}")
async def get_kv(key: str, u: str):
    doc = await _col().find_one({"_id": f"{u}:{key}"})
    return {"value": doc["value"] if doc else None}


@router.put("/kv/{key}")
async def put_kv(key: str, u: str, body: KVBody):
    await _col().update_one(
        {"_id": f"{u}:{key}"},
        {"$set": {
            "uid": u,
            "key": key,
            "value": body.value,
            "updatedAt": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    return {"ok": True}


@router.get("/state")
async def get_state(u: str):
    """Snapshot completo del estado del usuario (las 3 claves del tool)."""
    out: dict[str, str | None] = {}
    async for doc in _col().find({"uid": u}):
        out[doc["key"]] = doc.get("value")
    return out
