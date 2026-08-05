"""Entrenamiento editable de VERA Studio (single-tenant Varela).

Texto de personalización que el equipo edita desde la UI (panel de entrenamiento) y
que se inyecta en el system prompt de VERA en modo Studio. Así se afina la voz/estilo
en un solo lugar y aplica tanto al chat como a la herramienta Studio (cerebro único).
"""
from __future__ import annotations

from motor.motor_asyncio import AsyncIOMotorClient

import config

_client: AsyncIOMotorClient | None = None
_DOC_ID = "studio_training"


def _col():
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(config.MONGO_URL)
    return _client[config.DB_NAME]["studio_config"]


async def get_training() -> str:
    doc = await _col().find_one({"_id": _DOC_ID})
    return (doc or {}).get("text", "") or ""


async def set_training(text: str) -> None:
    await _col().update_one(
        {"_id": _DOC_ID}, {"$set": {"text": text or ""}}, upsert=True
    )
