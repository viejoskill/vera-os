"""Sesión y acceso de VERA OS (`/api/auth`).

El login en sí lo hace el frontend directo contra Supabase (`signInWithPassword`),
no pasa por acá. Este router resuelve el perfil + permisos efectivos del usuario
ya logueado (`/me`), el cambio de clave obligatorio de primer ingreso, y un
rate-limit liviano de intentos fallidos (el frontend consulta/reporta).
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from authz import (
    MIN_PASSWORD_LENGTH,
    access_col,
    build_profile,
    check_ip_abuse,
    check_login_lock,
    client_ip_from_request,
    current_access,
    current_user_raw,
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
async def login_failed(body: EmailBody, request: Request):
    """El frontend reporta acá cada intento fallido, para frenar fuerza bruta."""
    await check_ip_abuse(client_ip_from_request(request))
    await record_login_failure(body.email)
    return {"ok": True}


@router.get("/me")
async def me(doc: dict | None = Depends(current_user_raw)):
    """Perfil + permisos efectivos del usuario ya logueado. Si la cuenta no
    existe o está desactivada, igual responde 200 (con `active: false`) para
    que el frontend muestre el aviso correcto en vez de un 401 genérico."""
    if not doc:
        return {
            "email": "", "name": "", "active": False, "mustChangePassword": False,
            "isAdmin": False, "roles": [], "permissions": {},
        }
    return await build_profile(doc)


@router.post("/mark-login")
async def mark_login(doc: dict | None = Depends(current_user_raw)):
    """El frontend llama esto solo en un SIGNED_IN real (no en cada refresh de
    token), para que 'Último ingreso' sea eso y no 'última actividad'. Usa
    `current_user_raw` (no `current_access`) para que funcione también con
    clave temporal pendiente de cambio."""
    if doc:
        await access_col().update_one({"_id": norm_email(doc["email"])}, {"$set": {"lastLoginAt": now_iso()}})
    return {"ok": True}


@router.post("/change-password-done")
async def change_password_done(access: dict = Depends(current_access)):
    """El frontend ya cambió la clave contra Supabase (`auth.updateUser`); esto
    solo limpia el flag de 'cambio obligatorio' en Mongo."""
    email = norm_email(access["email"])
    await access_col().update_one({"_id": email}, {"$set": {"mustChangePassword": False}})
    fresh = await access_col().find_one({"_id": email})
    return await build_profile(fresh)


@router.get("/password-policy")
async def password_policy():
    return {"minLength": MIN_PASSWORD_LENGTH}
