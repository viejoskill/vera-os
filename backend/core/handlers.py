"""Projection handlers de VERA Core.

Reaccionan a cada evento del pipeline y mantienen las entidades de negocio
(Leads, Oportunidades, Tareas). TODA la lógica comercial vive acá — la capa
conversacional (cualquier adapter) sólo emite eventos tipados. Se registran en
`events.projections`; también se pueden reproducir en bloque (rebuild)."""
from __future__ import annotations

import logging

from core import store
from core.types import (
    LEAD_CALIFICADO, LEAD_CONVERTIDO, LEAD_NUEVO,
    OPP_GANADA, OPP_INTERES, OPP_OFERTA, OPP_RESERVA, OPP_VISITA_AGENDADA, OPP_VISITADA,
    TASK_CONFIRMAR_VISITA, TASK_CONTACTAR, TASK_RESPONDER, TASK_SEGUIMIENTO, TASK_SEGUIR_OFERTA,
    lead_can_advance, opp_can_advance,
)
from events import projections

logger = logging.getLogger("vera")

# Evento → etapa objetivo de la oportunidad.
_STAGE_BY_EVENT = {
    "PropertyInquiry": OPP_INTERES,
    "OpportunityCreated": OPP_INTERES,
    "VisitScheduled": OPP_VISITA_AGENDADA,
    "PropertyVisited": OPP_VISITADA,
    "OfferSent": OPP_OFERTA,
    "PropertyReserved": OPP_RESERVA,
    "PropertySold": OPP_GANADA,
}
# Evento → estado objetivo del lead.
_LEAD_TARGET = {
    "VisitScheduled": LEAD_CALIFICADO, "OpportunityCreated": LEAD_CALIFICADO,
    "OfferSent": LEAD_CALIFICADO, "PropertyVisited": LEAD_CALIFICADO,
    "PropertyReserved": LEAD_CONVERTIDO, "PropertySold": LEAD_CONVERTIDO,
}


async def _person_name(person_id: str, contact: dict) -> str:
    name = (contact or {}).get("name")
    if name:
        return name
    try:
        from people.repository import people_repository

        p = await people_repository.get(person_id)
        if p:
            return p.get("full_name") or p.get("primary_phone") or "el contacto"
    except Exception:  # noqa: BLE001
        pass
    return "el contacto"


async def project(event: dict) -> None:
    """Aplica las reglas de negocio para un evento (ingest o rebuild)."""
    person_id = event.get("person_id") or event.get("personId")
    etype = event.get("type")
    # Eventos anónimos (sin persona) o de alta manual no generan negocio.
    if not person_id or etype == "PersonCreated":
        return

    subject = event.get("subject") or {}
    payload = event.get("payload") or {}
    contact = event.get("contact") or {}
    property_id = subject.get("property_id") or ""
    property_label = subject.get("property_code") or property_id or "la propiedad"
    occurred_at = event.get("occurred_at") or event.get("occurredAt")
    event_id = str(event.get("_id") or event.get("id") or "")
    source = event.get("source") or ""
    channel = payload.get("channel") or contact.get("channel") or ""
    name = await _person_name(person_id, contact)

    # (1) Lead — la persona entra/actualiza el embudo.
    await store.upsert_lead(
        person_id,
        defaults={
            "status": LEAD_NUEVO, "source": source,
            "message_count": 0, "interested_property_ids": [],
        },
        updates={"last_activity_at": occurred_at, "person_name": name,
                 **({"channel": channel} if channel else {})},
    )
    if etype == "MessageReceived":
        await store.bump_lead_message(person_id)
    if property_id:
        await store.add_lead_interest(person_id, property_id)

    target_status = _LEAD_TARGET.get(etype)
    if target_status:
        lead = await store.get_lead(person_id)
        if lead and lead_can_advance(lead.get("status"), target_status):
            await store.advance_lead_status(person_id, target_status)

    # (2) Opportunity — posibilidad concreta (persona + propiedad).
    target_stage = _STAGE_BY_EVENT.get(etype)
    if target_stage and property_id:
        opp = await store.upsert_opportunity(
            person_id, property_id,
            base={"stage": target_stage, "person_name": name,
                  "property_label": property_label, "source": source},
        )
        if opp and opp_can_advance(opp.get("stage"), target_stage):
            await store.set_opportunity_stage({"_id": opp["_id"]}, target_stage)

    # (3) Task — próxima acción sugerida (VERA propone, el humano decide).
    common = {"person_name": name, "property_label": property_label, "created_from_event": event_id}
    if etype == "MessageReceived":
        await store.create_task_if_absent(person_id, property_id, TASK_RESPONDER,
            fields={"title": f"Responder a {name}", **common})
    elif etype == "PropertyInquiry":
        await store.create_task_if_absent(person_id, property_id, TASK_CONTACTAR,
            fields={"title": f"Contactar a {name} por {property_label}", **common})
    elif etype == "VisitScheduled":
        due = payload.get("scheduledAt") or payload.get("scheduled_at")
        await store.create_task_if_absent(person_id, property_id, TASK_CONFIRMAR_VISITA,
            fields={"title": f"Confirmar visita con {name}", "due_at": due, **common})
    elif etype == "PropertyVisited":
        await store.create_task_if_absent(person_id, property_id, TASK_SEGUIMIENTO,
            fields={"title": f"Hacer seguimiento post-visita con {name}", **common})
    elif etype == "OfferSent":
        await store.create_task_if_absent(person_id, property_id, TASK_SEGUIR_OFERTA,
            fields={"title": f"Seguir la oferta enviada a {name}", **common})


async def rebuild() -> dict:
    """Reconstruye TODAS las proyecciones desde el event stream (orden cronológico).
    Herramienta de desarrollo/administración: los eventos son la fuente de verdad."""
    from events.store import list_ascending

    await store.clear_all()
    count = 0
    for event in await list_ascending():
        try:
            await project(event)
            count += 1
        except Exception:  # noqa: BLE001
            logger.warning("Rebuild: proyección falló para evento %s", event.get("type"))
    result = await store.summary()
    result["events_processed"] = count
    return result


# Registro en el pipeline: cada evento persistido dispara estas proyecciones.
projections.register(project)
