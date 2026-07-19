"""VERA Brain — endpoints. La UI consume VERA Brain; nunca sabe que por detrás
razona Claude. El usuario siempre habla con VERA."""
import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import config
from vera_brain.brain import brain
from vera_brain.knowledge import hub
from vera_brain.memory import MemoryEntry, memory

router = APIRouter(prefix="/brain", tags=["brain"])
logger = logging.getLogger("vera")


class AskRequest(BaseModel):
    question: str
    session_id: str | None = None


class RememberRequest(BaseModel):
    type: str = "context"
    subject: str = ""
    action: str = ""
    detail: str = ""
    confidence: float = 1.0
    meta: dict = {}
    note: str | None = None  # compat: si viene `note` y no `detail`, se usa como detail


@router.post("/ask")
async def ask(payload: AskRequest):
    if not config.ai_configured():
        raise HTTPException(503, "VERA Brain no está configurado.")
    question = (payload.question or "").strip()
    if not question:
        raise HTTPException(422, "Escribí una pregunta para VERA.")
    try:
        answer = await brain.ask(question, payload.session_id)
    except Exception as exc:  # noqa: BLE001
        logger.exception("VERA Brain ask failed")
        raise HTTPException(502, "VERA no pudo responder ahora.") from exc
    return {"answer": answer}


@router.get("/today")
async def today():
    if not config.ai_configured():
        raise HTTPException(503, "VERA Brain no está configurado.")
    try:
        briefing = await brain.today_briefing()
    except Exception as exc:  # noqa: BLE001
        logger.exception("VERA Brain today failed")
        raise HTTPException(502, "VERA no pudo generar el resumen ahora.") from exc
    return {"briefing": briefing}


@router.get("/sources")
async def sources():
    return {"sources": hub.sources()}


@router.get("/memory")
async def get_memory(type: str | None = None, subject: str | None = None, limit: int = 40):
    """Lo que VERA aprendió (estructurado). Filtrable por tipo y por sujeto (Personas)."""
    types = [type] if type else None
    entries = memory.recall(types=types, subject=subject, limit=limit)
    return {"memory": [e.model_dump() for e in entries]}


@router.post("/remember")
async def remember(payload: RememberRequest):
    detail = payload.detail or (payload.note or "")
    entry = memory.remember(
        MemoryEntry(
            type=payload.type,
            subject=payload.subject,
            action=payload.action,
            detail=detail,
            confidence=payload.confidence,
            meta=payload.meta,
        )
    )
    return {"ok": True, "entry": entry.model_dump()}
