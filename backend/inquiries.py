"""Consulta por WhatsApp con contexto de propiedad (primer punto de contacto entre
el sitio público y el ecosistema VERA). Genera el deep link de WhatsApp con el mensaje
precompletado + parámetros de tracking (source, property_id, property_code) y registra
el evento 'Website Property Inquiry' en VERA. Base para la futura integración de Arturito
(identificar propiedad, canal y URL; asociar el lead y crear la oportunidad)."""
from __future__ import annotations

from urllib.parse import quote, urlencode

import config
from serializers import _property_code


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
    """Registra la consulta como evento PropertyInquiry en el store unificado
    (fuente única). La consulta web es anónima (sin contacto) → sin person_id."""
    from events import pipeline  # import diferido para evitar ciclos

    event = await pipeline.emit(
        "PropertyInquiry",
        source="website",
        subject={"property_id": prop["id"], "property_code": property_code(prop)},
        payload={
            "origin": "Ficha de Propiedad",
            "property_title": prop.get("title") or "",
            "url": public_url(prop),
            "status": "pendiente_contacto",
        },
    )
    return {"id": event["id"]}
