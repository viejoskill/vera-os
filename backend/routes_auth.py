"""Control de acceso por equipo (`/api/auth`).

VERA es un workspace único: quien entra ve todo. Para que el auto-registro (email
o Google, vía Supabase) no deje entrar a cualquiera, mantenemos una lista de
acceso en Mongo (`app_access`): cada email queda `approved` o pendiente, y algunos
son `isAdmin` (pueden aprobar a otros).

Bootstrap seguro: la primera vez, se hace backfill de los usuarios que YA existían
en Supabase (creados a mano por el dueño) como aprobados —el más antiguo, admin—
para no bloquear a nadie. Los que se registren después quedan pendientes.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel

import config
from supabase_client import get_supabase

router = APIRouter(prefix="/auth", tags=["auth"])

_client: AsyncIOMotorClient | None = None


def _col():
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(config.MONGO_URL)
    return _client[config.DB_NAME]["app_access"]


def _norm(email: str) -> str:
    return (email or "").strip().lower()


async def _seed_if_empty():
    col = _col()
    if await col.count_documents({}) > 0:
        return
    # Backfill de usuarios existentes en Supabase (aprobados; el más antiguo = admin).
    try:
        res = get_supabase().auth.admin.list_users()
        users = getattr(res, "users", res) or []
        users = sorted(users, key=lambda u: getattr(u, "created_at", "") or "")
        for i, u in enumerate(users):
            email = _norm(getattr(u, "email", "") or "")
            if not email:
                continue
            await col.update_one(
                {"_id": email},
                {"$setOnInsert": {"email": email, "approved": True, "isAdmin": i == 0}},
                upsert=True,
            )
    except Exception:
        # Si no se puede listar (sin service role), no bloqueamos el bootstrap.
        pass


class EmailBody(BaseModel):
    email: str


class TeamActionBody(BaseModel):
    email: str
    actorEmail: str


def _row(doc: dict) -> dict:
    return {"email": doc["email"], "approved": bool(doc.get("approved")), "isAdmin": bool(doc.get("isAdmin"))}


@router.post("/approval")
async def approval(body: EmailBody):
    """Devuelve el estado de acceso del email. Registra pendientes nuevos."""
    email = _norm(body.email)
    if not email:
        raise HTTPException(400, "Email requerido")
    await _seed_if_empty()
    col = _col()
    doc = await col.find_one({"_id": email})
    if doc:
        return _row(doc)
    # Email nuevo: si todavía no hay ningún admin, este pasa a ser el dueño.
    has_admin = await col.count_documents({"isAdmin": True}) > 0
    doc = {"_id": email, "email": email, "approved": not has_admin, "isAdmin": not has_admin}
    await col.insert_one(doc)
    return _row(doc)


async def _require_admin(actor_email: str):
    doc = await _col().find_one({"_id": _norm(actor_email)})
    if not doc or not doc.get("isAdmin"):
        raise HTTPException(403, "Solo un administrador puede gestionar el equipo")


@router.get("/team")
async def team(actorEmail: str):
    await _seed_if_empty()
    await _require_admin(actorEmail)
    docs = await _col().find({}).sort("email", 1).to_list(500)
    return {"members": [_row(d) for d in docs]}


@router.post("/team/approve")
async def team_approve(body: TeamActionBody):
    await _require_admin(body.actorEmail)
    email = _norm(body.email)
    await _col().update_one({"_id": email}, {"$set": {"approved": True, "email": email}}, upsert=True)
    return {"ok": True}


@router.post("/team/revoke")
async def team_revoke(body: TeamActionBody):
    await _require_admin(body.actorEmail)
    email = _norm(body.email)
    if email == _norm(body.actorEmail):
        raise HTTPException(400, "No podés revocarte a vos mismo")
    await _col().update_one({"_id": email}, {"$set": {"approved": False, "isAdmin": False}})
    return {"ok": True}


@router.post("/team/make-admin")
async def team_make_admin(body: TeamActionBody):
    await _require_admin(body.actorEmail)
    email = _norm(body.email)
    await _col().update_one({"_id": email}, {"$set": {"approved": True, "isAdmin": True, "email": email}}, upsert=True)
    return {"ok": True}
