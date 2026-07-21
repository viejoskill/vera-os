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


# Estados en los que una propiedad puede estar visible en la web pública.
_PUBLIC_STATUSES = {"active", "reserved", "sold"}


def is_web_published(prop: dict) -> bool:
    """Fuente única de verdad: una propiedad está publicada en la web cuando está
    activa/reservada/vendida, no archivada y con el canal Web en estado 'published'."""
    if prop.get("archived") or prop.get("status") not in _PUBLIC_STATUSES:
        return False
    web = (prop.get("publications") or {}).get("web-varela") or {}
    return web.get("status") == "published"


def canonical_url(prop: dict) -> str:
    """URL pública CANÓNICA de la propiedad (sin parámetros). VERA es dueño de esta
    URL; toda la app (Compartir, Studio, QR, emails, campañas) la reutiliza."""
    code = property_code(prop)
    return f"{config.PUBLIC_WEB_BASE_URL}/propiedad/{code.lower()}"


def public_url_or_none(prop: dict) -> str | None:
    """URL canónica si la propiedad está publicada; `None` en caso contrario."""
    return canonical_url(prop) if is_web_published(prop) else None


def public_url(prop: dict) -> str:
    """URL con parámetros de tracking (WhatsApp/consultas) — derivada de la canónica
    para que Arturito identifique automáticamente propiedad/canal/URL."""
    params = urlencode({
        "source": "website",
        "property_id": prop["id"],
        "property_code": property_code(prop),
    })
    return f"{canonical_url(prop)}?{params}"


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
