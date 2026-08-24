"""Bot de PRE-ATENCIÓN de Alquileres — Fase 1 (motor + simulador, sin canal).

Reemplaza a Arturito con un cerebro NATIVO barato: Gemini Flash vía la Emergent
LLM key. El bot responde consultas (disponibilidad, precios, fotos, condiciones)
y FAQ, ofrece opciones y deja la conversación EN PAUSA para que la secretaria
cierre. No inventa datos: razona sobre el catálogo real de Vera.

El canal (WhatsApp QR / Cloud API) se enchufa después: este motor es agnóstico.
"""
from __future__ import annotations

import asyncio
import json
import uuid
from datetime import datetime, time, timedelta, timezone

from emergentintegrations.llm.chat import LlmChat, UserMessage
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import config as appconfig
from property_repository import property_repository
from routes_rentals import _now, _occupied, _props, _settings

router = APIRouter(prefix="/rentals/bot", tags=["rentals-bot"])

MODEL_PROVIDER = "gemini"
MODEL_NAME = "gemini-3-flash-preview"
AR_TZ = timezone(timedelta(hours=-3))


def _convos():
    return _props().database["rental_bot_convos"]


def _faq_col():
    return _props().database["rental_bot_faq"]


def _config_col():
    return _props().database["rental_bot_config"]


def _contacts_col():
    return _props().database["rental_bot_contacts"]


DEFAULT_CONFIG = {
    "nombre": "Vera",
    "saludo": "¡Hola! Soy Vera, la asistente de Varela Propiedades 👋",
    "tono": "Cálida, cercana y profesional. Español rioplatense (trato de vos). Respuestas breves y claras, sin relleno.",
    "estilo": "conversacional",  # varias burbujas cortas
    "alquileresActivo": True,
    "ventasActivo": True,
    "derivaAlquileres": "Mariana",
    "derivaVentas": "Sebastián",
    "datosFijos": "",
}

SUGGESTED_RULES = [
    'Nunca digas "dame un momento", "te busco", "ya te paso" ni "dejame ver": respondé directo con lo que tenés.',
    "Antes de mostrar una propiedad, usá el precio y la disponibilidad reales del catálogo. Si un dato no está, decí que lo confirma el equipo; nunca lo inventes.",
    "Nunca inventes precios, direcciones, medidas, disponibilidad ni condiciones.",
    "Hacé una sola pregunta por turno. Podés usar varias burbujas cortas, pero pedí un dato a la vez.",
    "Para alquileres y administración, derivá con Mariana. Para ventas y tasaciones, derivá con Sebastián.",
    "Si el cliente quiere vender o tasar su propiedad, no lo trates como comprador: derivá con Sebastián.",
    "Si te preguntan si sos una persona o un bot, respondé con naturalidad que sos la asistente de Varela Propiedades.",
    "Cuando pregunten por lotes o terrenos, no preguntes cantidad de personas ni fechas de estadía.",
    "Si el mensaje es una propuesta comercial, publicidad o spam, agradecé con cortesía y no sigas una conversación de venta/alquiler.",
]


DEFAULT_FAQ = [
    {"q": "¿A qué hora es el check-in y el check-out?", "a": "El horario depende de cada propiedad; por lo general el check-in es a partir de las 14:00 y el check-out hasta las 10:00. Te confirmamos el horario exacto de la propiedad que elijas."},
    {"q": "¿Aceptan mascotas?", "a": "Depende de cada propiedad. Decinos con qué mascota viajás y te digo cuáles la aceptan."},
    {"q": "¿Piden depósito de garantía?", "a": "Sí, la mayoría de las propiedades pide un depósito de garantía reembolsable que se devuelve al finalizar la estadía si no hubo daños."},
    {"q": "¿Cómo se reserva?", "a": "Se abona una seña para bloquear las fechas y el saldo se completa antes o al momento del ingreso. La reserva la confirma nuestro equipo."},
    {"q": "¿Qué formas de pago aceptan?", "a": "Aceptamos transferencia, efectivo y (según el caso) Mercado Pago. El detalle te lo pasa nuestro equipo al confirmar."},
    {"q": "¿La ropa blanca está incluida?", "a": "Depende de la propiedad. Te aviso en cada opción si incluye ropa blanca (sábanas y toallas)."},
]

PERSONA = """Sos {nombre}, la asistente virtual de **Varela Propiedades** (alquileres temporarios y ventas en Costa del Este y la zona). Atendés por WhatsApp.

Tu saludo de presentación es: "{saludo}"
Tu tono: {tono}
Estilo: respuestas breves; podés dividir en varias burbujas cortas, como en un chat real.

Hoy es {hoy} (hora Argentina).

TU ROL — PRE-ATENCIÓN (muy importante):
- Atendés la PRIMERA parte de la charla, tanto para ALQUILERES como para VENTAS: entendés qué busca la persona, le ofrecés las opciones que encajan (con datos reales) y respondés dudas.
- NO cerrás vos. Cuando la persona quiere avanzar: en ALQUILERES y administración derivás con **{deriva_alq}**; en VENTAS y tasaciones derivás con **{deriva_ven}**. Decilo con calidez ("en un ratito te contacta {deriva_alq}/{deriva_ven} para cerrar los detalles").

REGLAS INQUEBRANTABLES:
1. Nunca digas que sos una IA, un bot ni menciones modelos/proveedores. Sos {nombre}, de Varela Propiedades.
2. NUNCA inventes datos. Usá SOLO el catálogo, las condiciones, la FAQ y los datos fijos de abajo. Si no tenés algo, decilo y aclarás que lo confirma el equipo.
3. Para fechas de alquiler: mirá "Ocupado" de cada propiedad. Si se superpone con lo pedido, esa propiedad NO está disponible → ofrecé alternativas. Si no se superpone, decí "en principio disponible, sujeto a confirmación".
4. Precios de alquiler: aproximá precio/noche × noches, aplicando el descuento por semana/quincena/mes. Siempre aclarás que es estimado y que el total lo confirma el equipo.
5. Pedí un dato por vez (fechas, personas, mascota) — no todo junto.
6. Si preguntan por fotos/links, ofrecé pasarlas e identificá la propiedad por su código (ej: {ejemplo_codigo}).

REGLAS ADICIONALES (definidas por el equipo):
{reglas}
{contacto}

===== CATÁLOGO DE ALQUILERES (datos reales) =====
{catalog}
{ventas}

===== CONDICIONES GENERALES =====
{condiciones}

===== DATOS FIJOS (teléfonos, horarios, formas de pago, links, políticas) =====
{datos}

===== PREGUNTAS FRECUENTES =====
{faq}
"""


async def _get_config() -> dict:
    doc = await _config_col().find_one({"_id": "config"}) or {}
    cfg = {**DEFAULT_CONFIG, **{k: v for k, v in doc.items() if k != "_id"}}
    if "reglas" not in cfg:
        cfg["reglas"] = [{"id": str(i), "texto": t, "activa": True} for i, t in enumerate(SUGGESTED_RULES)]
    return cfg


async def _ventas_catalog() -> str:
    try:
        rows = await property_repository.list_properties(status="active")
    except Exception:
        return "(no se pudo cargar el catálogo de ventas)"
    lines = []
    for r in rows[:60]:
        pubs = r.get("publications") or {}
        cod = pubs.get("code") or r.get("codigo") or ""
        op = r.get("operation") or ""
        if op and "alq" in str(op).lower():
            continue  # los alquileres los maneja el catálogo de arriba
        price = r.get("price")
        cur = r.get("currency") or "USD"
        zona = r.get("neighborhood") or r.get("city") or ""
        lines.append(
            f"- {cod} · {r.get('title') or 'Propiedad'} ({r.get('type') or ''}, {op}) en {zona}. "
            f"{r.get('bedrooms') or 0} dorm · {r.get('bathrooms') or 0} baños. "
            f"Precio: {price} {cur}."
        )
    return "\n".join(lines) or "(sin propiedades de venta activas)"


async def _known_contact(phone: str | None) -> dict | None:
    if not phone:
        return None
    digits = "".join(ch for ch in phone if ch.isdigit())[-8:]  # últimos 8 dígitos
    if not digits:
        return None
    async for c in _contacts_col().find({}):
        cd = "".join(ch for ch in str(c.get("telefono") or "") if ch.isdigit())
        if cd and cd.endswith(digits):
            return c
    return None


async def _build_system(from_phone: str | None = None, role_override: str | None = None) -> str:
    cfg = await _get_config()
    # --- Contacto conocido: modo NO comercial --------------------------------
    if role_override in ("propietario", "limpieza", "tecnico"):
        contacto = {"nombre": "(contacto de prueba)", "rol": role_override, "nota": ""}
    else:
        contacto = await _known_contact(from_phone)
    contacto_bloque = ""
    if contacto:
        rol_map = {"propietario": "propietario/a de una propiedad", "limpieza": "del personal de limpieza",
                   "tecnico": "de servicio técnico/mantenimiento", "otro": "un contacto conocido del equipo"}
        rol = rol_map.get(contacto.get("rol"), "un contacto conocido del equipo")
        contacto_bloque = (
            f"\n\n===== ⚠️ CONTACTO CONOCIDO — MODO NO COMERCIAL =====\n"
            f"Estás hablando con {contacto.get('nombre') or 'un contacto conocido'}, que es {rol}. "
            f"NO le ofrezcas alquileres, ventas ni propiedades. NO le pidas fechas ni cantidad de personas. "
            f"Atendé directo el tema que traiga (coordinación, mantenimiento, pagos, limpieza, llaves, etc.), "
            f"de forma cordial y al grano. Si hace falta, derivá con {cfg['derivaAlquileres']} (alquileres/administración) "
            f"o {cfg['derivaVentas']} (ventas). Nota interna del contacto: {contacto.get('nota') or '—'}."
        )

    # --- Catálogo de alquileres (datos reales) -------------------------------
    lines = []
    ejemplo = "A100"
    if cfg.get("alquileresActivo", True):
        props = [p async for p in _props().find({"activa": True})]
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
                f"Estadía mínima: {p.get('estadiaMinima') or 0} noches. Depósito: {p.get('depositoGarantia') or 0}. "
                f"Ocupado: {occ_str}."
            )
    catalog = "\n".join(lines) or "(No hay propiedades de alquiler activas cargadas.)"

    # --- Catálogo de ventas (opcional) ---------------------------------------
    ventas_bloque = ""
    if cfg.get("ventasActivo", True):
        ventas_bloque = (
            "\n\n===== CATÁLOGO DE VENTAS (pre-atendé y SIEMPRE derivá con "
            f"{cfg['derivaVentas']} para cerrar) =====\n" + await _ventas_catalog()
        )

    # --- Reglas activas ------------------------------------------------------
    reglas = [r["texto"] for r in cfg.get("reglas", []) if r.get("activa")]
    reglas_str = "\n".join(f"- {t}" for t in reglas) or "(sin reglas adicionales)"

    # --- Conocimiento --------------------------------------------------------
    s = await _settings().find_one({"_id": "global"}) or {}
    condiciones = "\n".join(f"- {c}" for c in (s.get("condicionesGenerales") or [])) or "(sin condiciones generales)"
    faq_doc = await _faq_col().find_one({"_id": "faq"}) or {"items": DEFAULT_FAQ}
    faq = "\n\n".join(f"P: {i['q']}\nR: {i['a']}" for i in faq_doc.get("items", DEFAULT_FAQ))
    datos = (cfg.get("datosFijos") or "").strip() or "(sin datos fijos cargados)"
    hoy = datetime.now(AR_TZ).strftime("%d/%m/%Y")

    return PERSONA.format(
        nombre=cfg["nombre"], saludo=cfg["saludo"], tono=cfg["tono"],
        deriva_alq=cfg["derivaAlquileres"], deriva_ven=cfg["derivaVentas"],
        hoy=hoy, catalog=catalog, ventas=ventas_bloque, reglas=reglas_str,
        condiciones=condiciones, faq=faq, datos=datos, ejemplo_codigo=ejemplo,
        contacto=contacto_bloque,
    )


class SimulateBody(BaseModel):
    sessionId: str | None = None
    message: str
    fromPhone: str | None = None
    role: str | None = None


@router.post("/simulate")
async def simulate(body: SimulateBody):
    """Simulador de chat: probá el bot sin depender de WhatsApp. `fromPhone` opcional
    permite simular que escribe un contacto conocido (propietario/limpieza/técnico)."""
    if not appconfig.EMERGENT_LLM_KEY:
        raise HTTPException(503, "La IA no está configurada (falta EMERGENT_LLM_KEY).")
    text = (body.message or "").strip()
    if not text:
        raise HTTPException(400, "El mensaje no puede estar vacío.")
    sid = body.sessionId or f"sim-{uuid.uuid4().hex[:10]}"
    system = await _build_system(from_phone=body.fromPhone, role_override=body.role)
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


# --------------------------------------------------------------------------- #
# Configuración / entrenamiento del bot                                        #
# --------------------------------------------------------------------------- #
@router.get("/config")
async def get_config():
    cfg = await _get_config()
    contacts = [
        {**{k: v for k, v in c.items() if k != "_id"}, "id": str(c["_id"])}
        async for c in _contacts_col().find({})
    ]
    faq_doc = await _faq_col().find_one({"_id": "faq"}) or {"items": DEFAULT_FAQ}
    return {"config": cfg, "contactos": contacts, "faq": faq_doc.get("items", DEFAULT_FAQ),
            "reglasSugeridas": SUGGESTED_RULES}


class ConfigBody(BaseModel):
    nombre: str | None = None
    saludo: str | None = None
    tono: str | None = None
    estilo: str | None = None
    alquileresActivo: bool | None = None
    ventasActivo: bool | None = None
    derivaAlquileres: str | None = None
    derivaVentas: str | None = None
    datosFijos: str | None = None
    reglas: list[dict] | None = None


@router.put("/config")
async def put_config(body: ConfigBody):
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    if "reglas" in patch:
        patch["reglas"] = [
            {"id": str(r.get("id") or uuid.uuid4().hex[:6]),
             "texto": str(r.get("texto", "")).strip(),
             "activa": bool(r.get("activa", True))}
            for r in patch["reglas"] if str(r.get("texto", "")).strip()
        ]
    patch["updatedAt"] = _now()
    await _config_col().update_one({"_id": "config"}, {"$set": patch}, upsert=True)
    return await _get_config()


@router.post("/rules/seed")
async def seed_rules():
    """Carga las reglas sugeridas (buenas prácticas) sin pisar las que ya existan."""
    cfg = await _get_config()
    existentes = {r["texto"] for r in cfg.get("reglas", [])}
    reglas = list(cfg.get("reglas", []))
    for t in SUGGESTED_RULES:
        if t not in existentes:
            reglas.append({"id": uuid.uuid4().hex[:6], "texto": t, "activa": True})
    await _config_col().update_one({"_id": "config"}, {"$set": {"reglas": reglas, "updatedAt": _now()}}, upsert=True)
    return {"reglas": reglas}


class ContactBody(BaseModel):
    nombre: str
    telefono: str
    rol: str = "otro"  # propietario | limpieza | tecnico | otro
    nota: str | None = ""


@router.post("/contacts")
async def add_contact(body: ContactBody):
    doc = {"_id": uuid.uuid4().hex, "nombre": body.nombre.strip(),
           "telefono": body.telefono.strip(), "rol": body.rol,
           "nota": (body.nota or "").strip(), "createdAt": _now()}
    await _contacts_col().insert_one(doc)
    return {**{k: v for k, v in doc.items() if k != "_id"}, "id": doc["_id"]}


@router.delete("/contacts/{contact_id}")
async def delete_contact(contact_id: str):
    await _contacts_col().delete_one({"_id": contact_id})
    return {"ok": True}


# --------------------------------------------------------------------------- #
# Fase 2 — Bandeja + Resúmenes de turno con semáforo de urgencia               #
# --------------------------------------------------------------------------- #
def _digests_col():
    return _props().database["rental_bot_digests"]


def _turno_bounds(turno: str, ref_ar: datetime) -> tuple[datetime, datetime]:
    d = ref_ar.date()
    if turno == "manana":  # desde el cierre de ayer (16:30) hasta la apertura (09:30)
        start = datetime.combine(d - timedelta(days=1), time(16, 30), AR_TZ)
        end = datetime.combine(d, time(9, 30), AR_TZ)
    else:  # tarde: 13:00 → 16:30
        start = datetime.combine(d, time(13, 0), AR_TZ)
        end = datetime.combine(d, time(16, 30), AR_TZ)
    return start, end


CLASIFICADOR = """Sos un clasificador de conversaciones de una inmobiliaria (alquileres y ventas).
Para CADA conversación, devolvé su nivel de urgencia y un resumen de 1 línea.

Semáforo:
- "roja": el cliente está listo para avanzar/reservar/comprar, dejó datos, pidió algo con fecha inminente o quedó esperando respuesta. Necesita atención YA.
- "amarilla": consulta activa que conviene seguir pronto (pidió info, está evaluando).
- "verde": ya resuelto, sin acción pendiente, o spam/publicidad.

Respondé SOLO un JSON válido, sin texto extra, con esta forma:
[{"sessionId":"...","urgencia":"roja|amarilla|verde","resumen":"...", "accion":"qué hacer en 1 frase"}]
"""


async def _clasificar(convos: list[dict]) -> dict:
    if not convos or not appconfig.EMERGENT_LLM_KEY:
        return {}
    bloques = []
    for c in convos:
        msgs = (c.get("mensajes") or [])[-8:]
        tx = "\n".join(f"{'Cliente' if m.get('rol') == 'user' else 'Vera'}: {m.get('texto', '')}" for m in msgs)
        bloques.append(f"### Conversación {c['_id']} (canal: {c.get('canal', '?')})\n{tx}")
    prompt = "Clasificá estas conversaciones:\n\n" + "\n\n".join(bloques)
    chat = LlmChat(api_key=appconfig.EMERGENT_LLM_KEY, session_id=f"digest-{uuid.uuid4().hex[:8]}",
                   system_message=CLASIFICADOR).with_model(MODEL_PROVIDER, MODEL_NAME)
    try:
        raw = await chat.send_message(UserMessage(text=prompt))
        s = raw.strip()
        if s.startswith("```"):
            s = s.split("```")[1].replace("json", "", 1).strip()
        data = json.loads(s)
        return {str(i.get("sessionId")): i for i in data if i.get("sessionId")}
    except Exception:  # noqa: BLE001
        return {}


async def _generar_digest(turno: str | None = None) -> dict:
    now_ar = datetime.now(AR_TZ)
    if turno in ("manana", "tarde"):
        # Programado: ventana fija del turno.
        start, end = _turno_bounds(turno, now_ar)
        if end > now_ar:
            end = now_ar
        label = "Turno mañana (apertura 09:30)" if turno == "manana" else "Turno tarde (16:30)"
        doc_id = f"{turno}-{now_ar.strftime('%Y%m%d')}"
    else:
        # Manual ("generar ahora"): desde el último resumen (o últimas 24 h) hasta ahora.
        turno = "manual"
        last = await _digests_col().find_one({}, sort=[("generadoAt", -1)])
        if last and last.get("rango", {}).get("hasta"):
            start = datetime.fromisoformat(last["rango"]["hasta"]).astimezone(AR_TZ)
        else:
            start = now_ar - timedelta(hours=24)
        end = now_ar
        label = f"Resumen al {now_ar.strftime('%d/%m %H:%M')}"
        doc_id = f"manual-{now_ar.strftime('%Y%m%d%H%M%S')}"
    start_iso = start.astimezone(timezone.utc).isoformat()
    end_iso = end.astimezone(timezone.utc).isoformat()
    convos = [c async for c in _convos().find(
        {"updatedAt": {"$gte": start_iso, "$lte": end_iso}}
    ).sort("updatedAt", 1)]
    clasif = await _clasificar(convos)
    orden = {"roja": 0, "amarilla": 1, "verde": 2}
    items = []
    for c in convos:
        info = clasif.get(str(c["_id"]), {})
        urg = info.get("urgencia", "amarilla")
        item = {
            "sessionId": c["_id"], "canal": c.get("canal", "whatsapp"),
            "urgencia": urg if urg in orden else "amarilla",
            "resumen": info.get("resumen") or (c.get("ultimoMensaje") or "")[:120],
            "accion": info.get("accion", ""),
            "ultimoMensaje": c.get("ultimoMensaje", ""),
            "updatedAt": c.get("updatedAt"),
        }
        items.append(item)
        await _convos().update_one({"_id": c["_id"]}, {"$set": {"urgencia": item["urgencia"], "resumen": item["resumen"]}})
    items.sort(key=lambda x: orden.get(x["urgencia"], 1))
    counts = {"roja": 0, "amarilla": 0, "verde": 0}
    for it in items:
        counts[it["urgencia"]] = counts.get(it["urgencia"], 0) + 1
    doc = {
        "_id": doc_id,
        "turno": turno, "label": label, "generadoAt": _now(),
        "rango": {"desde": start_iso, "hasta": end_iso},
        "counts": counts, "total": len(items), "items": items,
    }
    await _digests_col().update_one({"_id": doc["_id"]}, {"$set": doc}, upsert=True)
    return doc


@router.post("/digest/generate")
async def generate_digest(turno: str | None = None):
    return await _generar_digest(turno)


@router.get("/digests")
async def list_digests(limit: int = 10):
    docs = [d async for d in _digests_col().find({}).sort("generadoAt", -1).limit(limit)]
    return {"digests": docs}


@router.get("/conversations")
async def list_conversations(limit: int = 50):
    docs = [c async for c in _convos().find({}).sort("updatedAt", -1).limit(limit)]
    out = []
    for c in docs:
        out.append({
            "id": c["_id"], "canal": c.get("canal", "whatsapp"),
            "estado": c.get("estado", "pendiente"),
            "urgencia": c.get("urgencia", "amarilla"),
            "resumen": c.get("resumen", ""),
            "ultimoMensaje": c.get("ultimoMensaje", ""),
            "updatedAt": c.get("updatedAt"),
            "mensajes": (c.get("mensajes") or [])[-12:],
        })
    return {"conversaciones": out}


class EstadoBody(BaseModel):
    estado: str  # pendiente | resuelto


@router.patch("/conversations/{sid}")
async def set_estado(sid: str, body: EstadoBody):
    await _convos().update_one({"_id": sid}, {"$set": {"estado": body.estado, "updatedAt": _now()}})
    return {"ok": True, "estado": body.estado}


# --- Scheduler liviano: dispara los resúmenes 09:30 y 16:30 (hora AR) -------- #
async def _scheduler_loop():
    while True:
        try:
            now = datetime.now(AR_TZ)
            hoy = now.strftime("%Y%m%d")
            marca = _props().database["rental_bot_sched"]
            for turno, h, m in (("manana", 9, 30), ("tarde", 16, 30)):
                if now.hour == h and m <= now.minute < m + 10:
                    done = await marca.find_one({"_id": f"{turno}-{hoy}"})
                    if not done:
                        await _generar_digest(turno)
                        await marca.update_one({"_id": f"{turno}-{hoy}"}, {"$set": {"at": _now()}}, upsert=True)
        except Exception:  # noqa: BLE001
            pass
        await asyncio.sleep(300)


def start_scheduler():
    try:
        asyncio.get_event_loop().create_task(_scheduler_loop())
    except RuntimeError:
        pass
