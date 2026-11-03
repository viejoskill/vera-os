"""Estadísticas internas: visitas a la web pública (Ventas + Alquileres) y resumen
de actividad proveniente de anuncios de Google. Colección `page_views`: un doc
liviano por carga de página pública (anónima, sin cookies de terceros). El resumen
(`/analytics/summary`) solo lo puede ver un administrador."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Literal
from uuid import uuid4

from fastapi import APIRouter
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

import config
from routes_auth import _require_admin

router = APIRouter(prefix="/analytics", tags=["analytics"])

_client: AsyncIOMotorClient | None = None
_indexed = False

# Las visitas se agrupan por día en horario de Argentina (no UTC), para que una
# visita de la noche no quede contada en el día siguiente.
_TZ = "America/Argentina/Buenos_Aires"


def _db():
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(config.MONGO_URL)
    return _client[config.DB_NAME]


async def _ensure_indexes() -> None:
    global _indexed
    if _indexed:
        return
    col = _db()["page_views"]
    await col.create_index("createdAt", name="by_time")
    await col.create_index("visitorId", name="by_visitor")
    _indexed = True


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class TrackBody(BaseModel):
    path: str = Field(max_length=300)
    visitorId: str = Field(max_length=100)
    section: Literal["ventas", "alquileres"]
    propertyId: str | None = Field(default=None, max_length=100)
    propertyCode: str | None = Field(default=None, max_length=30)
    fromAd: bool = False
    referrer: str | None = Field(default=None, max_length=300)


@router.post("/track")
async def track(body: TrackBody):
    """Registro best-effort de una vista de página pública. No requiere auth."""
    await _ensure_indexes()
    doc = {
        "_id": uuid4().hex,
        "path": body.path,
        "visitorId": body.visitorId,
        "section": body.section,
        "propertyId": body.propertyId,
        "propertyCode": body.propertyCode,
        "fromAd": body.fromAd,
        "referrer": body.referrer or "",
        "createdAt": _now_iso(),
    }
    await _db()["page_views"].insert_one(doc)
    return {"ok": True}


@router.get("/summary")
async def summary(actorEmail: str, days: int = 30):
    await _require_admin(actorEmail)
    await _ensure_indexes()
    days = max(1, min(days, 365))
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    col = _db()["page_views"]
    q = {"createdAt": {"$gte": since}}

    total_visits = await col.count_documents(q)
    visits_from_ads = await col.count_documents({**q, "fromAd": True})
    unique_visitors = len(await col.distinct("visitorId", q))

    by_day = [
        {"date": d["_id"], "count": d["count"]}
        async for d in col.aggregate([
            {"$match": q},
            {"$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": {"$toDate": "$createdAt"}, "timezone": _TZ}},
                "count": {"$sum": 1},
            }},
            {"$sort": {"_id": 1}},
        ])
    ]

    top_pages = [
        {"path": d["_id"]["path"], "section": d["_id"]["section"], "code": d["_id"]["code"], "count": d["count"]}
        async for d in col.aggregate([
            {"$match": q},
            {"$group": {
                "_id": {"path": "$path", "section": "$section", "code": "$propertyCode"},
                "count": {"$sum": 1},
            }},
            {"$sort": {"count": -1}},
            {"$limit": 10},
        ])
    ]

    top_properties = [
        {"propertyId": d["_id"]["id"], "code": d["_id"]["code"], "section": d["_id"]["section"], "count": d["count"]}
        async for d in col.aggregate([
            {"$match": {**q, "propertyId": {"$nin": [None, ""]}}},
            {"$group": {
                "_id": {"id": "$propertyId", "code": "$propertyCode", "section": "$section"},
                "count": {"$sum": 1},
            }},
            {"$sort": {"count": -1}},
            {"$limit": 10},
        ])
    ]

    whatsapp_consultas = await _db()["events"].count_documents({
        "type": "PropertyInquiry", "occurred_at": {"$gte": since},
    })

    return {
        "days": days,
        "totalVisits": total_visits,
        "uniqueVisitors": unique_visitors,
        "visitsFromAds": visits_from_ads,
        "whatsappConsultas": whatsapp_consultas,
        "visitsByDay": by_day,
        "topPages": top_pages,
        "topProperties": top_properties,
    }
