"""VERA Brain — endpoints. La UI consume VERA Brain; nunca sabe que por detrás
razona Claude. El usuario siempre habla con VERA."""
import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import config
from vera_brain.brain import brain
from vera_brain.goals import Goal, goals
from vera_brain.knowledge import hub
from vera_brain.memory import MemoryEntry, memory
from vera_brain import conversations

router = APIRouter(prefix="/brain", tags=["brain"])
logger = logging.getLogger("vera")


class AskRequest(BaseModel):
    question: str
    session_id: str | None = None
    email: str | None = None


class GoalRequest(BaseModel):
    type: str = "custom"
    title: str
    subject: str = ""
    priority: str = "primary"
    scope: str = "global"
    scope_type: str = ""
    scope_id: str = ""
    meta: dict = {}


class GoalStatusRequest(BaseModel):
    status: str  # active | done | archived


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
    email = payload.email or "anon"
    session_id = payload.session_id or "default"
    try:
        # Continuidad: incluimos el historial reciente de esta conversación.
        augmented = await conversations.history_prompt(email, session_id, question)
        answer = await brain.ask(augmented, session_id)
    except Exception as exc:  # noqa: BLE001
        logger.exception("VERA Brain ask failed")
        raise HTTPException(502, "VERA no pudo responder ahora.") from exc
    try:
        await conversations.append(email, session_id, question, answer)
    except Exception:  # noqa: BLE001
        logger.exception("No se pudo guardar la conversación")
    return {"answer": answer}


@router.get("/conversations")
async def list_conversations(email: str):
    return {"conversations": await conversations.list_conversations(email)}


@router.get("/conversations/{session_id}")
async def get_conversation(session_id: str, email: str):
    return {"messages": await conversations.get_messages(email, session_id)}


@router.delete("/conversations/{session_id}")
async def delete_conversation(session_id: str, email: str):
    await conversations.delete(email, session_id)
    return {"ok": True}


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


@router.get("/goals")
async def get_goals(all: bool = False):
    """Objetivos del usuario (activos por defecto). VERA razona en función de esto."""
    items = goals.list() if all else goals.active()
    return {"goals": [g.model_dump() for g in items]}


@router.post("/goals")
async def create_goal(payload: GoalRequest):
    g = goals.set_goal(
        Goal(
            type=payload.type,
            title=payload.title,
            subject=payload.subject,
            priority=payload.priority,
            scope=payload.scope,
            scope_type=payload.scope_type,
            scope_id=payload.scope_id,
            meta=payload.meta,
        )
    )
    return {"ok": True, "goal": g.model_dump()}


@router.patch("/goals/{goal_id}")
async def update_goal(goal_id: str, payload: GoalStatusRequest):
    g = goals.set_status(goal_id, payload.status)
    if not g:
        raise HTTPException(404, "Objetivo no encontrado.")
    return {"ok": True, "goal": g.model_dump()}
