"""WhatsApp Cloud API (oficial de Meta) — canal del bot de Alquileres (Fase 3).

- GET  /api/webhooks/whatsapp  → verificación del webhook (Meta).
- POST /api/webhooks/whatsapp  → mensajes entrantes → cerebro del bot → responde.

Número: el de ALQUILERES (distinto al de Ventas que usa Arturito). Con coexistencia,
la secretaria sigue usando el celular; el bot pre-atiende y todo queda en la Bandeja.

Credenciales (env): WHATSAPP_VERIFY_TOKEN (la elegimos), WHATSAPP_TOKEN y
WHATSAPP_PHONE_ID (los da Meta), WHATSAPP_APP_SECRET (opcional, verifica firma).
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import os

import httpx
from fastapi import APIRouter, Request, Response

import rentals_bot
from routes_rentals import _now

logger = logging.getLogger("vera.whatsapp")
router = APIRouter(prefix="/webhooks", tags=["whatsapp"])

GRAPH = "https://graph.facebook.com/v21.0"


def _cfg():
    return {
        "verify": os.environ.get("WHATSAPP_VERIFY_TOKEN") or "",
        "token": os.environ.get("WHATSAPP_TOKEN") or "",
        "phone_id": os.environ.get("WHATSAPP_PHONE_ID") or "",
        "secret": os.environ.get("WHATSAPP_APP_SECRET") or "",
    }


@router.get("/whatsapp")
async def verify(request: Request):
    p = request.query_params
    if p.get("hub.mode") == "subscribe" and p.get("hub.verify_token") == _cfg()["verify"]:
        return Response(content=p.get("hub.challenge", ""), media_type="text/plain")
    return Response(content="forbidden", status_code=403)


async def _send_text(to: str, body: str):
    cfg = _cfg()
    if not (cfg["token"] and cfg["phone_id"]):
        logger.warning("WhatsApp sin credenciales; no se envía (respuesta lista: %s)", body[:60])
        return
    async with httpx.AsyncClient(timeout=25) as h:
        r = await h.post(
            f"{GRAPH}/{cfg['phone_id']}/messages",
            headers={"Authorization": f"Bearer {cfg['token']}", "Content-Type": "application/json"},
            json={"messaging_product": "whatsapp", "recipient_type": "individual",
                  "to": to, "type": "text", "text": {"body": body}},
        )
        if r.status_code >= 400:
            logger.error("WhatsApp send %s: %s", r.status_code, r.text[:300])


def _valid_signature(raw: bytes, sig: str | None, secret: str) -> bool:
    if not secret:
        return True  # sin app secret configurado, no verificamos
    if not sig or not sig.startswith("sha256="):
        return False
    mac = hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()
    return hmac.compare_digest(mac, sig.split("=", 1)[1])


async def _handle_message(from_phone: str, text: str, profile_name: str = ""):
    """Corre el cerebro del bot y responde por WhatsApp. Usa el teléfono como sesión
    (memoria estable) y para reconocer contactos conocidos."""
    system = await rentals_bot._build_system(from_phone=from_phone)
    reply = await rentals_bot._responder(system, from_phone, text)
    await _send_text(from_phone, reply)
    now = _now()
    await rentals_bot._convos().update_one(
        {"_id": from_phone},
        {
            "$setOnInsert": {"_id": from_phone, "canal": "whatsapp", "estado": "pendiente", "createdAt": now},
            "$set": {"updatedAt": now, "ultimoMensaje": text, "nombrePerfil": profile_name},
            "$push": {"mensajes": {"$each": [
                {"rol": "user", "texto": text, "at": now},
                {"rol": "bot", "texto": reply, "at": now},
            ]}},
        },
        upsert=True,
    )


@router.post("/whatsapp")
async def receive(request: Request):
    raw = await request.body()
    if not _valid_signature(raw, request.headers.get("X-Hub-Signature-256"), _cfg()["secret"]):
        return Response(status_code=403)
    data = await request.json()
    try:
        for entry in data.get("entry", []):
            for change in entry.get("changes", []):
                value = change.get("value", {})
                contacts = value.get("contacts", [])
                pname = (contacts[0].get("profile", {}).get("name", "") if contacts else "")
                for msg in value.get("messages", []):
                    if msg.get("type") != "text":
                        await _send_text(msg.get("from"), "¡Hola! Por ahora te puedo leer solo mensajes de texto 🙂 Contame qué estás buscando.")
                        continue
                    await _handle_message(msg.get("from"), msg.get("text", {}).get("body", ""), pname)
    except Exception as e:  # noqa: BLE001
        logger.exception("WhatsApp receive error: %s", e)
    return {"status": "ok"}  # Meta espera 200 siempre
