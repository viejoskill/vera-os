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
    tema: str = ""
    enfoque: str = ""
    tono: str = "profesional"
    n: int = 5
    property_id: str | None = None
    images: list[str] = []


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


async def _think(prompt: str, images: list[str] | None = None) -> str:
    """Razona con el MISMO cerebro que el chat de Studio (identidad + cartera + memoria)."""
    from vera_brain.ai_provider import active_provider
    from vera_brain.brain import _system

    system = await _system("studio")
    return await active_provider.reason(system, prompt, None, images)


async def _property_context(property_id: str) -> str:
    """Contexto de una propiedad real de la cartera para armar el carrusel sobre ella."""
    from property_repository import property_repository

    prop = await property_repository.get(property_id)
    if not prop:
        raise HTTPException(404, "Propiedad no encontrada.")
    price = prop.get("price")
    cur = prop.get("currency") or "USD"
    try:
        price_s = f"{cur} {int(float(price)):,}".replace(",", ".") if price else "a consultar"
    except (ValueError, TypeError):
        price_s = f"{cur} {price}"
    ubic = " · ".join(p for p in [prop.get("address"), prop.get("neighborhood"), prop.get("city")] if p)
    feats = []
    for key, lbl in (("bedrooms", "dorm."), ("bathrooms", "baños"), ("area_m2", "m² cubiertos"), ("lot_area_m2", "m² lote")):
        v = prop.get(key)
        if v:
            feats.append(f"{v} {lbl}")
    amen = ", ".join(prop.get("amenities") or [])
    desc = (prop.get("description") or "").strip()[:600]
    lines = [
        "PROPIEDAD REAL (base del carrusel, usá SOLO estos datos):",
        f"- Título: {prop.get('title') or '—'}",
        f"- Operación/Tipo: {prop.get('operation') or '—'} / {prop.get('type') or '—'}",
        f"- Precio: {price_s}",
        f"- Ubicación: {ubic or '—'}",
    ]
    if feats:
        lines.append(f"- Características: {', '.join(feats)}")
    if prop.get("condition") or prop.get("orientation"):
        lines.append(f"- Estado/Orientación: {prop.get('condition') or '—'} / {prop.get('orientation') or '—'}")
    if amen:
        lines.append(f"- Amenities: {amen}")
    if desc:
        lines.append(f"- Descripción: {desc}")
    return "\n".join(lines) + "\n"


@router.get("/properties")
async def studio_properties():
    """Lista compacta de propiedades activas para el selector de la herramienta."""
    if not config.supabase_configured():
        return {"properties": []}
    from property_repository import property_repository

    rows = await property_repository.list_properties()
    out = []
    for p in rows:
        if p.get("archived"):
            continue
        price = p.get("price")
        cur = p.get("currency") or "USD"
        try:
            price_s = f"{cur} {int(float(price)):,}".replace(",", ".") if price else ""
        except (ValueError, TypeError):
            price_s = ""
        ubic = p.get("neighborhood") or p.get("city") or ""
        label = " · ".join(x for x in [p.get("title") or "Propiedad", ubic, price_s] if x)
        lot = p.get("lot_area_m2") or p.get("area_m2")
        try:
            medidas = f"{int(float(lot))} m²" if lot else ""
        except (ValueError, TypeError):
            medidas = ""
        out.append({
            "id": p.get("id"),
            "label": label,
            "precio": price_s,
            "ubicacion": ubic,
            "tipo": p.get("type") or "",
            "operacion": p.get("operation") or "",
            "direccion": p.get("address") or "",
            "medidas": medidas,
        })
    return {"properties": out}


class TrainingBody(BaseModel):
    text: str = ""


@router.get("/training")
async def get_training_route():
    from vera_brain.training import get_training

    return {"text": await get_training()}


@router.put("/training")
async def put_training_route(body: TrainingBody):
    from vera_brain.training import set_training

    await set_training(body.text)
    return {"ok": True}


@router.post("/ideas")
async def ideas(body: IdeasBody):
    """Genera los copys de un carrusel (JSON estructurado) con el cerebro de VERA Studio."""
    if not config.ai_configured():
        raise HTTPException(503, "VERA Brain no está configurado.")
    tema = (body.tema or "").strip()
    prop_ctx = ""
    if body.property_id:
        prop_ctx = await _property_context(body.property_id)
    imgs = body.images or None
    if not tema and not prop_ctx and not imgs:
        raise HTTPException(422, "Escribí el tema, elegí una propiedad o subí una imagen.")
    n = max(1, min(int(body.n or 5), 10))
    tono = TONOS.get(body.tono, TONOS["profesional"])
    tema_line = (
        f"Tema: {tema}. Enfoque: {body.enfoque or 'libre'}.\n"
        if tema
        else f"Enfoque: {body.enfoque or 'destacar lo mejor de la propiedad'}.\n"
    )
    img_line = (
        "Te adjunté una o más imágenes (screenshot/foto): analizalas y usá ESE contexto como "
        "base del carrusel (lo que muestran, lo que sugieren, la propiedad/ambiente/situación).\n"
        if imgs
        else ""
    )
    prompt = (
        "TAREA (herramienta Studio, salida para placas): armá un carrusel para Instagram.\n"
        f"Tono a usar: {tono}\n"
        f"{tema_line}"
        f"{prop_ctx}"
        f"{img_line}"
        f"Cantidad de placas: {n}.\n\n"
        "Estructura: placa 1 = GANCHO fuerte que frena el scroll; placas intermedias = "
        "CONTENIDO concreto y útil; última placa = REMATE + llamado a la acción.\n"
        "Reglas de cada título: máximo 7 palabras, con saltos de línea usando \\n para ritmo "
        "visual (2-3 líneas cortas). OBLIGATORIO marcar entre *asteriscos* las 2-4 palabras del "
        "núcleo emocional (ej: \"¿Sabías que tu casa *no vale* lo que pensás?\"); NUNCA un título "
        "sin palabras marcadas. 'sec' = 1 frase corta opcional con valor real, con 1-2 palabras "
        "entre *asteriscos*. 'cta' = solo en la última placa, imperativo corto (vacío \"\" en el resto).\n"
        "No inventes cifras, porcentajes ni datos legales: si el tema los requiere, usá "
        "marcadores como [X%] para que el usuario los complete. Ortografía y tildes perfectas.\n"
        "Si te di una propiedad, el carrusel es SOBRE ella: usá sus datos reales (precio, "
        "ambientes, zona, características) y no inventes atributos que no figuran.\n\n"
        f"Respondé SOLO JSON válido, sin markdown ni texto extra: "
        f'{{"slides":[{{"titulo":"...","sec":"...","cta":"..."}}]}} con exactamente {n} slides.'
    )
    try:
        data = _parse_json(await _think(prompt, imgs))
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


class InfografiaBody(BaseModel):
    tipo: str = "auto"          # auto|piramide|pasos|comparacion|dato
    tema: str = ""
    images: list[str] = []


_INFO_SCHEMA = (
    "Formatos posibles y su JSON (llená SOLO los campos del tipo elegido):\n"
    "- piramide: {\"tipo\":\"piramide\",\"titulo\":\"...\",\"subtitulo\":\"...\","
    "\"items\":[{\"izq\":\"texto corto (puede tener \\n)\",\"der\":\"valor corto ej 5%\"}],\"nota\":\"@...\"} "
    "con 4 a 6 niveles ordenados de la punta (arriba) a la base (abajo).\n"
    "- pasos: {\"tipo\":\"pasos\",\"titulo\":\"...\",\"subtitulo\":\"...\","
    "\"items\":[{\"t\":\"título del paso\",\"d\":\"1 frase\"}],\"nota\":\"@...\"} con 3 a 5 pasos.\n"
    "- comparacion: {\"tipo\":\"comparacion\",\"titulo\":\"...\",\"subtitulo\":\"...\","
    "\"colA_titulo\":\"...\",\"colB_titulo\":\"...\",\"colA\":[\"item\",\"item\"],\"colB\":[\"item\",\"item\"],"
    "\"nota\":\"@...\"} con 3 a 4 items por columna.\n"
    "- dato: {\"tipo\":\"dato\",\"titulo\":\"...\",\"subtitulo\":\"...\",\"dato\":\"73%\","
    "\"dato_label\":\"qué significa el número\",\"items\":[{\"label\":\"...\",\"pct\":73}],\"nota\":\"@...\"} "
    "donde items son 0 a 4 barras (pct 0-100)."
)


@router.post("/infografia")
async def infografia(body: InfografiaBody):
    """Datos estructurados para una infografía educativa (JSON) con el cerebro de VERA Studio."""
    if not config.ai_configured():
        raise HTTPException(503, "VERA Brain no está configurado.")
    tema = (body.tema or "").strip()
    imgs = body.images or None
    if not tema and not imgs:
        raise HTTPException(422, "Escribí un tema o subí una infografía de referencia.")
    tipo = (body.tipo or "auto").strip().lower()
    if tipo not in ("auto", "piramide", "pasos", "comparacion", "dato"):
        tipo = "auto"
    tipo_line = (
        "Elegí vos el formato que mejor comunique el tema."
        if tipo == "auto"
        else f"Usá OBLIGATORIAMENTE el formato: {tipo}."
    )
    img_line = (
        "Te adjunté una INFOGRAFÍA DE REFERENCIA: entendé su estructura, su lógica y sus datos, y "
        "REINTERPRETALA para Varela Inmobiliaria (Costa del Este). MUY IMPORTANTE: NO la copies — "
        "cambiá el título y el enfoque, redactá todo con voz propia y adaptá los ejemplos/datos al "
        "mercado local; mantené el mismo TIPO de infografía salvo que se indique otro.\n"
        if imgs
        else ""
    )
    prompt = (
        "TAREA (herramienta Studio, salida para una INFOGRAFÍA educativa de Instagram, marca "
        "Varela Inmobiliaria): generá el CONTENIDO estructurado de una infografía clara y útil "
        "sobre el tema, pensada para educar y posicionar autoridad.\n"
        f"{tipo_line}\n"
        f"Tema: {tema or '(deducilo de la imagen de referencia)'}.\n"
        f"{img_line}"
        "Español rioplatense, ortografía y tildes perfectas. Textos MUY cortos y concretos (es una "
        "placa, no un texto largo). Títulos con gancho pero sobrios. No inventes cifras legales; los "
        "porcentajes/datos deben ser realistas y coherentes con el rubro inmobiliario. 'nota' = el "
        "usuario de Instagram, por defecto \"@varelapropiedadescde\".\n\n"
        f"{_INFO_SCHEMA}\n\n"
        "Respondé SOLO JSON válido, sin markdown ni texto extra."
    )
    try:
        data = _parse_json(await _think(prompt, imgs))
    except Exception as exc:  # noqa: BLE001
        logger.exception("studio/infografia failed")
        raise HTTPException(502, "VERA no pudo generar la infografía ahora.") from exc
    return data
