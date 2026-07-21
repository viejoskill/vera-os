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
    """El humano puede mover una oportunidad de etapa manualmente."""
    if payload.stage not in OPP_STAGES:
        raise HTTPException(422, f"Etapa inválida. Válidas: {sorted(OPP_STAGES)}")
    updated = await store.update_opportunity_by_id(opportunity_id, payload.stage)
    if updated is None:
        raise HTTPException(404, "Oportunidad no encontrada.")
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
