"""Sesión y acceso de VERA OS (`/api/auth`).

El login en sí lo hace el frontend directo contra Supabase (`signInWithPassword`),
no pasa por acá. Este router resuelve el perfil + permisos efectivos del usuario
ya logueado (`/me`), el cambio de clave obligatorio de primer ingreso, y un
rate-limit liviano de intentos fallidos (el frontend consulta/reporta).
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from authz import (
    MIN_PASSWORD_LENGTH,
    access_col,
    build_profile,
    check_login_lock,
    current_access,
    norm_email,
    now_iso,
    record_login_failure,
)

router = APIRouter(prefix="/auth", tags=["auth"])


class EmailBody(BaseModel):
    email: str


@router.post("/login-check")
async def login_check(body: EmailBody):
    """El frontend consulta esto ANTES de intentar el login contra Supabase."""
    return await check_login_lock(body.email)


@router.post("/login-failed")
async def login_failed(body: EmailBody):
    """El frontend reporta acá cada intento fallido, para frenar fuerza bruta."""
    await record_login_failure(body.email)
    return {"ok": True}


@router.get("/me")
async def me(access: dict = Depends(current_access)):
    """Perfil + permisos efectivos del usuario ya logueado. El frontend lo pide
    en cada cambio de sesión y arma el menú / gates con esto."""
    email = norm_email(access["email"])
    await access_col().update_one({"_id": email}, {"$set": {"lastLoginAt": now_iso()}})
    return {k: v for k, v in access.items() if k != "_raw"}


class ChangePasswordDoneBody(BaseModel):
    pass


@router.post("/change-password-done")
async def change_password_done(access: dict = Depends(current_access)):
    """El frontend ya cambió la clave contra Supabase (`auth.updateUser`); esto
    solo limpia el flag de 'cambio obligatorio' en Mongo."""
    email = norm_email(access["email"])
    await access_col().update_one({"_id": email}, {"$set": {"mustChangePassword": False}})
    fresh = await access_col().find_one({"_id": email})
    profile = await build_profile(fresh)
    return profile


@router.get("/password-policy")
async def password_policy():
    return {"minLength": MIN_PASSWORD_LENGTH}
