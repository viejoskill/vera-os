"""Store de las proyecciones de VERA Core en MongoDB (colecciones `leads`,
`opportunities`, `core_tasks`).

A diferencia del Event Store (append-only e inmutable), estas colecciones son
read-models MUTABLES: se pueden reconstruir en cualquier momento reproduciendo los
eventos. Idempotencia por claves naturales (person_id / person_id+property_id /
tarea abierta por tipo) para que reprocesar eventos no duplique."""
from __future__ import annotations

from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING

import config

_client: AsyncIOMotorClient | None = None
_indexed = False


def _db():
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(config.MONGO_URL)
    return _client[config.DB_NAME]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _ensure_indexes() -> None:
    global _indexed
    if _indexed:
        return
    db = _db()
    await db["leads"].create_index([("person_id", ASCENDING)], unique=True, name="uniq_lead_person")
    await db["opportunities"].create_index(
        [("person_id", ASCENDING), ("property_id", ASCENDING)], unique=True, name="uniq_opp_person_property"
    )
    await db["core_tasks"].create_index(
        [("person_id", ASCENDING), ("property_id", ASCENDING), ("type", ASCENDING), ("status", ASCENDING)],
        name="task_dedupe",
    )
    _indexed = True


# --- Shapers (respuesta en camelCase para el frontend) ---------------------- #
def _shape_lead(d: dict) -> dict:
    return {
        "id": str(d.get("_id")),
        "personId": d.get("person_id"),
        "personName": d.get("person_name") or "",
        "status": d.get("status"),
        "channel": d.get("channel") or "",
        "source": d.get("source") or "",
        "interestedPropertyIds": d.get("interested_property_ids") or [],
        "messageCount": d.get("message_count") or 0,
        "firstContactAt": d.get("first_contact_at"),
        "lastActivityAt": d.get("last_activity_at"),
        "createdAt": d.get("created_at"),
        "updatedAt": d.get("updated_at"),
    }


def _shape_opp(d: dict) -> dict:
    return {
        "id": str(d.get("_id")),
        "personId": d.get("person_id"),
        "personName": d.get("person_name") or "",
        "propertyId": d.get("property_id") or "",
        "propertyLabel": d.get("property_label") or "",
        "stage": d.get("stage"),
        "source": d.get("source") or "",
        "createdAt": d.get("created_at"),
        "updatedAt": d.get("updated_at"),
    }


def _shape_task(d: dict) -> dict:
    return {
        "id": str(d.get("_id")),
        "personId": d.get("person_id"),
        "personName": d.get("person_name") or "",
        "propertyId": d.get("property_id") or "",
        "propertyLabel": d.get("property_label") or "",
        "type": d.get("type"),
        "title": d.get("title"),
        "status": d.get("status"),
        "dueAt": d.get("due_at"),
        "createdFromEvent": d.get("created_from_event"),
        "createdAt": d.get("created_at"),
        "updatedAt": d.get("updated_at"),
    }


# --- Leads ------------------------------------------------------------------ #
async def upsert_lead(person_id: str, *, defaults: dict, updates: dict) -> None:
    """Crea el lead si no existe (con `defaults`) y aplica `updates`."""
    await _ensure_indexes()
    now = _now()
    set_on_insert = {**defaults, "person_id": person_id, "created_at": now, "first_contact_at": now}
    await _db()["leads"].update_one(
        {"person_id": person_id},
        {"$setOnInsert": set_on_insert, "$set": {**updates, "updated_at": now}},
        upsert=True,
    )


async def bump_lead_message(person_id: str) -> None:
    await _db()["leads"].update_one({"person_id": person_id}, {"$inc": {"message_count": 1}})


async def add_lead_interest(person_id: str, property_id: str) -> None:
    await _db()["leads"].update_one(
        {"person_id": person_id}, {"$addToSet": {"interested_property_ids": property_id}}
    )


async def advance_lead_status(person_id: str, status: str) -> None:
    await _db()["leads"].update_one(
        {"person_id": person_id}, {"$set": {"status": status, "updated_at": _now()}}
    )


async def get_lead(person_id: str) -> dict | None:
    await _ensure_indexes()
    return await _db()["leads"].find_one({"person_id": person_id})


async def list_leads(status: str | None = None) -> list[dict]:
    await _ensure_indexes()
    q: dict = {"status": status} if status else {}
    cur = _db()["leads"].find(q).sort("last_activity_at", DESCENDING)
    return [_shape_lead(d) async for d in cur]


# --- Opportunities ---------------------------------------------------------- #
async def upsert_opportunity(person_id: str, property_id: str, *, base: dict) -> dict:
    await _ensure_indexes()
    now = _now()
    await _db()["opportunities"].update_one(
        {"person_id": person_id, "property_id": property_id},
        {
            "$setOnInsert": {
                "person_id": person_id, "property_id": property_id,
                "stage": base.get("stage"), "property_label": base.get("property_label") or "",
                "created_at": now,
            },
            "$set": {
                k: v for k, v in base.items() if k in ("person_name", "source")
            } | {"updated_at": now},
        },
        upsert=True,
    )
    return await _db()["opportunities"].find_one({"person_id": person_id, "property_id": property_id})


async def set_opportunity_stage(opp_id_filter: dict, stage: str) -> None:
    await _db()["opportunities"].update_one(opp_id_filter, {"$set": {"stage": stage, "updated_at": _now()}})


async def get_opportunity_by_id(oid) -> dict | None:
    from bson import ObjectId

    await _ensure_indexes()
    try:
        return await _db()["opportunities"].find_one({"_id": ObjectId(oid)})
    except Exception:  # noqa: BLE001
        return None


async def update_opportunity_by_id(oid, stage: str) -> dict | None:
    from bson import ObjectId

    await _db()["opportunities"].update_one(
        {"_id": ObjectId(oid)}, {"$set": {"stage": stage, "updated_at": _now()}}
    )
    return await get_opportunity_by_id(oid)


async def list_opportunities(stage: str | None = None) -> list[dict]:
    await _ensure_indexes()
    q: dict = {"stage": stage} if stage else {}
    cur = _db()["opportunities"].find(q).sort("updated_at", DESCENDING)
    return [_shape_opp(d) async for d in cur]


# --- Tasks ------------------------------------------------------------------ #
async def create_task_if_absent(
    person_id: str, property_id: str, task_type: str, *, fields: dict
) -> bool:
    """Crea la tarea sólo si no hay una PENDIENTE del mismo tipo para esa
    persona+propiedad (evita spam). Devuelve True si la creó."""
    await _ensure_indexes()
    from core.types import TASK_PENDIENTE

    existing = await _db()["core_tasks"].find_one({
        "person_id": person_id, "property_id": property_id or "",
        "type": task_type, "status": TASK_PENDIENTE,
    })
    if existing:
        return False
    now = _now()
    await _db()["core_tasks"].insert_one({
        "person_id": person_id, "property_id": property_id or "",
        "type": task_type, "status": TASK_PENDIENTE, "created_at": now, "updated_at": now,
        **fields,
    })
    return True


async def get_task_by_id(tid) -> dict | None:
    from bson import ObjectId

    await _ensure_indexes()
    try:
        return await _db()["core_tasks"].find_one({"_id": ObjectId(tid)})
    except Exception:  # noqa: BLE001
        return None


async def update_task_status(tid, status: str) -> dict | None:
    from bson import ObjectId

    await _db()["core_tasks"].update_one(
        {"_id": ObjectId(tid)}, {"$set": {"status": status, "updated_at": _now()}}
    )
    return await get_task_by_id(tid)


async def list_tasks(status: str | None = None) -> list[dict]:
    await _ensure_indexes()
    q: dict = {"status": status} if status else {}
    cur = _db()["core_tasks"].find(q).sort("created_at", DESCENDING)
    return [_shape_task(d) async for d in cur]


# --- Rebuild ---------------------------------------------------------------- #
async def clear_all() -> None:
    """Vacía las proyecciones para reconstruirlas desde el event stream."""
    await _ensure_indexes()
    db = _db()
    await db["leads"].delete_many({})
    await db["opportunities"].delete_many({})
    await db["core_tasks"].delete_many({})


async def summary() -> dict:
    await _ensure_indexes()
    db = _db()
    return {
        "leads": await db["leads"].count_documents({}),
        "opportunities": await db["opportunities"].count_documents({}),
        "tasks": await db["core_tasks"].count_documents({}),
    }
