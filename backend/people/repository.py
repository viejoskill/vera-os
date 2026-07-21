"""Repositorio de Personas (Supabase). Persistencia de la entidad `people`,
base de la App Personas. El backend es el único que conoce Supabase.

`primary_phone`/`primary_email` son campos explícitos (no dependen del primer
elemento de las listas). Se mantienen las columnas legacy `phone`/`email`
sincronizadas con los principales por compatibilidad con módulos existentes."""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from supabase_client import get_supabase

TABLE = "people"
_COLS = {
    "full_name", "phone", "email", "notes", "roles", "workspace_id", "created_at",
    "primary_phone", "primary_email", "phones", "emails", "document", "status",
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _sync_primary(row: dict) -> dict:
    """Mantiene phone/email (legacy) alineados con los principales explícitos."""
    if "primary_phone" in row:
        row["phone"] = row["primary_phone"]
    if "primary_email" in row:
        row["email"] = row["primary_email"]
    return row


class PeopleRepository:
    async def list(self, role: str | None = None) -> list[dict]:
        def _q():
            return get_supabase().table(TABLE).select("*").order("full_name").execute()
        res = await asyncio.to_thread(_q)
        rows = res.data or []
        if role:
            rows = [r for r in rows if role in (r.get("roles") or [])]
        return rows

    async def get(self, person_id: str) -> dict | None:
        def _q():
            return get_supabase().table(TABLE).select("*").eq("id", person_id).limit(1).execute()
        res = await asyncio.to_thread(_q)
        return (res.data or [None])[0]

    async def find_one(self, column: str, value: str) -> dict | None:
        def _q():
            return get_supabase().table(TABLE).select("*").eq(column, value).limit(1).execute()
        res = await asyncio.to_thread(_q)
        return (res.data or [None])[0]

    async def create(self, payload: dict, workspace_id: str) -> dict:
        row = {k: v for k, v in payload.items() if k in _COLS}
        row = _sync_primary(row)
        row["workspace_id"] = workspace_id
        row["created_at"] = _now()
        if not row.get("roles"):
            row["roles"] = ["propietario"]
        if not row.get("status"):
            row["status"] = "active"

        def _q():
            return get_supabase().table(TABLE).insert(row).execute()
        res = await asyncio.to_thread(_q)
        return res.data[0]

    async def update(self, person_id: str, patch: dict) -> dict | None:
        clean = {k: v for k, v in patch.items() if k in _COLS}
        clean = _sync_primary(clean)

        def _q():
            return get_supabase().table(TABLE).update(clean).eq("id", person_id).execute()
        res = await asyncio.to_thread(_q)
        return (res.data or [None])[0]


people_repository = PeopleRepository()
