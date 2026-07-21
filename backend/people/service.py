"""Servicio de la App Personas: enriquece la entidad con RELACIONES (sólo lectura).
No contiene lógica comercial: sólo muestra vínculos calculados desde los módulos
correspondientes (propiedades por `owner_id`, conversaciones del proveedor, eventos).
"""
from __future__ import annotations

from conversations.provider import active_conversation_provider
from people import events
from property_repository import property_repository


def _person_phones(person: dict) -> list[str]:
    phones = list(person.get("phones") or [])
    for p in (person.get("primary_phone"), person.get("phone")):
        if p and p not in phones:
            phones.append(p)
    return [p for p in phones if p]


async def _conversations_for(person: dict) -> list:
    """Conversaciones del proveedor asociadas a la persona (match por teléfono).
    HOY el proveedor está MOCKEADO; el día de mañana lo provee Arturito/WhatsApp."""
    provider = active_conversation_provider
    out = []
    seen = set()
    for phone in _person_phones(person):
        conv = await provider.find_by_phone(phone)
        if conv and conv.id not in seen:
            seen.add(conv.id)
            out.append(conv)
    return out


def _conv_summary(conv) -> dict:
    return {
        "id": conv.id,
        "channel": conv.channel,
        "propertyLabel": conv.property_label,
        "status": conv.status,
        "leadStatus": conv.lead_status,
        "lastAt": conv.last_at,
        "preview": (conv.client_text or "")[:120],
    }


async def properties_owned(person_id: str) -> list[dict]:
    rows = await property_repository.list_properties(status="all")
    owned = [r for r in rows if r.get("owner_id") == person_id]
    return [
        {
            "id": r["id"],
            "title": r.get("title") or "",
            "operation": r.get("operation") or "",
            "status": r.get("status") or "",
            "city": r.get("city") or "",
            "price": r.get("price") or 0,
            "currency": r.get("currency") or "USD",
            "relation": "propietario",
        }
        for r in owned
    ]


async def enrich_list_item(person: dict, owner_counts: dict[str, int]) -> dict:
    """Deriva último contacto y # de conversaciones desde el EVENT STORE real
    (fuente de verdad). Antes se calculaba desde el proveedor MOCKEADO y por eso
    las personas creadas por Arturito quedaban en 0 / sin último contacto."""
    from events.store import list_events

    evs = await list_events(person_id=person["id"], limit=300)
    last_contact = evs[0].get("occurredAt") if evs else None
    conv_ids = {
        (e.get("payload") or {}).get("conversationId")
        for e in evs if (e.get("payload") or {}).get("conversationId")
    }
    conv_starts = sum(1 for e in evs if e.get("type") == "ConversationStarted")
    conversations = len(conv_ids) if conv_ids else conv_starts
    return {
        "propertiesCount": owner_counts.get(person["id"], 0),
        "conversationsCount": conversations,
        "lastContact": last_contact,
    }


async def owner_counts() -> dict[str, int]:
    rows = await property_repository.list_properties(status="all")
    counts: dict[str, int] = {}
    for r in rows:
        oid = r.get("owner_id")
        if oid:
            counts[oid] = counts.get(oid, 0) + 1
    return counts


async def conversations_for(person: dict) -> list[dict]:
    return [_conv_summary(c) for c in await _conversations_for(person)]


async def timeline_for(person: dict) -> list[dict]:
    """Eventos tipados (persistidos) + eventos derivados de conversaciones (mock),
    ordenados cronológicamente descendente. La UI renderiza por `type`."""
    items = await events.list_for(person["id"])
    for conv in await _conversations_for(person):
        items.append({
            "id": f"conv-{conv.id}",
            "type": events.CONVERSATION_STARTED,
            "meta": {"channel": conv.channel, "propertyLabel": conv.property_label},
            "occurredAt": conv.last_at,
        })
    items.sort(key=lambda e: e.get("occurredAt") or "", reverse=True)
    return items
