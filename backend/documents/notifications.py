"""Notificaciones in-app de VERA (colección Mongo `notifications`).

Aviso liviano y nativo (sin proveedores externos): cuando un cliente firma un
documento, VERA crea una notificación que el asesor ve en la campanita 🔔.
La arquitectura queda lista para sumar email/WhatsApp como canales adicionales.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorClient

import config

_client: AsyncIOMotorClient | None = None


def _col():
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(config.MONGO_URL)
    return _client[config.DB_NAME]["notifications"]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def create(*, type: str, title: str, message: str,
                 document_id: str | None = None, link: str | None = None) -> dict:
    doc = {
        "id": str(uuid.uuid4()),
        "type": type,
        "title": title,
        "message": message,
        "documentId": document_id,
        "link": link,
        "read": False,
        "createdAt": _now(),
    }
    await _col().insert_one({**doc, "_id": doc["id"]})
    return doc


async def list_recent(limit: int = 30) -> list[dict]:
    cur = _col().find({}, {"_id": 0}).sort("createdAt", -1).limit(limit)
    return [d async for d in cur]


async def unread_count() -> int:
    return await _col().count_documents({"read": False})


async def mark_read(notification_id: str) -> None:
    await _col().update_one({"id": notification_id}, {"$set": {"read": True}})


async def mark_all_read() -> None:
    await _col().update_many({"read": False}, {"$set": {"read": True}})


async def _create_once(*, key: str, type: str, title: str, message: str, link: str | None = None) -> None:
    if await _col().find_one({"documentId": key}):
        return
    await create(type=type, title=title, message=message, document_id=key, link=link)


async def sync_rental_reminders() -> None:
    """Recordatorios in-app de reservas: check-in en <=72hs, check-in del día y saldo pendiente."""
    from datetime import date, timedelta

    def _money(n) -> str:
        return "$ " + f"{round(float(n or 0)):,}".replace(",", ".")

    _col()  # asegura cliente
    col = _client[config.DB_NAME]["rental_reservations"]  # type: ignore[index]
    hoy = date.today()
    cur = col.find({"estado": {"$in": ["confirmada", "encurso"]}})
    async for r in cur:
        ci = r.get("checkIn")
        try:
            d = date.fromisoformat(ci)
        except Exception:
            continue
        dias = (d - hoy).days
        nombre = (r.get("huesped") or {}).get("nombre", "Huésped")
        titulo = r.get("propertyTitulo", "")
        fecha_txt = f"{ci[8:10]}/{ci[5:7]}/{ci[0:4]}"
        pago = r.get("pago") or {}
        rid = r["_id"]
        # 1) Aviso 72hs antes
        if 0 <= dias <= 3:
            cuando = "hoy" if dias == 0 else ("mañana" if dias == 1 else f"en {dias} días")
            await _create_once(key=f"reserva_proxima:{rid}", type="reserva_proxima",
                               title="Reserva próxima",
                               message=f"Check-in {cuando} ({fecha_txt}) · {nombre} · {titulo}".strip(), link="/alquileres")
        # 2) Aviso el día del check-in
        if dias == 0:
            await _create_once(key=f"reserva_hoy:{rid}", type="reserva_hoy",
                               title="Check-in hoy",
                               message=f"Hoy ingresa {nombre} · {titulo}".strip(), link="/alquileres")
        # 4) Recordatorio de saldo pendiente (seña pagada + saldo > 0, hasta 5 días antes)
        if pago.get("estado") == "pagado" and 0 <= dias <= 5 and r.get("moneda", "ARS") == "ARS":
            saldo = round(float(r.get("montoEstimado") or 0) - float(pago.get("monto") or 0))
            if saldo > 0:
                await _create_once(key=f"saldo_pendiente:{rid}", type="saldo_pendiente",
                                   title="Saldo pendiente",
                                   message=f"Cobrar saldo de {nombre}: {_money(saldo)} al ingresar ({fecha_txt})", link="/alquileres")


async def notify_sena_pagada(*, reserva_id: str, nombre: str, monto, propiedad: str) -> None:
    """Aviso en la campanita cuando se acredita una seña (una vez por reserva)."""
    m = "$ " + f"{round(float(monto or 0)):,}".replace(",", ".")
    await _create_once(key=f"sena_pagada:{reserva_id}", type="sena_pagada",
                       title="Seña acreditada",
                       message=f"{nombre} pagó la seña de {m} · {propiedad}".strip(), link="/alquileres")
