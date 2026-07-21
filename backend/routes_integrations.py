"""Integraciones — health-check de alcance de servicios de terceros.

VERA orquesta herramientas externas; este endpoint responde si el SERVICIO del
proveedor está operativo (alcanzable), no si la cuenta del usuario está conectada.
Solo los proveedores en HEALTH_TARGETS soportan chequeo real; el resto se maneja
como estado simulado en el frontend hasta sumar su OAuth.
"""
import logging
import time
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, HTTPException, Request

from integrations.arturito import adapter as arturito_adapter

router = APIRouter(prefix="/integrations", tags=["integrations"])
logger = logging.getLogger("vera")

# Proveedores con health-check real (ping de alcance).
HEALTH_TARGETS = {
    "arturito": "https://app.arturito.ai",
}


@router.get("/{provider}/health")
async def provider_health(provider: str):
    target = HEALTH_TARGETS.get(provider)
    if not target:
        raise HTTPException(404, f"Sin health-check para: {provider}")

    started = time.perf_counter()
    status = "down"
    http_status = None
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=6.0) as client:
            resp = await client.get(target, headers={"User-Agent": "VERA-OS-HealthCheck/1.0"})
            http_status = resp.status_code
            status = "operational" if resp.status_code < 500 else "degraded"
    except Exception as exc:  # noqa: BLE001 — cualquier fallo de red = servicio caído
        logger.warning("Health-check %s falló: %s", provider, exc)
        status = "down"

    return {
        "provider": provider,
        "status": status,
        "http_status": http_status,
        "latency_ms": int((time.perf_counter() - started) * 1000),
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/arturito/webhook")
async def arturito_webhook(request: Request):
    """ArturitoWebhookAdapter — receptor primario de eventos de Arturito.
    Valida la firma HMAC-SHA256, traduce lead.created/lead.attended al Conversation
    Adapter Contract y los ingresa en VERA Core (pipeline.ingest)."""
    raw = await request.body()
    signature = request.headers.get("X-Arturito-Signature")
    verified = arturito_adapter.verify_signature(raw, signature)

    import config
    require = bool(config.ARTURITO_WEBHOOK_SECRET)
    try:
        body = await request.json()
    except Exception:  # noqa: BLE001
        body = {}

    # Firma inválida cuando hay secret configurado → rechazar (pero auditar).
    if require and not verified:
        await arturito_adapter.store_delivery(raw, dict(request.headers), verified, {"rejected": "bad_signature"})
        raise HTTPException(401, "Firma inválida")

    result = await arturito_adapter.handle(body)
    await arturito_adapter.store_delivery(raw, dict(request.headers), verified, result)
    return {"ok": True, "verified": verified, **result}


@router.get("/arturito/deliveries")
async def arturito_deliveries(limit: int = 20):
    """Vista de auditoría (dev): últimas entregas recibidas de Arturito."""
    return {"deliveries": await arturito_adapter.recent_deliveries(limit)}
