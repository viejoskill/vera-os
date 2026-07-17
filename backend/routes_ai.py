"""VERA content intelligence endpoints.

Reusable across content tasks via `mode`. Today implements `title`; the same
endpoint will later serve `description`, `highlights` and portal variants.
The frontend consumes this API only — it never touches the LLM.
"""
import logging

from fastapi import APIRouter, HTTPException

import ai_content_service
import config
from schemas import AiContentRequest, AiContentResponse

router = APIRouter(prefix="/ai", tags=["ai"])
logger = logging.getLogger("vera")


@router.post("/content", response_model=AiContentResponse)
async def generate_content(payload: AiContentRequest):
    if not config.ai_configured():
        raise HTTPException(503, "La IA de VERA no está configurada.")
    if payload.mode not in ai_content_service.SUPPORTED_MODES:
        raise HTTPException(422, f"Modo no soportado: {payload.mode}")
    try:
        suggestions = await ai_content_service.generate_content(
            payload.mode, payload.model_dump(by_alias=True)
        )
    except Exception as exc:  # noqa: BLE001 — surface a clean error to the UI
        logger.exception("VERA content generation failed")
        raise HTTPException(502, "VERA no pudo generar sugerencias ahora.") from exc
    return AiContentResponse(mode=payload.mode, suggestions=suggestions)
