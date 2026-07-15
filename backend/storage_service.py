"""Storage abstraction. The rest of the app depends on StorageService, never on
Supabase. Swapping to S3/R2 later means adding one concrete class here only.

Object layout (scalable from day one):
  workspaces/{workspace_id}/properties/{property_id}/images/{uuid}.ext
  workspaces/{workspace_id}/properties/{property_id}/documents/{uuid}.ext
"""
import asyncio
from abc import ABC, abstractmethod
from pathlib import Path
from uuid import uuid4

import config
from supabase_client import get_supabase


class StorageService(ABC):
    @abstractmethod
    async def upload(self, bucket: str, object_path: str, content: bytes, content_type: str) -> None: ...

    @abstractmethod
    async def signed_url(self, bucket: str, object_path: str, expires_in: int) -> str: ...

    @abstractmethod
    async def delete(self, bucket: str, object_path: str) -> None: ...

    @staticmethod
    def build_object_path(
        workspace_id: str, property_id: str, kind: str, filename: str
    ) -> tuple[str, str]:
        """Returns (object_path, stored_name). `kind` is 'images' or 'documents'."""
        ext = Path(filename).suffix.lower()
        stored_name = f"{uuid4().hex}{ext}"
        object_path = (
            f"workspaces/{workspace_id}/properties/{property_id}/{kind}/{stored_name}"
        )
        return object_path, stored_name


class SupabaseStorageService(StorageService):
    def __init__(self) -> None:
        self.client = get_supabase()

    async def upload(self, bucket: str, object_path: str, content: bytes, content_type: str) -> None:
        def _do():
            return self.client.storage.from_(bucket).upload(
                path=object_path,
                file=content,
                file_options={"content-type": content_type, "upsert": "false"},
            )

        await asyncio.to_thread(_do)

    async def signed_url(self, bucket: str, object_path: str, expires_in: int) -> str:
        def _do():
            return self.client.storage.from_(bucket).create_signed_url(object_path, expires_in)

        res = await asyncio.to_thread(_do)
        return res.get("signedURL") or res.get("signedUrl") or ""

    async def delete(self, bucket: str, object_path: str) -> None:
        def _do():
            return self.client.storage.from_(bucket).remove([object_path])

        await asyncio.to_thread(_do)


_storage: StorageService | None = None


def get_storage() -> StorageService:
    global _storage
    if _storage is None:
        if not config.supabase_configured():
            raise RuntimeError("Supabase Storage is not configured")
        _storage = SupabaseStorageService()
    return _storage
