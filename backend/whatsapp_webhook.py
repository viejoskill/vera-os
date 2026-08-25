"""WhatsApp Cloud API (oficial de Meta) — canal del bot de Alquileres.

- GET  /api/webhooks/whatsapp  → verificación del webhook (Meta).
- POST /api/webhooks/whatsapp  → eventos entrantes:
    · messages            → mensajes de clientes → cerebro del bot → responde.
    · smb_message_echoes  → mensajes que la SECRETARIA escribe desde el celular
                            (coexistencia) → se guardan en la Bandeja como "secretaria".

Coexistencia: el mismo número vive en WhatsApp Business App (celular) y en Cloud API.
El token y el phone_number_id salen de la conexión guardada (whatsapp_connections),
con fallback a las variables de entorno del número de prueba.
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import os

import httpx
from fastapi import APIRouter, Request, Response

import rentals_bot
from routes_rentals import _now, _props

logger = logging.getLogger("vera.whatsapp")
router = APIRouter(prefix="/webhooks", tags=["whatsapp"])

GRAPH = f"https://graph.facebook.com/{os.environ.get('WHATSAPP_GRAPH_VERSION', 'v21.0')}"


def _conns():
    return _props().database["whatsapp_connections"]


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


async def _creds_for(phone_id: str | None) -> tuple[str, str]:
    """Devuelve (token, phone_id) priorizando la conexión guardada (coexistencia);
    si no hay, cae a las credenciales del .env (número de prueba)."""
    if phone_id:
        conn = await _conns().find_one({"_id": phone_id})
        if conn and conn.get("token"):
            return conn["token"], conn.get("phone_number_id") or phone_id
    cfg = _cfg()
    return cfg["token"], (phone_id or cfg["phone_id"])


async def _send_text(to: str, body: str, phone_id: str | None = None):
    token, pid = await _creds_for(phone_id)
    if not (token and pid):
        logger.warning("WhatsApp sin credenciales; no se envía (respuesta lista: %s)", body[:60])
        return
    async with httpx.AsyncClient(timeout=25) as h:
        r = await h.post(
            f"{GRAPH}/{pid}/messages",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
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


async def _handle_message(from_phone: str, text: str, profile_name: str = "", phone_id: str | None = None):
    """Corre el cerebro del bot y responde por WhatsApp. Usa el teléfono como sesión
    (memoria estable) y para reconocer contactos conocidos."""
    system = await rentals_bot._build_system(from_phone=from_phone)
    reply = await rentals_bot._responder(system, from_phone, text)
    await _send_text(from_phone, reply, phone_id=phone_id)
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


async def _handle_echo(client_phone: str, text: str, phone_id: str | None = None):
    """Eco de la app del celular: la SECRETARIA le escribió al cliente desde WhatsApp
    Business. Lo dejamos en la conversación del cliente para que la Bandeja tenga todo."""
    now = _now()
    await rentals_bot._convos().update_one(
        {"_id": client_phone},
        {
            "$setOnInsert": {"_id": client_phone, "canal": "whatsapp", "estado": "pendiente", "createdAt": now},
            "$set": {"updatedAt": now},
            "$push": {"mensajes": {"rol": "secretaria", "texto": text, "at": now}},
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
                field = change.get("field")
                value = change.get("value", {})
                phone_id = (value.get("metadata") or {}).get("phone_number_id")

                if field == "smb_message_echoes":
                    for echo in value.get("message_echoes", []):
                        if echo.get("type") != "text":
                            continue
                        # En un eco, "to" es el cliente al que le escribió la secretaria.
                        client = echo.get("to") or echo.get("recipient_id")
                        if client:
                            await _handle_echo(client, echo.get("text", {}).get("body", ""), phone_id)
                    continue

                # field == "messages" (o payload clásico sin field explícito)
                contacts = value.get("contacts", [])
                pname = (contacts[0].get("profile", {}).get("name", "") if contacts else "")
                for msg in value.get("messages", []):
                    frm = msg.get("from")
                    if msg.get("type") != "text":
                        await _send_text(frm, "¡Hola! Por ahora te puedo leer solo mensajes de texto 🙂 Contame qué estás buscando.", phone_id=phone_id)
                        continue
                    await _handle_message(frm, msg.get("text", {}).get("body", ""), pname, phone_id=phone_id)
    except Exception as e:  # noqa: BLE001
        logger.exception("WhatsApp receive error: %s", e)
    return {"status": "ok"}  # Meta espera 200 siempre
