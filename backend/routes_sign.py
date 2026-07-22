"""Firma pública — enlace seguro `/api/sign/{token}` (sin autenticación).

El firmante abre el enlace en su celular. El token identifica exactamente al
participante, vence y se invalida al firmar. Es el punto de entrada del motor de
firmas VERA-nativo (mismo token para WhatsApp / email / copiar enlace).
"""
from fastapi import APIRouter, HTTPException

import config
from documents import service
from documents.models import SignSubmitRequest

router = APIRouter(prefix="/sign", tags=["signatures"])


def _ensure() -> None:
    if not config.supabase_configured():
        raise HTTPException(503, "Supabase no está configurado.")


@router.get("/{token}")
async def view(token: str):
    """Datos del documento y del participante para firmar (marca 'visto')."""
    _ensure()
    return await service.public_sign_view(token)


@router.post("/{token}")
async def submit(token: str, body: SignSubmitRequest):
    """Firma o rechaza. Invalida el token; puede completar la firma del documento."""
    _ensure()
    return await service.submit_signature(token, body.model_dump())
