"""Historial de conversaciones con VERA (persistente, por usuario).

VERA no tenía memoria: cada pregunta se respondía sin las anteriores. Acá guardamos
cada conversación en Mongo por (email, sessionId) para (1) darle continuidad multi-turno
al razonamiento y (2) permitir retomar charlas viejas desde la UI.
"""
from __future__ import annotations

from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorClient

import config

_client: AsyncIOMotorClient | None = None


def _col():
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(config.MONGO_URL)
    return _client[config.DB_NAME]["vera_conversations"]


def _key(email: str, session_id: str) -> str:
    return f"{(email or 'anon').lower()}:{session_id}"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def get_messages(email: str, session_id: str) -> list[dict]:
    doc = await _col().find_one({"_id": _key(email, session_id)})
    return (doc or {}).get("messages", [])


async def history_prompt(email: str, session_id: str, question: str, limit: int = 12) -> str:
    """Arma la pregunta con el historial reciente para dar continuidad multi-turno."""
    msgs = await get_messages(email, session_id)
    if not msgs:
        return question
    recent = msgs[-limit:]
    lines = [("Usuario" if m["role"] == "user" else "VERA") + ": " + m["text"] for m in recent]
    return (
        "Conversación hasta ahora (para dar continuidad; no la repitas):\n"
        + "\n".join(lines)
        + "\n\nNueva pregunta del usuario: "
        + question
    )


async def append(email: str, session_id: str, question: str, answer: str) -> None:
    now = _now()
    await _col().update_one(
        {"_id": _key(email, session_id)},
        {
            "$setOnInsert": {
                "email": (email or "anon").lower(),
                "sessionId": session_id,
                "title": question[:60],
                "createdAt": now,
            },
            "$set": {"updatedAt": now},
            "$push": {
                "messages": {
                    "$each": [
                        {"role": "user", "text": question, "at": now},
                        {"role": "vera", "text": answer, "at": now},
                    ]
                }
            },
        },
        upsert=True,
    )


async def list_conversations(email: str, limit: int = 30) -> list[dict]:
    cur = _col().find(
        {"email": (email or "anon").lower()},
        {"messages": 0},
    ).sort("updatedAt", -1).limit(limit)
    out = []
    async for d in cur:
        out.append({
            "sessionId": d.get("sessionId"),
            "title": d.get("title") or "Conversación",
            "updatedAt": d.get("updatedAt"),
        })
    return out


async def delete(email: str, session_id: str) -> None:
    await _col().delete_one({"_id": _key(email, session_id)})
