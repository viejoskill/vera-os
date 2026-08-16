"""VERA Core — endpoints de las entidades de negocio derivadas del Event Pipeline.

Leads, Oportunidades y Tareas son PROYECCIONES (read-models) que VERA construye
automáticamente reaccionando a los eventos. La lectura es directa; las tareas y
oportunidades se pueden actualizar (el humano decide). `rebuild` reconstruye todo
desde el stream inmutable."""
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from core import store
from core.handlers import rebuild as rebuild_projections
from core.types import LEAD_STATUSES, OPP_STAGES, TASK_STATUSES

router = APIRouter(prefix="/core", tags=["core"])


@router.get("/summary")
async def core_summary():
    return await store.summary()


_ACTIVITY_LABELS = {
    "PersonCreated": "Persona creada",
    "ConversationStarted": "Conversación iniciada",
    "MessageReceived": "Mensaje recibido",
    "PropertyInquiry": "Consulta de propiedad",
    "VisitScheduled": "Visita agendada",
    "PropertyVisited": "Propiedad visitada",
    "OpportunityCreated": "Oportunidad creada",
    "OfferSent": "Oferta enviada",
    "PropertyReserved": "Propiedad reservada",
    "PropertySold": "Venta cerrada",
}


@router.get("/kpis")
async def core_kpis():
    """KPIs superiores del tablero. Sólo cuenta el estado de VERA Core (no decide nada)."""
    from datetime import datetime, timezone

    from events.store import list_events
    from people.repository import people_repository

    leads = await store.list_leads()
    opps = await store.list_opportunities()
    pending = await store.list_tasks("pendiente")
    try:
        people = await people_repository.list()
    except Exception:  # noqa: BLE001
        people = []
    conv = await list_events(event_type="ConversationStarted", limit=500)
    today = datetime.now(timezone.utc).date().isoformat()
    conv_today = len({
        (e.get("payload") or {}).get("conversationId") or e["id"]
        for e in conv if (e.get("occurredAt") or "").startswith(today)
    })
    return {
        "personas": len(people),
        "leadsActivos": len([l for l in leads if l["status"] not in ("convertido", "perdido")]),
        "oportunidadesAbiertas": len([o for o in opps if o["stage"] not in ("ganada", "perdida")]),
        "tareasPendientes": len(pending),
        "conversacionesHoy": conv_today,
    }


@router.get("/activity")
async def core_activity(limit: int = 40):
    """Timeline GLOBAL (todas las personas) derivado del event store inmutable."""
    from events.store import list_events
    from people.repository import people_repository

    evs = await list_events(limit=limit)
    names: dict[str, str] = {}
    for pid in {e.get("personId") for e in evs if e.get("personId")}:
        try:
            p = await people_repository.get(pid)
        except Exception:  # noqa: BLE001
            p = None
        if p:
            names[pid] = p.get("full_name") or ""
    return {"activity": [
        {
            "id": e["id"],
            "at": e.get("occurredAt"),
            "type": e["type"],
            "label": _ACTIVITY_LABELS.get(e["type"], e["type"]),
            "personId": e.get("personId"),
            "personName": names.get(e.get("personId")) or (e.get("contact") or {}).get("name") or "",
            "source": e.get("source"),
        }
        for e in evs
    ]}


@router.post("/rebuild")
async def core_rebuild():
    """Reconstruye Leads/Oportunidades/Tareas reproduciendo el event stream."""
    return await rebuild_projections()


# --- Leads ------------------------------------------------------------------ #
@router.get("/leads")
async def list_leads(status: Optional[str] = None):
    if status and status not in LEAD_STATUSES:
        raise HTTPException(422, f"Estado inválido. Válidos: {sorted(LEAD_STATUSES)}")
    return {"leads": await store.list_leads(status)}


# --- Opportunities ---------------------------------------------------------- #
class OpportunityUpdate(BaseModel):
    stage: str


@router.get("/opportunities")
async def list_opportunities(stage: Optional[str] = None):
    if stage and stage not in OPP_STAGES:
        raise HTTPException(422, f"Etapa inválida. Válidas: {sorted(OPP_STAGES)}")
    return {"opportunities": await store.list_opportunities(stage)}


@router.patch("/opportunities/{opportunity_id}")
async def update_opportunity(opportunity_id: str, payload: OpportunityUpdate):
    """El humano puede mover una oportunidad a CUALQUIER etapa manualmente (override).
    A diferencia de las proyecciones automáticas, este endpoint NO aplica la regla de
    'sólo avanzar': el humano decide (puede corregir o retroceder una etapa)."""
    if payload.stage not in OPP_STAGES:
        raise HTTPException(422, f"Etapa inválida. Válidas: {sorted(OPP_STAGES)}")
    updated = await store.update_opportunity_by_id(opportunity_id, payload.stage)
    if updated is None:
        raise HTTPException(404, "Oportunidad no encontrada.")
    # Sincroniza la comisión de venta enganchada (si existe) con la etapa.
    try:
        from datetime import datetime, timezone
        vc = store._db()["venta_comisiones"]
        key = {"personId": updated.get("person_id"), "propertyId": updated.get("property_id")}
        if payload.stage == "perdida":
            await vc.delete_one(key)
        elif payload.stage == "ganada":
            await vc.update_one(key, {"$set": {"fechaConfirmada": datetime.now(timezone.utc).date().isoformat()}})
        else:
            await vc.update_one(key, {"$unset": {"fechaConfirmada": ""}})
    except Exception:  # noqa: BLE001
        pass
    return store._shape_opp(updated)


# --- Tasks ------------------------------------------------------------------ #
class TaskUpdate(BaseModel):
    status: str


@router.get("/tasks")
async def list_tasks(status: Optional[str] = None):
    if status and status not in TASK_STATUSES:
        raise HTTPException(422, f"Estado inválido. Válidos: {sorted(TASK_STATUSES)}")
    return {"tasks": await store.list_tasks(status)}


@router.patch("/tasks/{task_id}")
async def update_task(task_id: str, payload: TaskUpdate):
    """VERA propone la tarea; el humano la marca hecha o la descarta."""
    if payload.status not in TASK_STATUSES:
        raise HTTPException(422, f"Estado inválido. Válidos: {sorted(TASK_STATUSES)}")
    updated = await store.update_task_status(task_id, payload.status)
    if updated is None:
        raise HTTPException(404, "Tarea no encontrada.")
    return store._shape_task(updated)
