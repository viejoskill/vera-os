"""Insights Engine — endpoints. VERA detecta y propone; el humano decide."""
import logging

from fastapi import APIRouter

from insights_engine.engine import engine

router = APIRouter(prefix="/insights", tags=["insights"])
logger = logging.getLogger("vera")


@router.get("")
async def list_insights():
    insights = await engine.detect()
    logger.info("Insights Engine: %d insights detectados", len(insights))
    return {"insights": [i.model_dump() for i in insights]}
