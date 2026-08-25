"""Coexistencia WhatsApp — conexión del número real vía Embedded Signup.

Flujo: el frontend abre el Embedded Signup de Meta (FB.login con config_id +
featureType=whatsapp_business_app_onboarding). Meta devuelve un `code` de un solo
uso + `waba_id` + `phone_number_id`. Acá:
  1. Intercambiamos el code por un business access token (server-side).
  2. Verificamos que el número quedó en modo coexistencia (is_on_biz_app + CLOUD_API).
  3. Suscribimos la app al WABA apuntando el webhook a nuestro backend.
  4. Guardamos la conexión (token, ids) para que el bot responda desde el número real.
  5. Pedimos la sincronización de estado (best-effort).

En coexistencia NO se llama a /register (el número ya está registrado).
"""
from __future__ import annotations

import logging
import os

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from routes_rentals import _now, _props

logger = logging.getLogger("vera.whatsapp")
router = APIRouter(prefix="/integrations/whatsapp", tags=["whatsapp"])

GRAPH = f"https://graph.facebook.com/{os.environ.get('WHATSAPP_GRAPH_VERSION', 'v21.0')}"


def _conns():
    return _props().database["whatsapp_connections"]


def _callback_url() -> str:
    explicit = os.environ.get("WHATSAPP_CALLBACK_URL")
    if explicit:
        return explicit
    base = (os.environ.get("PUBLIC_APP_URL") or "").rstrip("/")
    return f"{base}/api/webhooks/whatsapp"


class ConnectBody(BaseModel):
    code: str
    waba_id: str
    phone_number_id: str


@router.get("/config")
async def public_config():
    """Datos públicos que el frontend necesita para abrir el Embedded Signup."""
    return {
        "appId": os.environ.get("WHATSAPP_APP_ID") or "",
        "configId": os.environ.get("WHATSAPP_CONFIG_ID") or "",
        "graphVersion": os.environ.get("WHATSAPP_GRAPH_VERSION", "v21.0"),
    }


@router.get("/status")
async def status():
    conns = []
    async for c in _conns().find({}):
        conns.append({
            "phoneNumberId": c.get("phone_number_id"),
            "wabaId": c.get("waba_id"),
            "displayPhone": c.get("displayPhone"),
            "verifiedName": c.get("verifiedName"),
            "isOnBizApp": c.get("isOnBizApp"),
            "platformType": c.get("platformType"),
            "status": c.get("status"),
            "connectedAt": c.get("connectedAt"),
        })
    return {"connections": conns}


@router.post("/connect")
async def connect(body: ConnectBody):
    app_id = os.environ.get("WHATSAPP_APP_ID")
    secret = os.environ.get("WHATSAPP_APP_SECRET")
    if not (app_id and secret):
        raise HTTPException(503, "Falta configurar WHATSAPP_APP_ID / WHATSAPP_APP_SECRET.")

    # 1) Intercambiar el code por un business token (el code expira en ~30s).
    async with httpx.AsyncClient(timeout=25) as h:
        r = await h.get(f"{GRAPH}/oauth/access_token", params={
            "client_id": app_id, "client_secret": secret, "code": body.code,
        })
    if r.status_code >= 400:
        logger.error("WA connect exchange %s: %s", r.status_code, r.text[:300])
        raise HTTPException(400, f"No se pudo intercambiar el código con Meta: {r.text[:200]}")
    token = r.json().get("access_token")
    if not token:
        raise HTTPException(400, "Meta no devolvió un token de negocio.")

    # 2) Datos del número + verificación de coexistencia.
    async with httpx.AsyncClient(timeout=25) as h:
        p = await h.get(f"{GRAPH}/{body.phone_number_id}", params={
            "access_token": token,
            "fields": "id,display_phone_number,verified_name,is_on_biz_app,platform_type",
        })
    phone = p.json() if p.status_code < 400 else {}

    # 3) Suscribir la app al WABA apuntando el webhook a nuestro backend.
    cb = _callback_url()
    vt = os.environ.get("WHATSAPP_VERIFY_TOKEN") or ""
    async with httpx.AsyncClient(timeout=25) as h:
        s = await h.post(f"{GRAPH}/{body.waba_id}/subscribed_apps", params={
            "access_token": token, "override_callback_uri": cb, "verify_token": vt,
        })
    if s.status_code >= 400:
        logger.error("WA connect subscribe %s: %s", s.status_code, s.text[:300])

    # 4) Guardar la conexión.
    now = _now()
    await _conns().update_one(
        {"_id": body.phone_number_id},
        {"$set": {
            "_id": body.phone_number_id,
            "waba_id": body.waba_id,
            "phone_number_id": body.phone_number_id,
            "token": token,
            "displayPhone": phone.get("display_phone_number"),
            "verifiedName": phone.get("verified_name"),
            "isOnBizApp": phone.get("is_on_biz_app"),
            "platformType": phone.get("platform_type"),
            "status": "connected",
            "connectedAt": now,
            "updatedAt": now,
        }},
        upsert=True,
    )

    # 5) Sincronización de estado de la app (best-effort).
    try:
        async with httpx.AsyncClient(timeout=25) as h:
            await h.post(f"{GRAPH}/{body.phone_number_id}/smb_app_data",
                         headers={"Authorization": f"Bearer {token}"},
                         json={"messaging_product": "whatsapp", "sync_type": "smb_app_state_sync"})
    except Exception:  # noqa: BLE001
        pass

    return {"ok": True, "phone": phone}


@router.delete("/connect/{phone_number_id}")
async def disconnect(phone_number_id: str):
    await _conns().delete_one({"_id": phone_number_id})
    return {"ok": True}
