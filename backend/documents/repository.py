"""Persistencia del módulo Documentos (Supabase vía PostgREST).

Los servicios dependen de estos repos, nunca del SDK de Supabase directamente.
Migrar de motor en el futuro toca solo este archivo.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Optional

from supabase_client import get_supabase

TABLE_TEMPLATES = "document_templates"
TABLE_DOCUMENTS = "documents"
TABLE_RELATIONSHIPS = "document_relationships"
TABLE_SIGNATURES = "document_signatures"
TABLE_PARTICIPANTS = "document_participants"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _c():
    return get_supabase()


# --- Templates -------------------------------------------------------------- #
class TemplateRepository:
    async def list(self, category: Optional[str] = None, status: Optional[str] = None,
                   template_key: Optional[str] = None) -> list[dict]:
        def _do():
            q = _c().table(TABLE_TEMPLATES).select("*").order("template_key").order("version", desc=True)
            if category:
                q = q.eq("category", category)
            if status:
                q = q.eq("status", status)
            if template_key:
                q = q.eq("template_key", template_key)
            return q.execute()
        return (await asyncio.to_thread(_do)).data or []

    async def get(self, template_id: str) -> Optional[dict]:
        def _do():
            return _c().table(TABLE_TEMPLATES).select("*").eq("id", template_id).limit(1).execute()
        rows = (await asyncio.to_thread(_do)).data or []
        return rows[0] if rows else None

    async def versions(self, template_key: str) -> list[dict]:
        def _do():
            return (_c().table(TABLE_TEMPLATES).select("*").eq("template_key", template_key)
                    .order("version", desc=True).execute())
        return (await asyncio.to_thread(_do)).data or []

    async def max_version(self, template_key: str) -> int:
        rows = await self.versions(template_key)
        return max((r.get("version", 0) for r in rows), default=0)

    async def insert(self, row: dict) -> dict:
        def _do():
            return _c().table(TABLE_TEMPLATES).insert(row).execute()
        return (await asyncio.to_thread(_do)).data[0]

    async def update(self, template_id: str, patch: dict) -> Optional[dict]:
        patch = {**patch, "updated_at": _now()}
        def _do():
            return _c().table(TABLE_TEMPLATES).update(patch).eq("id", template_id).execute()
        rows = (await asyncio.to_thread(_do)).data or []
        return rows[0] if rows else None


# --- Documents -------------------------------------------------------------- #
class DocumentRepository:
    async def list(self, status: Optional[str] = None, template_key: Optional[str] = None,
                   entity_type: Optional[str] = None, entity_id: Optional[str] = None) -> list[dict]:
        def _do():
            q = _c().table(TABLE_DOCUMENTS).select("*").order("created_at", desc=True)
            if status:
                q = q.eq("status", status)
            if template_key:
                q = q.eq("template_key", template_key)
            return q.execute()
        rows = (await asyncio.to_thread(_do)).data or []
        if entity_type and entity_id:
            ids = await self._document_ids_for_entity(entity_type, entity_id)
            rows = [r for r in rows if r["id"] in ids]
        return rows

    async def _document_ids_for_entity(self, entity_type: str, entity_id: str) -> set[str]:
        def _do():
            return (_c().table(TABLE_RELATIONSHIPS).select("document_id")
                    .eq("entity_type", entity_type).eq("entity_id", entity_id).execute())
        return {r["document_id"] for r in ((await asyncio.to_thread(_do)).data or [])}

    async def get(self, document_id: str) -> Optional[dict]:
        def _do():
            return _c().table(TABLE_DOCUMENTS).select("*").eq("id", document_id).limit(1).execute()
        rows = (await asyncio.to_thread(_do)).data or []
        return rows[0] if rows else None

    async def get_many(self, ids: list[str]) -> list[dict]:
        if not ids:
            return []
        def _do():
            return _c().table(TABLE_DOCUMENTS).select("*").in_("id", ids).execute()
        return (await asyncio.to_thread(_do)).data or []

    async def insert(self, row: dict) -> dict:
        def _do():
            return _c().table(TABLE_DOCUMENTS).insert(row).execute()
        return (await asyncio.to_thread(_do)).data[0]

    async def update(self, document_id: str, patch: dict) -> Optional[dict]:
        patch = {**patch, "updated_at": _now()}
        def _do():
            return _c().table(TABLE_DOCUMENTS).update(patch).eq("id", document_id).execute()
        rows = (await asyncio.to_thread(_do)).data or []
        return rows[0] if rows else None


# --- Relationships ---------------------------------------------------------- #
class RelationshipRepository:
    async def list(self, document_id: str) -> list[dict]:
        def _do():
            return (_c().table(TABLE_RELATIONSHIPS).select("*").eq("document_id", document_id)
                    .order("created_at").execute())
        return (await asyncio.to_thread(_do)).data or []

    async def list_by_entity(self, entity_type: str, entity_id: str) -> list[dict]:
        def _do():
            return (_c().table(TABLE_RELATIONSHIPS).select("*")
                    .eq("entity_type", entity_type).eq("entity_id", entity_id).execute())
        return (await asyncio.to_thread(_do)).data or []

    async def insert_many(self, rows: list[dict]) -> list[dict]:
        if not rows:
            return []
        def _do():
            return _c().table(TABLE_RELATIONSHIPS).insert(rows).execute()
        return (await asyncio.to_thread(_do)).data or []

    async def delete(self, rel_id: str) -> None:
        def _do():
            return _c().table(TABLE_RELATIONSHIPS).delete().eq("id", rel_id).execute()
        await asyncio.to_thread(_do)


# --- Signatures ------------------------------------------------------------- #
class SignatureRepository:
    async def list(self, document_id: str) -> list[dict]:
        def _do():
            return (_c().table(TABLE_SIGNATURES).select("*").eq("document_id", document_id)
                    .order("sign_order").order("created_at").execute())
        return (await asyncio.to_thread(_do)).data or []

    async def insert_many(self, rows: list[dict]) -> list[dict]:
        if not rows:
            return []
        def _do():
            return _c().table(TABLE_SIGNATURES).insert(rows).execute()
        return (await asyncio.to_thread(_do)).data or []

    async def update(self, sig_id: str, patch: dict) -> Optional[dict]:
        patch = {**patch, "updated_at": _now()}
        def _do():
            return _c().table(TABLE_SIGNATURES).update(patch).eq("id", sig_id).execute()
        rows = (await asyncio.to_thread(_do)).data or []
        return rows[0] if rows else None


# --- Participants (motor de firmas) ----------------------------------------- #
class ParticipantRepository:
    async def list(self, document_id: str) -> list[dict]:
        def _do():
            return (_c().table(TABLE_PARTICIPANTS).select("*").eq("document_id", document_id)
                    .order("order").order("created_at").execute())
        return (await asyncio.to_thread(_do)).data or []

    async def get(self, participant_id: str) -> Optional[dict]:
        def _do():
            return (_c().table(TABLE_PARTICIPANTS).select("*")
                    .eq("id", participant_id).limit(1).execute())
        rows = (await asyncio.to_thread(_do)).data or []
        return rows[0] if rows else None

    async def find_by_token(self, token: str) -> Optional[dict]:
        def _do():
            return (_c().table(TABLE_PARTICIPANTS).select("*")
                    .eq("sign_token", token).limit(1).execute())
        rows = (await asyncio.to_thread(_do)).data or []
        return rows[0] if rows else None

    async def list_many(self, document_ids: list[str]) -> list[dict]:
        if not document_ids:
            return []
        def _do():
            return (_c().table(TABLE_PARTICIPANTS).select("*")
                    .in_("document_id", document_ids).order("order").execute())
        return (await asyncio.to_thread(_do)).data or []

    async def insert_many(self, rows: list[dict]) -> list[dict]:
        if not rows:
            return []
        def _do():
            return _c().table(TABLE_PARTICIPANTS).insert(rows).execute()
        return (await asyncio.to_thread(_do)).data or []

    async def update(self, participant_id: str, patch: dict) -> Optional[dict]:
        patch = {**patch, "updated_at": _now()}
        def _do():
            return _c().table(TABLE_PARTICIPANTS).update(patch).eq("id", participant_id).execute()
        rows = (await asyncio.to_thread(_do)).data or []
        return rows[0] if rows else None


template_repository = TemplateRepository()
document_repository = DocumentRepository()
relationship_repository = RelationshipRepository()
signature_repository = SignatureRepository()
participant_repository = ParticipantRepository()
