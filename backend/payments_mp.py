"""Mercado Pago (Checkout Pro) — creación de preferencias de seña y lectura de pagos.

Único módulo que toca el SDK de Mercado Pago. El resto del sistema pide un link de
pago y consulta el estado; si mañana se cambia de proveedor, solo cambia esto.
"""
from __future__ import annotations

import asyncio
from decimal import ROUND_HALF_UP, Decimal

import mercadopago

import config

_sdk: mercadopago.SDK | None = None


def _client() -> mercadopago.SDK:
    global _sdk
    if _sdk is None:
        if not config.MP_ACCESS_TOKEN:
            raise RuntimeError("Mercado Pago no configurado (falta MP_ACCESS_TOKEN).")
        _sdk = mercadopago.SDK(config.MP_ACCESS_TOKEN)
    return _sdk


def _money(value) -> float:
    return float(Decimal(str(value or 0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


async def create_preference(
    *, titulo: str, descripcion: str, monto: float, external_reference: str,
    payer_email: str | None = None,
) -> dict:
    """Crea una preference de Checkout Pro (siempre en ARS) y devuelve id + init_point."""
    base = config.PUBLIC_APP_URL
    data: dict = {
        "items": [{
            "title": titulo[:250],
            "description": (descripcion or "")[:250],
            "quantity": 1,
            "currency_id": "ARS",
            "unit_price": _money(monto),
        }],
        "external_reference": external_reference,
    }
    if payer_email:
        data["payer"] = {"email": payer_email}
    if base:
        data["notification_url"] = f"{base}/api/rentals/payment-webhook"
        # La página de retorno vive en el sitio público de alquileres (path /alquileres),
        # separada del base del backend usado para el webhook.
        ui = (config.RENTALS_PUBLIC_BASE_URL or base).rstrip("/")
        data["back_urls"] = {
            "success": f"{ui}/pago/resultado?status=success",
            "pending": f"{ui}/pago/resultado?status=pending",
            "failure": f"{ui}/pago/resultado?status=failure",
        }
        data["auto_return"] = "approved"

    result = await asyncio.to_thread(lambda: _client().preference().create(data))
    if result.get("status", 500) >= 400:
        raise RuntimeError(f"Mercado Pago rechazó la preference: {result.get('response')}")
    resp = result["response"]
    return {
        "preference_id": resp.get("id"),
        "init_point": resp.get("init_point") or resp.get("sandbox_init_point"),
    }


async def get_payment(payment_id: str) -> dict:
    result = await asyncio.to_thread(lambda: _client().payment().get(payment_id))
    if result.get("status", 500) >= 400:
        raise RuntimeError("No se pudo leer el pago en Mercado Pago.")
    return result["response"]


async def search_approved_payment(external_reference: str) -> dict | None:
    """Busca en Mercado Pago un pago por external_reference; prioriza el aprobado."""
    result = await asyncio.to_thread(
        lambda: _client().payment().search({"external_reference": external_reference})
    )
    results = (result.get("response") or {}).get("results") or []
    for p in results:
        if p.get("status") == "approved":
            return p
    return results[0] if results else None
