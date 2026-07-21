"""Consulta por WhatsApp con contexto de propiedad (primer punto de contacto entre
el sitio público y el ecosistema VERA). Genera el deep link de WhatsApp con el mensaje
precompletado + parámetros de tracking (source, property_id, property_code) y registra
el evento 'Website Property Inquiry' en VERA. Base para la futura integración de Arturito
(identificar propiedad, canal y URL; asociar el lead y crear la oportunidad)."""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from urllib.parse import quote, urlencode

from motor.motor_asyncio import AsyncIOMotorClient

import config
from serializers import _property_code

logger = logging.getLogger("vera")

_client: AsyncIOMotorClient | None = None


def _db():
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(config.MONGO_URL)
    return _client[config.DB_NAME]


def property_code(prop: dict) -> str:
    return (prop.get("codigo") or "").strip() or _property_code(prop["id"])


def public_url(prop: dict) -> str:
    """URL pública de la propiedad, con parámetros de tracking para que Arturito
    identifique automáticamente propiedad/canal/URL desde el mensaje."""
    code = property_code(prop)
    params = urlencode({
        "source": "website",
        "property_id": prop["id"],
        "property_code": code,
    })
    return f"{config.PUBLIC_WEB_BASE_URL}/propiedades/{code.lower()}?{params}"


def whatsapp_message(prop: dict) -> str:
    code = property_code(prop)
    title = (prop.get("title") or "").strip() or "esta propiedad"
    return (
        "Hola 👋\n\n"
        "Estoy interesado en esta propiedad que vi en la web de Varela Propiedades.\n\n"
        f"Código: {code}\n\n"
        "Propiedad:\n"
        f"{title}\n\n"
        "Link:\n"
        f"{public_url(prop)}\n\n"
        "¿Podrían brindarme más información? Muchas gracias."
    )


def whatsapp_url(prop: dict) -> str:
    return f"https://wa.me/{config.WHATSAPP_NUMBER}?text={quote(whatsapp_message(prop))}"


async def register_inquiry(prop: dict) -> dict:
    """Registra el evento de consulta (lead pendiente) asociado a la propiedad."""
    doc = {
        "event": "Website Property Inquiry",
        "channel": "Website",
        "origin": "Ficha de Propiedad",
        "property_id": prop["id"],
        "property_code": property_code(prop),
        "property_title": prop.get("title") or "",
        "url": public_url(prop),
        "status": "pendiente_contacto",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        res = await _db()["website_inquiries"].insert_one(dict(doc))
        doc["id"] = str(res.inserted_id)
    except Exception:  # noqa: BLE001 — no romper la consulta si falla el registro
        logger.warning("No se pudo registrar la consulta web para %s", prop.get("id"))
    return doc
