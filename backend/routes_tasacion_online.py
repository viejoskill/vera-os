"""Tasador Online PÚBLICO (`/api/public/tasacion`): un visitante estima su propiedad
y queda capturado como Lead (vendedor) en Personas. Sin auth (herramienta pública
de captación). El detalle de la valuación interna no se expone: el visitante ve un
rango; VERA guarda el lead + evento con el contexto para el asesor."""
from __future__ import annotations

import logging

from fastapi import APIRouter
from pydantic import BaseModel

import config
import tasacion_online
from people import events
from people.resolver import person_resolver

router = APIRouter(prefix="/public/tasacion", tags=["tasacion-publica"])
logger = logging.getLogger("vera")


class EstimarBody(BaseModel):
    tipo: str = "casa"
    zona: str = "costanera"
    cubiertos: float | None = None
    lote: float | None = None
    calidad: str | None = None
    estado: str | None = None
    antiguedad: str | None = None
    ambientes: str | None = None
    vista: str | None = None
    antDepto: str | None = None
    gas: bool = False
    cloacas: bool = False
    pileta: bool = False
    quincho: bool = False
    deck: bool = False
    estacCub: bool = False
    estacDesc: bool = False
    galeria: bool = False
    # Contacto del visitante (Lead)
    nombre: str = ""
    telefono: str = ""
    email: str = ""


@router.get("/mercado")
async def mercado(tipo: str = "casa"):
    """Precio/m² promedio EN VIVO en Costa del Este (para mostrar de referencia)."""
    from mercadolibre import comparables

    return await comparables.market_pm2(tipo)


@router.post("/estimar")
async def estimar(body: EstimarBody):
    data = body.model_dump()
    result = await tasacion_online.estimar(data)

    lead_id = None
    if config.supabase_configured() and (body.telefono.strip() or body.email.strip()):
        try:
            resolved = await person_resolver.resolve({
                "full_name": body.nombre.strip(),
                "phone": body.telefono.strip(),
                "whatsapp": body.telefono.strip(),
                "email": body.email.strip(),
                "role": "vendedor",
            })
            person = resolved["person"]
            lead_id = person["id"]
            await events.record(lead_id, "TasacionSolicitada", {
                "source": "tasador-online",
                "tipo": body.tipo,
                "zona": result["zonaNombre"],
                "estMin": result["estMin"],
                "estMax": result["estMax"],
                "method": result["method"],
                "area": result["area"],
            })
        except Exception:  # noqa: BLE001
            logger.exception("Tasador online: no se pudo guardar el lead")

    result["leadSaved"] = lead_id is not None
    return result
