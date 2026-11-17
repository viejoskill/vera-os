"""Administración de usuarios de VERA OS (`/api/users`) — solo administradores.

Las acciones de alta/baja/reset pasan siempre por el backend con el
`service_role` de Supabase (nunca llega al frontend). Las claves temporales se
devuelven UNA sola vez en la respuesta del alta/reset — no se guardan ni se
loguean en texto plano.
"""
from __future__ import annotations

import asyncio
import secrets
import string

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, field_validator

from authz import (
    ADMIN_ROLE_ID,
    MIN_PASSWORD_LENGTH,
    access_col,
    audit,
    build_profile,
    norm_email,
    now_iso,
    require_admin,
    roles_col,
)
from supabase_client import get_supabase

router = APIRouter(prefix="/users", tags=["users"], dependencies=[Depends(require_admin())])

def _generate_temp_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%&*"
    while True:
        pw = "".join(secrets.choice(alphabet) for _ in range(length))
        if (
            any(c.islower() for c in pw)
            and any(c.isupper() for c in pw)
            and any(c.isdigit() for c in pw)
        ):
            return pw


async def _find_supabase_user_id(email: str) -> str | None:
    def _list():
        res = get_supabase().auth.admin.list_users(per_page=1000)
        return getattr(res, "users", res) or []

    users = await asyncio.to_thread(_list)
    email_n = norm_email(email)
    for u in users:
        if norm_email(getattr(u, "email", "") or "") == email_n:
            return getattr(u, "id", None)
    return None


async def _active_admin_count(exclude_email: str | None = None) -> int:
    col = access_col()
    count = 0
    async for d in col.find({"active": True, "roleIds": ADMIN_ROLE_ID}):
        if exclude_email and norm_email(d["_id"]) == norm_email(exclude_email):
            continue
        count += 1
    return count


async def _valid_role_ids(role_ids: list[str]) -> list[dict]:
    docs = await roles_col().find({"_id": {"$in": role_ids}}).to_list(50)
    found_ids = {d["_id"] for d in docs}
    missing = set(role_ids) - found_ids
    if missing:
        raise HTTPException(400, f"Rol inexistente: {', '.join(missing)}")
    return docs


async def _row(doc: dict) -> dict:
    profile = await build_profile(doc)
    return {
        "email": profile["email"],
        "name": profile["name"],
        "roles": profile["roles"],
        "roleIds": doc.get("roleIds") or [],
        "active": profile["active"],
        "mustChangePassword": profile["mustChangePassword"],
        "lastLoginAt": doc.get("lastLoginAt"),
        "createdAt": doc.get("createdAt"),
    }


class CreateUserBody(BaseModel):
    name: str
    email: EmailStr
    roleIds: list[str]
    inviteByEmail: bool = False

    @field_validator("roleIds")
    @classmethod
    def _non_empty(cls, v):
        if not v:
            raise ValueError("Elegí al menos un rol")
        return v


class UpdateUserBody(BaseModel):
    name: str | None = None
    roleIds: list[str] | None = None


class ResetPasswordBody(BaseModel):
    method: str  # "temporary" | "email"


@router.get("")
async def list_users(access: dict = Depends(require_admin())):
    docs = await access_col().find({}).sort("email", 1).to_list(500)
    return {"users": [await _row(d) for d in docs]}


@router.post("", status_code=201)
async def create_user(body: CreateUserBody, access: dict = Depends(require_admin())):
    email = norm_email(body.email)
    if await access_col().find_one({"_id": email}):
        raise HTTPException(409, "Ya existe un usuario con ese email")
    await _valid_role_ids(body.roleIds)

    temp_password: str | None = None

    def _create_invite():
        return get_supabase().auth.admin.invite_user_by_email(email, {})

    def _create_with_password(pw: str):
        return get_supabase().auth.admin.create_user(
            {"email": email, "password": pw, "email_confirm": True}
        )

    try:
        if body.inviteByEmail:
            await asyncio.to_thread(_create_invite)
        else:
            temp_password = _generate_temp_password()
            await asyncio.to_thread(_create_with_password, temp_password)
    except Exception as exc:
        raise HTTPException(502, f"No se pudo crear el usuario en Supabase: {exc}")

    now = now_iso()
    doc = {
        "_id": email,
        "email": email,
        "name": body.name.strip(),
        "roleIds": body.roleIds,
        "active": True,
        "approved": True,
        "mustChangePassword": not body.inviteByEmail,
        "createdAt": now,
        "createdBy": norm_email(access["email"]),
    }
    await access_col().insert_one(doc)
    await audit(access["email"], "user.create", "user", email, {"roleIds": body.roleIds, "inviteByEmail": body.inviteByEmail})
    row = await _row(doc)
    if temp_password:
        row["temporaryPassword"] = temp_password
    return row


@router.patch("/{email}")
async def update_user(email: str, body: UpdateUserBody, access: dict = Depends(require_admin())):
    email = norm_email(email)
    doc = await access_col().find_one({"_id": email})
    if not doc:
        raise HTTPException(404, "Usuario no encontrado")

    update: dict = {}
    if body.name is not None:
        update["name"] = body.name.strip()
    if body.roleIds is not None:
        if not body.roleIds:
            raise HTTPException(400, "Elegí al menos un rol")
        await _valid_role_ids(body.roleIds)
        had_admin = ADMIN_ROLE_ID in (doc.get("roleIds") or [])
        keeps_admin = ADMIN_ROLE_ID in body.roleIds
        if had_admin and not keeps_admin:
            if norm_email(access["email"]) == email:
                raise HTTPException(400, "No podés quitarte tu propio rol de administrador")
            if await _active_admin_count(exclude_email=email) == 0:
                raise HTTPException(400, "Debe quedar al menos un administrador activo")
        update["roleIds"] = body.roleIds

    if update:
        await access_col().update_one({"_id": email}, {"$set": update})
        await audit(access["email"], "user.update", "user", email, update)
    fresh = await access_col().find_one({"_id": email})
    return await _row(fresh)


@router.post("/{email}/deactivate")
async def deactivate_user(email: str, access: dict = Depends(require_admin())):
    email = norm_email(email)
    doc = await access_col().find_one({"_id": email})
    if not doc:
        raise HTTPException(404, "Usuario no encontrado")
    if norm_email(access["email"]) == email:
        raise HTTPException(400, "No podés desactivar tu propia cuenta")
    if ADMIN_ROLE_ID in (doc.get("roleIds") or []) and await _active_admin_count(exclude_email=email) == 0:
        raise HTTPException(400, "Debe quedar al menos un administrador activo")

    await access_col().update_one({"_id": email}, {"$set": {"active": False, "approved": False}})

    user_id = await _find_supabase_user_id(email)
    if user_id:
        try:
            await asyncio.to_thread(
                lambda: get_supabase().auth.admin.update_user_by_id(user_id, {"ban_duration": "876000h"})
            )
        except Exception:
            pass  # el chequeo de `active` en cada request ya corta el acceso igual

    await audit(access["email"], "user.deactivate", "user", email, {})
    fresh = await access_col().find_one({"_id": email})
    return await _row(fresh)


@router.post("/{email}/reactivate")
async def reactivate_user(email: str, access: dict = Depends(require_admin())):
    email = norm_email(email)
    doc = await access_col().find_one({"_id": email})
    if not doc:
        raise HTTPException(404, "Usuario no encontrado")

    await access_col().update_one({"_id": email}, {"$set": {"active": True, "approved": True}})

    user_id = await _find_supabase_user_id(email)
    if user_id:
        try:
            await asyncio.to_thread(
                lambda: get_supabase().auth.admin.update_user_by_id(user_id, {"ban_duration": "none"})
            )
        except Exception:
            pass

    await audit(access["email"], "user.reactivate", "user", email, {})
    fresh = await access_col().find_one({"_id": email})
    return await _row(fresh)


@router.post("/{email}/reset-password")
async def reset_password(email: str, body: ResetPasswordBody, access: dict = Depends(require_admin())):
    email = norm_email(email)
    doc = await access_col().find_one({"_id": email})
    if not doc:
        raise HTTPException(404, "Usuario no encontrado")

    if body.method == "email":
        try:
            await asyncio.to_thread(lambda: get_supabase().auth.reset_password_for_email(email, {}))
        except Exception as exc:
            raise HTTPException(502, f"No se pudo enviar el email de recuperación: {exc}")
        await audit(access["email"], "user.reset_password_email", "user", email, {})
        return {"ok": True, "method": "email"}

    if body.method == "temporary":
        user_id = await _find_supabase_user_id(email)
        if not user_id:
            raise HTTPException(404, "El usuario no existe en Supabase")
        temp_password = _generate_temp_password()
        try:
            await asyncio.to_thread(
                lambda: get_supabase().auth.admin.update_user_by_id(user_id, {"password": temp_password})
            )
        except Exception as exc:
            raise HTTPException(502, f"No se pudo resetear la clave: {exc}")
        await access_col().update_one({"_id": email}, {"$set": {"mustChangePassword": True}})
        await audit(access["email"], "user.reset_password_temp", "user", email, {})
        return {"ok": True, "method": "temporary", "temporaryPassword": temp_password}

    raise HTTPException(400, "method debe ser 'temporary' o 'email'")
