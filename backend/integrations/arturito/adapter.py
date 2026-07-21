"""ArturitoWebhookAdapter — traduce los webhooks de Arturito al Conversation
Adapter Contract de VERA.

Flujo: Arturito POST → verificar firma HMAC-SHA256 → parsear el lead → construir
EventEnvelope(s) canónicos → `pipeline.ingest` (que resuelve la persona, persiste
el evento inmutable y dispara las proyecciones de VERA Core: Leads/Oportunidades/
Tareas). Arturito NUNCA conoce a VERA Core; sólo emite su webhook."""
from __future__ import annotations

import hashlib
import hmac
import logging
from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorClient

import config
from events import pipeline
from events.contract import EventContact, EventEnvelope, EventSubject

logger = logging.getLogger("vera")

_client: AsyncIOMotorClient | None = None


def _db():
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(config.MONGO_URL)
    return _client[config.DB_NAME]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# --- Firma HMAC-SHA256 ------------------------------------------------------ #
def verify_signature(raw_body: bytes, signature_header: str | None) -> bool:
    """Valida `X-Arturito-Signature` = HMAC-SHA256(secret, body_crudo).
    Acepta el header como hex crudo o con prefijo (ej. `sha256=<hex>`)."""
    secret = config.ARTURITO_WEBHOOK_SECRET
    if not secret or not signature_header:
        return False
    expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    provided = signature_header.split("=")[-1].strip()
    return hmac.compare_digest(expected, provided)


# --- Auditoría de entregas (debug/validación) ------------------------------- #
async def store_delivery(raw_body: bytes, headers: dict, verified: bool, result: dict | None = None) -> None:
    try:
        await _db()["arturito_deliveries"].insert_one({
            "received_at": _now(),
            "verified": verified,
            "signature": headers.get("x-arturito-signature") or headers.get("X-Arturito-Signature"),
            "body": raw_body.decode("utf-8", errors="replace")[:20000],
            "result": result,
        })
    except Exception:  # noqa: BLE001 — la auditoría nunca debe romper la ingesta
        logger.warning("No se pudo auditar la entrega de Arturito")


async def recent_deliveries(limit: int = 20) -> list[dict]:
    cur = _db()["arturito_deliveries"].find({}).sort("received_at", -1).limit(min(limit, 100))
    out = []
    async for d in cur:
        d["id"] = str(d.pop("_id"))
        out.append(d)
    return out


# --- Parseo del payload de Arturito ----------------------------------------- #
# Estructura real (verificada vía webhooks.test):
# { event, event_id, timestamp, workspace_id, agent_id,
#   lead: { id, name, phone, email, channel, intent, interest, tags },
#   conversation: { id, summary, url, started_at, ended_at } }
def _event_type(body: dict) -> str:
    return body.get("event") or body.get("type") or body.get("eventType") or ""


def _lead(body: dict) -> dict:
    for k in ("lead", "data", "payload", "object"):
        v = body.get(k)
        if isinstance(v, dict):
            return v
    return body if any(k in body for k in ("phone", "normalizedPhone", "id", "_id")) else {}


def _lead_id(lead: dict) -> str:
    return str(lead.get("id") or lead.get("_id") or "")


def _contact(lead: dict) -> EventContact:
    phone = lead.get("normalizedPhone") or lead.get("phone") or ""
    channel = (lead.get("channel") or "").lower()
    is_wa = "whatsapp" in channel
    return EventContact(
        phone=phone or None,
        whatsapp=phone if is_wa else None,
        email=lead.get("email") or None,
        crm_id=_lead_id(lead) or None,
        name=lead.get("name") or None,
    )


def _base_payload(body: dict, lead: dict, conv: dict, event_type: str) -> dict:
    return {
        "channel": lead.get("channel") or lead.get("channelName") or "",
        "intent": lead.get("intent") or lead.get("intentDetected") or "",
        "interest": lead.get("interest") or "",
        "message": lead.get("lastMessageContent") or conv.get("summary") or "",
        "summary": conv.get("summary") or "",
        "conversationUrl": conv.get("url") or "",
        "conversationId": str(conv.get("id") or ""),
        "tags": lead.get("tags") or [],
        "pipelineStage": lead.get("pipelineStage") or "",
        "leadScore": lead.get("leadScore"),
        "arturitoLeadId": _lead_id(lead),
        "arturitoEventId": body.get("event_id") or "",
        "arturitoAgentId": body.get("agent_id") or "",
        "arturitoEvent": event_type,
    }


def _idem(body: dict, lead: dict, event_type: str, suffix: str) -> str:
    """Clave de idempotencia estable: usa event_id (único por evento; los reintentos
    de Arturito lo conservan). Fallback al lead id."""
    base = body.get("event_id") or f"lead:{_lead_id(lead)}"
    return f"arturito:{base}:{suffix}"


def translate(body: dict) -> list[EventEnvelope]:
    """Traduce un webhook de Arturito a 0..N eventos del Conversation Adapter Contract.

    Mapeo (documentado y ajustable):
      - lead.created  → ConversationStarted (crea el Lead de VERA) + PropertyInquiry
                        (genera la tarea "Contactar a {persona}").
      - lead.attended → MessageReceived (actividad + tarea de seguimiento del asesor,
                        con el resumen que generó el agente de Arturito).
    """
    etype = _event_type(body)
    lead = _lead(body)
    if not lead:
        return []
    conv = body.get("conversation") if isinstance(body.get("conversation"), dict) else {}
    contact = _contact(lead)
    payload = _base_payload(body, lead, conv, etype)
    occurred = body.get("timestamp") or lead.get("createdAt") or lead.get("lastMessageAt") or _now()

    if etype == "lead.created":
        return [
            EventEnvelope(
                type="ConversationStarted", source="arturito", occurred_at=occurred,
                idempotency_key=_idem(body, lead, etype, "ConversationStarted"),
                contact=contact, subject=EventSubject(), payload=payload,
            ),
            EventEnvelope(
                type="PropertyInquiry", source="arturito", occurred_at=occurred,
                idempotency_key=_idem(body, lead, etype, "PropertyInquiry"),
                contact=contact, subject=EventSubject(), payload=payload,
            ),
        ]

    if etype == "lead.attended":
        return [
            EventEnvelope(
                type="MessageReceived", source="arturito", occurred_at=occurred,
                idempotency_key=_idem(body, lead, etype, "MessageReceived"),
                contact=contact, subject=EventSubject(), payload=payload,
            ),
        ]

    logger.info("Arturito: evento no mapeado '%s' (se ignora, sólo auditoría)", etype)
    return []


async def handle(body: dict) -> dict:
    """Traduce e ingresa los eventos. Devuelve un resumen para la respuesta/log."""
    envelopes = translate(body)
    ingested = []
    for env in envelopes:
        res = await pipeline.ingest(env)
        ingested.append({"type": env.type, **res})
    logger.info("Arturito webhook: %s → %d eventos ingeridos", _event_type(body), len(ingested))
    return {"event": _event_type(body), "ingested": ingested}
