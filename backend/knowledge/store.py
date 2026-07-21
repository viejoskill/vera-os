"""Store del conocimiento estructurado (MongoDB `knowledge_facts`).

Cada HECHO es un documento independiente con metadatos → consultable
("todos los agrimensores", "presupuesto > USD 100k"). El conocimiento es
acumulativo: nunca se elimina; las contradicciones se conservan y se marcan
para revisión."""
from __future__ import annotations

from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING

import config

# Tipos de valor único (una nueva versión contradice a la anterior → revisión).
SINGLE_VALUED = {
    "relationship", "intent", "budget", "bedrooms",
    "payment_method", "accepts_credit", "profession", "company", "property_type",
}

# Mapeo tipo → categoría de la vista de conocimiento.
CATEGORY = {
    "role": "roles",
    "relationship": "relationship",
    "intent": "interests", "property_type": "interests", "interest": "interests",
    "location": "preferences", "budget": "preferences", "bedrooms": "preferences",
    "payment_method": "preferences", "accepts_credit": "preferences", "preference": "preferences",
    "business_context": "businessContext",
    "profession": "facts", "company": "facts", "fact": "facts", "restriction": "facts",
    "next_step": "facts", "decision_maker": "facts", "involved_person": "facts", "note": "facts",
    "tag": "aiTags",
}
_CATEGORIES = ["roles", "relationship", "interests", "preferences", "facts", "businessContext", "aiTags"]

_client: AsyncIOMotorClient | None = None
_indexed = False


def _db():
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(config.MONGO_URL)
    return _client[config.DB_NAME]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _ensure() -> None:
    global _indexed
    if _indexed:
        return
    col = _db()["knowledge_facts"]
    await col.create_index([("person_id", ASCENDING), ("type", ASCENDING), ("value_norm", ASCENDING)], name="fact_key")
    await col.create_index([("type", ASCENDING), ("value_norm", ASCENDING)], name="fact_query")
    _indexed = True


def _shape(d: dict) -> dict:
    return {
        "id": str(d.get("_id")),
        "personId": d.get("person_id"),
        "type": d.get("type"),
        "value": d.get("value"),
        "currency": d.get("currency"),
        "confidence": d.get("confidence"),
        "source": d.get("source"),
        "sourceRef": d.get("source_ref"),
        "firstDetected": d.get("first_detected"),
        "lastConfirmed": d.get("last_confirmed"),
        "status": d.get("status"),
        "hits": d.get("hits", 1),
    }


async def upsert_fact(person_id: str, fact: dict, source: str, source_ref: str) -> str:
    """Fusiona un hecho respetando las reglas: confirma si ya existe (sube confianza),
    conserva contradicciones (marca las previas de un tipo único como 'review')."""
    await _ensure()
    type_ = (fact.get("type") or "").strip()
    value = fact.get("value")
    if not type_ or value in (None, "", []):
        return "skipped"
    conf = float(fact.get("confidence") or 0.5)
    conf = max(0.0, min(1.0, conf))
    vnorm = str(value).strip().lower()
    col = _db()["knowledge_facts"]
    now = _now()

    existing = await col.find_one({"person_id": person_id, "type": type_, "value_norm": vnorm})
    if existing:
        await col.update_one(
            {"_id": existing["_id"]},
            {"$set": {"last_confirmed": now, "confidence": max(existing.get("confidence", 0), conf), "status": "active"},
             "$inc": {"hits": 1}},
        )
        return "confirmed"

    if type_ in SINGLE_VALUED:
        await col.update_many(
            {"person_id": person_id, "type": type_, "status": "active"},
            {"$set": {"status": "review"}},
        )
    await col.insert_one({
        "person_id": person_id, "type": type_, "value": value, "value_norm": vnorm,
        "currency": fact.get("currency"), "confidence": conf,
        "source": source, "source_ref": source_ref,
        "first_detected": now, "last_confirmed": now, "status": "active", "hits": 1,
    })
    return "created"


async def list_for_person(person_id: str) -> list[dict]:
    await _ensure()
    cur = _db()["knowledge_facts"].find({"person_id": person_id}).sort("last_confirmed", -1)
    return [_shape(d) async for d in cur]


async def query_facts(type_: str | None = None, value: str | None = None, limit: int = 200) -> list[dict]:
    """Consulta estructurada del activo de conocimiento (ej. todos los 'role=Agrimensor')."""
    await _ensure()
    q: dict = {"status": {"$ne": "review"}}
    if type_:
        q["type"] = type_
    if value:
        q["value_norm"] = value.strip().lower()
    cur = _db()["knowledge_facts"].find(q).sort("confidence", -1).limit(min(limit, 500))
    return [_shape(d) async for d in cur]


def _readable(facts: list[dict]) -> list[str]:
    """Frases legibles ('Lo que VERA sabe'). Derivadas de los hechos activos."""
    out: list[str] = []
    for f in facts:
        if f["status"] == "review":
            continue
        t, v = f["type"], f["value"]
        if t == "role":
            out.append(f"Es {v}.")
        elif t == "profession":
            out.append(f"Profesión: {v}.")
        elif t == "relationship":
            out.append(f"Relación con Varela: {v}.")
        elif t == "intent":
            out.append(f"Intención: {v}.")
        elif t == "business_context":
            out.append(str(v))
        elif t == "location":
            out.append(f"Zona de interés: {v}.")
        elif t == "budget":
            out.append(f"Presupuesto: {f.get('currency') or ''} {v}".strip() + ".")
        elif t == "bedrooms":
            out.append(f"Dormitorios: {v}.")
        elif t == "accepts_credit":
            out.append(f"Acepta crédito: {v}.")
        elif t == "payment_method":
            out.append(f"Forma de pago: {v}.")
        elif t == "property_type":
            out.append(f"Tipo de propiedad: {v}.")
        elif t == "company":
            out.append(f"Empresa: {v}.")
        elif t == "decision_maker":
            out.append(f"Decide con: {v}.")
        else:
            out.append(str(v))
    return out


async def view(person_id: str) -> dict:
    """Vista de conocimiento para la ficha Persona (categorizada + legible)."""
    facts = await list_for_person(person_id)
    grouped: dict[str, list[dict]] = {c: [] for c in _CATEGORIES}
    active = [f for f in facts if f["status"] == "active"]
    for f in facts:
        grouped.setdefault(CATEGORY.get(f["type"], "facts"), []).append(f)
    avg = round(sum(f["confidence"] or 0 for f in active) / len(active), 2) if active else 0.0
    label = "Alta" if avg >= 0.85 else "Media" if avg >= 0.6 else "Baja" if active else "—"
    last = max((f["lastConfirmed"] for f in facts if f["lastConfirmed"]), default=None)
    return {
        "personId": person_id,
        **grouped,
        "confidence": avg,
        "confidenceLabel": label,
        "lastUpdated": last,
        "readable": _readable(active),
        "factCount": len(facts),
        "needsReview": [f for f in facts if f["status"] == "review"],
    }
