"""Insights Engine — endpoints. VERA detecta y propone; el humano decide."""
import logging

from fastapi import APIRouter

from insights_engine.engine import engine
from insights_engine.repository import conversation_repository

router = APIRouter(prefix="/insights", tags=["insights"])
logger = logging.getLogger("vera")


@router.get("")
async def list_insights():
    insights = await engine.detect()
    by_type: dict[str, int] = {}
    for i in insights:
        by_type[i.type] = by_type.get(i.type, 0) + 1
    active = len([c for c in conversation_repository.list_conversations() if (c.get("status") or "open") == "open"])
    logger.info("Insights Engine: %d insights detectados", len(insights))
    return {
        "insights": [i.model_dump() for i in insights],
        "summary": {"by_type": by_type, "total": len(insights), "active_conversations": active},
    }
