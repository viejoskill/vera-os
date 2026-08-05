"""VERA Studio — persistencia sincronizada del estado (`/api/studio`).

Studio (herramienta de contenido) corre embebida en el OS. Su estado — identidad,
logo y plan del mes — se guarda acá, atado al usuario (`u`), en Mongo. Así el plan
sigue al usuario entre dispositivos en lugar de quedar en el localStorage de una PC.

Claves usadas por el tool: `ev_identidad`, `ev_logo`, `ev_plan`.
"""
from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel

import config

router = APIRouter(prefix="/studio", tags=["studio"])
logger = logging.getLogger("vera")

_client: AsyncIOMotorClient | None = None


def _col():
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(config.MONGO_URL)
    return _client[config.DB_NAME]["studio_kv"]


class KVBody(BaseModel):
    value: str | None = None


@router.get("/kv/{key}")
async def get_kv(key: str, u: str):
    doc = await _col().find_one({"_id": f"{u}:{key}"})
    return {"value": doc["value"] if doc else None}


@router.put("/kv/{key}")
async def put_kv(key: str, u: str, body: KVBody):
    await _col().update_one(
        {"_id": f"{u}:{key}"},
        {"$set": {
            "uid": u,
            "key": key,
            "value": body.value,
            "updatedAt": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    return {"ok": True}


@router.get("/state")
async def get_state(u: str):
    """Snapshot completo del estado del usuario (las 3 claves del tool)."""
    out: dict[str, str | None] = {}
    async for doc in _col().find({"uid": u}):
        out[doc["key"]] = doc.get("value")
    return out


# ===========================================================================
# CEREBRO ÚNICO — ideas y plan de contenido piensan con VERA Brain (modo Studio):
# misma identidad/voz, MISMA cartera real y MISMA memoria que el chat. Se entrena
# en un solo lugar (STUDIO_IDENTITY + memoria). Devuelve JSON estructurado para que
# la herramienta arme las placas. (Imagen/video siguen en el Worker por ahora.)
# ===========================================================================

TONOS = {
    "profesional": "Tono profesional y sobrio: autoridad técnica, datos concretos, sin exclamaciones, transmite años de experiencia. Rioplatense formal pero natural (vos, tenés).",
    "picante": "Tono picante y polémico: frases que incomodan, desafía mitos y verdades cómodas del rubro inmobiliario, provocador pero inteligente, sin insultar ni mentir. Rioplatense filoso.",
    "cercano": "Tono cercano y de barrio: coloquial rioplatense auténtico, como charlando con un vecino en la vereda, cálido, con algún guiño de humor sutil, cero acartonado.",
}


class IdeasBody(BaseModel):
    tema: str
    enfoque: str = ""
    tono: str = "profesional"
    n: int = 5


class PlanBody(BaseModel):
    n: int = 12
    tono: str = "mixto"
    foco: str = ""


def _parse_json(raw: str) -> dict:
    """Extrae JSON de la respuesta del cerebro (tolera prosa o fences ```json)."""
    txt = raw.strip()
    txt = re.sub(r"^```(?:json)?\s*|\s*```$", "", txt, flags=re.IGNORECASE).strip()
    try:
        return json.loads(txt)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", txt, re.DOTALL)
        if m:
            return json.loads(m.group(0))
        raise


async def _think(prompt: str) -> str:
    """Razona con el MISMO cerebro que el chat de Studio (identidad + cartera + memoria)."""
    from vera_brain.ai_provider import active_provider
    from vera_brain.brain import _system

    system = await _system("studio")
    return await active_provider.reason(system, prompt)


@router.post("/ideas")
async def ideas(body: IdeasBody):
    """Genera los copys de un carrusel (JSON estructurado) con el cerebro de VERA Studio."""
    if not config.ai_configured():
        raise HTTPException(503, "VERA Brain no está configurado.")
    tema = (body.tema or "").strip()
    if not tema:
        raise HTTPException(422, "Escribí el tema.")
    n = max(1, min(int(body.n or 5), 10))
    tono = TONOS.get(body.tono, TONOS["profesional"])
    prompt = (
        "TAREA (herramienta Studio, salida para placas): armá un carrusel para Instagram.\n"
        f"Tono a usar: {tono}\n"
        f"Tema: {tema}. Enfoque: {body.enfoque or 'libre'}. Cantidad de placas: {n}.\n\n"
        "Estructura: placa 1 = GANCHO fuerte que frena el scroll; placas intermedias = "
        "CONTENIDO concreto y útil; última placa = REMATE + llamado a la acción.\n"
        "Reglas de cada título: máximo 7 palabras, con saltos de línea usando \\n para ritmo "
        "visual (2-3 líneas cortas). OBLIGATORIO marcar entre *asteriscos* las 2-4 palabras del "
        "núcleo emocional (ej: \"¿Sabías que tu casa *no vale* lo que pensás?\"); NUNCA un título "
        "sin palabras marcadas. 'sec' = 1 frase corta opcional con valor real, con 1-2 palabras "
        "entre *asteriscos*. 'cta' = solo en la última placa, imperativo corto (vacío \"\" en el resto).\n"
        "No inventes cifras, porcentajes ni datos legales: si el tema los requiere, usá "
        "marcadores como [X%] para que el usuario los complete. Ortografía y tildes perfectas.\n"
        "Podés apoyarte en tu conocimiento de la cartera real y la marca si el tema lo pide.\n\n"
        f"Respondé SOLO JSON válido, sin markdown ni texto extra: "
        f'{{"slides":[{{"titulo":"...","sec":"...","cta":"..."}}]}} con exactamente {n} slides.'
    )
    try:
        data = _parse_json(await _think(prompt))
        slides = (data.get("slides") or [])[:n]
    except Exception as exc:  # noqa: BLE001
        logger.exception("studio/ideas failed")
        raise HTTPException(502, "VERA no pudo generar las ideas ahora.") from exc
    return {"slides": slides}


@router.post("/plan")
async def plan(body: PlanBody):
    """Genera el plan mensual de contenido (JSON estructurado) con el cerebro de VERA Studio."""
    if not config.ai_configured():
        raise HTTPException(503, "VERA Brain no está configurado.")
    n = max(1, min(int(body.n or 12), 31))
    tono_txt = (
        "Rotá los tonos entre profesional, picante/polémico y cercano/de barrio, indicando en "
        "cada item cuál usa."
        if body.tono == "mixto"
        else TONOS.get(body.tono, TONOS["profesional"])
    )
    prompt = (
        "TAREA (herramienta Studio, salida para calendario): armá el plan mensual de redes de la "
        "inmobiliaria.\n"
        f"{tono_txt}\n"
        "Español rioplatense, ortografía y tildes perfectas.\n"
        "MIX OBLIGATORIO aproximado: 35% carruseles educativos (3-4 placas, estilo estudio), "
        "20% posts simples UGC aspiracionales (1 placa, foto casual), 20% posts de propiedad "
        "(slot para cargar fotos reales de una propiedad activa), 15% marca personal, 10% prueba "
        "social (vendida/caso cerrado). Distribuí los días del 1 al 30 de forma pareja (si son "
        "pocos posteos, días tipo lunes-miércoles-viernes).\n"
        "Títulos: máx 7 palabras, con 2-4 palabras clave entre *asteriscos* y saltos de línea con "
        "\\n. No inventes cifras ni datos legales: usá [X%] o [dato] como marcador. Para tipo "
        "propiedad: 'titulo' y 'sec' son sugerencia de enfoque y en 'nota' indicá qué propiedad "
        "conviene elegir (podés sugerir una real de la cartera si encaja). Campo 'fondo': "
        "descripción de imagen para generar con IA acorde al tipo (escena UGC casual, o atmósfera "
        "premium para estudio); vacío para tipo propiedad.\n\n"
        f"Foco comercial del mes: {body.foco or '(libre)'}.\n\n"
        "Respondé SOLO JSON válido, sin markdown ni texto extra: "
        '{"items":[{"dia":1,"tipo":"carrusel|ugc|propiedad|personal|vendida",'
        '"tono":"profesional|picante|cercano","placas":4,"titulo":"...","sec":"...","cta":"...",'
        f'"fondo":"...","nota":"..."}}]}} con exactamente {n} items ordenados por día. '
        "CTA solo donde corresponde (última placa de carrusel o post simple)."
    )
    try:
        data = _parse_json(await _think(prompt))
        items = data.get("items") or []
    except Exception as exc:  # noqa: BLE001
        logger.exception("studio/plan failed")
        raise HTTPException(502, "VERA no pudo generar el plan ahora.") from exc
    return {"items": items}
