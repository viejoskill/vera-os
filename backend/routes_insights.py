"""Insights Engine — endpoints. VERA detecta y propone; el humano decide."""
import logging

from fastapi import APIRouter

from conversations.provider import active_conversation_provider
from insights_engine.engine import engine

router = APIRouter(prefix="/insights", tags=["insights"])
logger = logging.getLogger("vera")


@router.get("")
async def list_insights():
    insights = await engine.detect()
    by_type: dict[str, int] = {}
    for i in insights:
        by_type[i.type] = by_type.get(i.type, 0) + 1
    convs = await active_conversation_provider.list_conversations()
    active = len([c for c in convs if c.status == "open"])
    logger.info("Insights Engine: %d insights detectados", len(insights))
    return {
        "insights": [i.model_dump() for i in insights],
        "summary": {"by_type": by_type, "total": len(insights), "active_conversations": active},
    }
