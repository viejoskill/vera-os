"""VERA Brain — endpoints. La UI consume VERA Brain; nunca sabe que por detrás
razona Claude. El usuario siempre habla con VERA."""
import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import config
from vera_brain.brain import brain
from vera_brain.knowledge import hub
from vera_brain.memory import memory

router = APIRouter(prefix="/brain", tags=["brain"])
logger = logging.getLogger("vera")


class AskRequest(BaseModel):
    question: str
    session_id: str | None = None


class RememberRequest(BaseModel):
    note: str
    kind: str = "note"


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


@router.post("/remember")
async def remember(payload: RememberRequest):
    memory.remember(payload.note, payload.kind)
    return {"ok": True}
