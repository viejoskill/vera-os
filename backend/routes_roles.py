"""Administración de roles de VERA OS (`/api/roles`) — solo administradores.

Un rol agrupa permisos por módulo y acción (ver/crear/editar/borrar/exportar).
El rol "administrador" es fijo (`isSystem`): no se puede borrar ni editar sus
permisos. Los cambios acá tienen efecto inmediato — no hay que volver a loguearse,
porque los permisos se recalculan en cada request (ver `authz.current_access`).
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from authz import ACTIONS, ADMIN_ROLE_ID, MODULES, access_col, audit, now_iso, require_admin, roles_col

router = APIRouter(prefix="/roles", tags=["roles"], dependencies=[Depends(require_admin())])


class RoleBody(BaseModel):
    name: str
    permissions: dict[str, list[str]]


def _validate_permissions(permissions: dict[str, list[str]]):
    for module, actions in permissions.items():
        if module not in MODULES:
            raise HTTPException(400, f"Módulo inexistente: {module}")
        bad = set(actions) - set(ACTIONS)
        if bad:
            raise HTTPException(400, f"Acción inexistente: {', '.join(bad)}")


async def _user_count(role_id: str) -> int:
    return await access_col().count_documents({"roleIds": role_id})


async def _row(doc: dict) -> dict:
    return {
        "id": doc["_id"],
        "name": doc["name"],
        "isSystem": bool(doc.get("isSystem")),
        "permissions": doc.get("permissions") or {},
        "userCount": await _user_count(doc["_id"]),
        "createdAt": doc.get("createdAt"),
        "updatedAt": doc.get("updatedAt"),
    }


@router.get("")
async def list_roles():
    docs = await roles_col().find({}).sort("name", 1).to_list(200)
    return {"roles": [await _row(d) for d in docs]}


@router.post("", status_code=201)
async def create_role(body: RoleBody, access: dict = Depends(require_admin())):
    _validate_permissions(body.permissions)
    role_id = body.name.strip().lower().replace(" ", "-")
    if not role_id:
        raise HTTPException(400, "Nombre inválido")
    if await roles_col().find_one({"_id": role_id}):
        raise HTTPException(409, "Ya existe un rol con ese nombre")
    now = now_iso()
    doc = {
        "_id": role_id, "name": body.name.strip(), "isSystem": False,
        "permissions": body.permissions, "createdAt": now, "updatedAt": now,
        "createdBy": access["email"],
    }
    await roles_col().insert_one(doc)
    await audit(access["email"], "role.create", "role", role_id, {"permissions": body.permissions})
    return await _row(doc)


@router.put("/{role_id}")
async def update_role(role_id: str, body: RoleBody, access: dict = Depends(require_admin())):
    doc = await roles_col().find_one({"_id": role_id})
    if not doc:
        raise HTTPException(404, "Rol no encontrado")
    if doc.get("isSystem"):
        raise HTTPException(400, "El rol Administrador no se puede editar")
    _validate_permissions(body.permissions)
    update = {"name": body.name.strip(), "permissions": body.permissions, "updatedAt": now_iso()}
    await roles_col().update_one({"_id": role_id}, {"$set": update})
    await audit(access["email"], "role.update", "role", role_id, update)
    fresh = await roles_col().find_one({"_id": role_id})
    return await _row(fresh)


@router.post("/{role_id}/duplicate", status_code=201)
async def duplicate_role(role_id: str, access: dict = Depends(require_admin())):
    doc = await roles_col().find_one({"_id": role_id})
    if not doc:
        raise HTTPException(404, "Rol no encontrado")
    base_name = f"{doc['name']} (copia)"
    new_id = base_name.strip().lower().replace(" ", "-")
    suffix = 2
    while await roles_col().find_one({"_id": new_id}):
        new_id = f"{base_name.strip().lower().replace(' ', '-')}-{suffix}"
        suffix += 1
    now = now_iso()
    new_doc = {
        "_id": new_id, "name": base_name, "isSystem": False,
        "permissions": doc.get("permissions") or {}, "createdAt": now, "updatedAt": now,
        "createdBy": access["email"],
    }
    await roles_col().insert_one(new_doc)
    await audit(access["email"], "role.duplicate", "role", new_id, {"from": role_id})
    return await _row(new_doc)


@router.delete("/{role_id}")
async def delete_role(role_id: str, access: dict = Depends(require_admin())):
    doc = await roles_col().find_one({"_id": role_id})
    if not doc:
        raise HTTPException(404, "Rol no encontrado")
    if doc.get("isSystem") or role_id == ADMIN_ROLE_ID:
        raise HTTPException(400, "El rol Administrador no se puede borrar")
    count = await _user_count(role_id)
    if count > 0:
        raise HTTPException(400, f"No se puede borrar: {count} usuario(s) todavía tienen este rol")
    await roles_col().delete_one({"_id": role_id})
    await audit(access["email"], "role.delete", "role", role_id, {})
    return {"ok": True}
