"""Bot de PRE-ATENCIÓN de Alquileres — Fase 1 (motor + simulador, sin canal).

Reemplaza a Arturito con un cerebro NATIVO barato: Gemini Flash vía la Emergent
LLM key. El bot responde consultas (disponibilidad, precios, fotos, condiciones)
y FAQ, ofrece opciones y deja la conversación EN PAUSA para que la secretaria
cierre. No inventa datos: razona sobre el catálogo real de Vera.

El canal (WhatsApp QR / Cloud API) se enchufa después: este motor es agnóstico.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from emergentintegrations.llm.chat import LlmChat, UserMessage
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import config as appconfig
from routes_rentals import _now, _occupied, _props, _settings

router = APIRouter(prefix="/rentals/bot", tags=["rentals-bot"])

MODEL_PROVIDER = "gemini"
MODEL_NAME = "gemini-3-flash-preview"
AR_TZ = timezone(timedelta(hours=-3))


def _convos():
    return _props().database["rental_bot_convos"]


def _faq_col():
    return _props().database["rental_bot_faq"]


DEFAULT_FAQ = [
    {"q": "¿A qué hora es el check-in y el check-out?", "a": "El horario depende de cada propiedad; por lo general el check-in es a partir de las 14:00 y el check-out hasta las 10:00. Te confirmamos el horario exacto de la propiedad que elijas."},
    {"q": "¿Aceptan mascotas?", "a": "Depende de cada propiedad. Decinos con qué mascota viajás y te digo cuáles la aceptan."},
    {"q": "¿Piden depósito de garantía?", "a": "Sí, la mayoría de las propiedades pide un depósito de garantía reembolsable que se devuelve al finalizar la estadía si no hubo daños."},
    {"q": "¿Cómo se reserva?", "a": "Se abona una seña para bloquear las fechas y el saldo se completa antes o al momento del ingreso. La reserva la confirma nuestro equipo."},
    {"q": "¿Qué formas de pago aceptan?", "a": "Aceptamos transferencia, efectivo y (según el caso) Mercado Pago. El detalle te lo pasa nuestro equipo al confirmar."},
    {"q": "¿La ropa blanca está incluida?", "a": "Depende de la propiedad. Te aviso en cada opción si incluye ropa blanca (sábanas y toallas)."},
]

PERSONA = """Sos la asistente virtual de **Varela Propiedades**, especialista en alquileres temporarios en Costa del Este y la zona. Atendés por WhatsApp.

Hoy es {hoy} (hora Argentina).

TU ROL — PRE-ATENCIÓN (muy importante):
- Atendés la primera parte de la charla: entendés qué busca la persona, le ofrecés TODAS las opciones que encajan, le pasás precios aproximados y condiciones, y respondés dudas frecuentes.
- NO cerrás la reserva vos. Cuando la persona quiere avanzar/reservar, decile con calidez que en un ratito la contacta una persona del equipo para cerrar los detalles y tomar la reserva. Nunca prometas fechas confirmadas por tu cuenta.
- Sos cálida, clara y breve. Hablás en español rioplatense (vos), tono amable y profesional. Nada de relleno ni respuestas largas.

REGLAS INQUEBRANTABLES:
1. Nunca digas que sos una IA, un bot, ni menciones modelos ni proveedores. Sos la asistente de Varela Propiedades.
2. NUNCA inventes datos. Usá SOLO la información del catálogo y las condiciones de abajo. Si no tenés el dato, decilo y aclarás que lo confirma el equipo.
3. Para consultas de fechas: fijate en "Ocupado" de cada propiedad. Si las fechas pedidas se superponen con un rango ocupado, esa propiedad NO está disponible → ofrecé alternativas. Si no se superponen, decí que "en principio está disponible, sujeto a confirmación del equipo".
4. Precios: calculá el aproximado como precio/noche × cantidad de noches, aplicando el descuento por semana/quincena/mes si corresponde. Aclarás siempre que es un estimado y que el total final lo confirma el equipo.
5. Pedí los datos que falten para poder ayudar: fechas (entrada/salida), cantidad de personas, y si viajan con mascota.
6. Si preguntan por fotos, decí que se las pasás/las puede ver, e identificá la propiedad por su código (ej: {ejemplo_codigo}).

CATÁLOGO DE PROPIEDADES (datos reales de la inmobiliaria):
{catalog}

CONDICIONES GENERALES:
{condiciones}

PREGUNTAS FRECUENTES (usá estas respuestas como base):
{faq}
"""


async def _build_system() -> str:
    props = [p async for p in _props().find({"activa": True})]
    lines = []
    ejemplo = "A100"
    for p in props:
        if p.get("codigo"):
            ejemplo = p["codigo"]
        occ = await _occupied(p["_id"])
        occ_str = "; ".join(f"{o['checkIn']}→{o['checkOut']}" for o in occ) or "sin fechas ocupadas cargadas"
        lines.append(
            f"- {p.get('codigo')} · {p.get('titulo')} ({p.get('tipo')}) en {p.get('localidad')}. "
            f"Hasta {p.get('capacidad')} personas · {p.get('dormitorios')} dorm · {p.get('banos')} baños. "
            f"Precio/noche: {p.get('precioNoche')} {p.get('moneda', 'ARS')}. "
            f"Descuentos: semana {p.get('descSemana', 0)}%, quincena {p.get('descQuincena', 0)}%, mes {p.get('descMes', 0)}%. "
            f"Mascotas: {'sí' if p.get('aceptaMascotas') else 'no'}. Ropa blanca: {'incluida' if p.get('ropaBlanca') else 'no incluida'}. "
            f"Check-in {p.get('checkInHora') or 's/d'} / check-out {p.get('checkOutHora') or 's/d'}. "
            f"Estadía mínima: {p.get('estadiaMinima') or 0} noches. "
            f"Depósito de garantía: {p.get('depositoGarantia') or 0}. "
            f"Ocupado: {occ_str}."
        )
    catalog = "\n".join(lines) or "(No hay propiedades activas cargadas por el momento.)"
    s = await _settings().find_one({"_id": "global"}) or {}
    condiciones = "\n".join(f"- {c}" for c in (s.get("condicionesGenerales") or [])) or "(sin condiciones generales cargadas)"
    faq_doc = await _faq_col().find_one({"_id": "faq"}) or {"items": DEFAULT_FAQ}
    faq = "\n\n".join(f"P: {i['q']}\nR: {i['a']}" for i in faq_doc.get("items", DEFAULT_FAQ))
    hoy = datetime.now(AR_TZ).strftime("%d/%m/%Y")
    return PERSONA.format(hoy=hoy, catalog=catalog, condiciones=condiciones, faq=faq, ejemplo_codigo=ejemplo)


class SimulateBody(BaseModel):
    sessionId: str | None = None
    message: str


@router.post("/simulate")
async def simulate(body: SimulateBody):
    """Simulador de chat: probá el bot sin depender de WhatsApp. Misma lógica que
    usará el canal real. La memoria de la charla se mantiene por session_id."""
    if not appconfig.EMERGENT_LLM_KEY:
        raise HTTPException(503, "La IA no está configurada (falta EMERGENT_LLM_KEY).")
    text = (body.message or "").strip()
    if not text:
        raise HTTPException(400, "El mensaje no puede estar vacío.")
    sid = body.sessionId or f"sim-{uuid.uuid4().hex[:10]}"
    system = await _build_system()
    chat = LlmChat(
        api_key=appconfig.EMERGENT_LLM_KEY,
        session_id=f"rentbot-{sid}",
        system_message=system,
    ).with_model(MODEL_PROVIDER, MODEL_NAME)
    try:
        reply = await chat.send_message(UserMessage(text=text))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"No se pudo generar la respuesta: {e}")
    now = _now()
    await _convos().update_one(
        {"_id": sid},
        {
            "$setOnInsert": {"_id": sid, "canal": "simulador", "estado": "bot", "createdAt": now},
            "$set": {"updatedAt": now, "ultimoMensaje": text},
            "$push": {"mensajes": {"$each": [
                {"rol": "user", "texto": text, "at": now},
                {"rol": "bot", "texto": reply, "at": now},
            ]}},
        },
        upsert=True,
    )
    return {"sessionId": sid, "reply": reply}


@router.get("/faq")
async def get_faq():
    doc = await _faq_col().find_one({"_id": "faq"})
    return {"items": (doc or {}).get("items", DEFAULT_FAQ)}


class FaqBody(BaseModel):
    items: list[dict]


@router.put("/faq")
async def put_faq(body: FaqBody):
    items = [
        {"q": str(i.get("q", "")).strip(), "a": str(i.get("a", "")).strip()}
        for i in body.items if str(i.get("q", "")).strip() and str(i.get("a", "")).strip()
    ]
    await _faq_col().update_one({"_id": "faq"}, {"$set": {"items": items, "updatedAt": _now()}}, upsert=True)
    return {"items": items}
