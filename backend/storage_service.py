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
    async def upload(
        self, bucket: str, object_path: str, content: bytes, content_type: str,
        upsert: bool = False, cache_control: str | None = None,
    ) -> None: ...

    @abstractmethod
    async def signed_url(self, bucket: str, object_path: str, expires_in: int) -> str: ...

    @abstractmethod
    def get_public_url(self, bucket: str, object_path: str) -> str: ...

    @abstractmethod
    async def create_bucket_if_missing(self, bucket: str) -> None: ...

    @abstractmethod
    async def download(self, bucket: str, object_path: str) -> bytes: ...

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

    async def upload(
        self, bucket: str, object_path: str, content: bytes, content_type: str,
        upsert: bool = False, cache_control: str | None = None,
    ) -> None:
        def _do():
            file_options = {"content-type": content_type, "upsert": "true" if upsert else "false"}
            if cache_control:
                file_options["cache-control"] = cache_control
            return self.client.storage.from_(bucket).upload(
                path=object_path,
                file=content,
                file_options=file_options,
            )

        await asyncio.to_thread(_do)

    async def signed_url(self, bucket: str, object_path: str, expires_in: int) -> str:
        def _do():
            return self.client.storage.from_(bucket).create_signed_url(object_path, expires_in)

        res = await asyncio.to_thread(_do)
        return res.get("signedURL") or res.get("signedUrl") or ""

    def get_public_url(self, bucket: str, object_path: str) -> str:
        """Solo tiene sentido para buckets marcados 'public' (sin firma, cacheable).
        Construcción de URL pura (sin red): no implica que el objeto exista."""
        return self.client.storage.from_(bucket).get_public_url(object_path)

    async def create_bucket_if_missing(self, bucket: str) -> None:
        def _do():
            try:
                self.client.storage.create_bucket(bucket, options={"public": True})
            except Exception as e:  # noqa: BLE001
                msg = str(e).lower()
                if "already exist" not in msg and "duplicate" not in msg:
                    raise

        await asyncio.to_thread(_do)

    async def download(self, bucket: str, object_path: str) -> bytes:
        """Descarga el objeto ORIGINAL tal cual fue subido (nunca un derivado)."""
        def _do():
            return self.client.storage.from_(bucket).download(object_path)

        return await asyncio.to_thread(_do)

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
