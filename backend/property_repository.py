"""Persistence for properties (Supabase via PostgREST).
Routes/services depend on this class, never on the Supabase SDK directly.
Migrating to another store later touches only this file."""
import asyncio
from typing import Optional

from supabase_client import get_supabase

TABLE_PROPERTIES = "properties"
TABLE_IMAGES = "property_images"
TABLE_DOCUMENTS = "property_documents"

PROPERTY_WITH_IMAGES = "*, property_images(*)"
PROPERTY_FULL = "*, property_images(*), property_documents(*)"


class SupabasePropertyRepository:
    def _client(self):
        return get_supabase()

    async def list(
        self, status: Optional[str] = None, query: Optional[str] = None
    ) -> list[dict]:
        def _do():
            q = (
                self._client()
                .table(TABLE_PROPERTIES)
                .select(PROPERTY_WITH_IMAGES)
                .order("created_at", desc=True)
            )
            if status and status != "all":
                q = q.eq("status", status)
            return q.execute()

        res = await asyncio.to_thread(_do)
        rows = res.data or []
        if query:
            q = query.strip().lower()
            rows = [
                r
                for r in rows
                if q
                in f"{r.get('title', '')} {r.get('neighborhood', '')} "
                f"{r.get('city', '')} {r.get('address', '')}".lower()
            ]
        return rows

    async def get(self, property_id: str) -> Optional[dict]:
        def _do():
            return (
                self._client()
                .table(TABLE_PROPERTIES)
                .select(PROPERTY_FULL)
                .eq("id", property_id)
                .limit(1)
                .execute()
            )

        res = await asyncio.to_thread(_do)
        rows = res.data or []
        return rows[0] if rows else None

    async def create(self, data: dict, workspace_id: str) -> Optional[dict]:
        payload = {**data, "workspace_id": workspace_id}

        def _do():
            return self._client().table(TABLE_PROPERTIES).insert(payload).execute()

        res = await asyncio.to_thread(_do)
        row = (res.data or [None])[0]
        return await self.get(row["id"]) if row else None

    async def update(self, property_id: str, patch: dict) -> Optional[dict]:
        if not patch:
            return await self.get(property_id)

        def _do():
            return (
                self._client()
                .table(TABLE_PROPERTIES)
                .update(patch)
                .eq("id", property_id)
                .execute()
            )

        res = await asyncio.to_thread(_do)
        if not (res.data or []):
            return None
        return await self.get(property_id)

    async def delete(self, property_id: str) -> bool:
        def _do():
            return (
                self._client()
                .table(TABLE_PROPERTIES)
                .delete()
                .eq("id", property_id)
                .execute()
            )

        res = await asyncio.to_thread(_do)
        return bool(res.data)

    # --- files ---------------------------------------------------------------
    async def add_image(self, image: dict) -> dict:
        def _do():
            return self._client().table(TABLE_IMAGES).insert(image).execute()

        res = await asyncio.to_thread(_do)
        return (res.data or [None])[0]

    async def add_document(self, doc: dict) -> dict:
        def _do():
            return self._client().table(TABLE_DOCUMENTS).insert(doc).execute()

        res = await asyncio.to_thread(_do)
        return (res.data or [None])[0]

    async def get_image(self, image_id: str) -> Optional[dict]:
        def _do():
            return (
                self._client()
                .table(TABLE_IMAGES)
                .select("*")
                .eq("id", image_id)
                .limit(1)
                .execute()
            )

        res = await asyncio.to_thread(_do)
        rows = res.data or []
        return rows[0] if rows else None

    async def get_document(self, doc_id: str) -> Optional[dict]:
        def _do():
            return (
                self._client()
                .table(TABLE_DOCUMENTS)
                .select("*")
                .eq("id", doc_id)
                .limit(1)
                .execute()
            )

        res = await asyncio.to_thread(_do)
        rows = res.data or []
        return rows[0] if rows else None

    async def delete_image(self, image_id: str) -> None:
        def _do():
            return self._client().table(TABLE_IMAGES).delete().eq("id", image_id).execute()

        await asyncio.to_thread(_do)

    async def delete_document(self, doc_id: str) -> None:
        def _do():
            return (
                self._client().table(TABLE_DOCUMENTS).delete().eq("id", doc_id).execute()
            )

        await asyncio.to_thread(_do)


property_repository = SupabasePropertyRepository()
