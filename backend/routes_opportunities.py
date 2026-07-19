"""Opportunity Engine — endpoints. VERA sugiere; el humano decide. Nunca envía."""
import logging

from fastapi import APIRouter

from opportunity_engine.engine import engine

router = APIRouter(prefix="/opportunities", tags=["opportunities"])
logger = logging.getLogger("vera")


@router.get("")
async def list_opportunities():
    opportunities = engine.detect()
    logger.info("Opportunity Engine: %d oportunidades detectadas", len(opportunities))
    return {"opportunities": [o.model_dump() for o in opportunities]}
