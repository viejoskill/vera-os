"""VERA importa desde el CRM Legacy — migración ÚNICA e IDEMPOTENTE.

Consume el exportador (`GET /api/export/properties`), mapea explícitamente
LegacyProperty → Property, persiste vía PropertyRepository, descarga imágenes/documentos
(por URL) y los re-sube al Storage propio de VERA. Idempotente por `legacy_id`: si ya
existe, ACTUALIZA en lugar de duplicar. No borra información existente. Log de auditoría.
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone

import httpx

import config
from property_repository import property_repository
from storage_service import get_storage

from . import store

logger = logging.getLogger("vera")

# Registro de jobs en memoria (progreso consultable por polling).
JOBS: dict[str, dict] = {}

_legacy_col: bool | None = None


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _map_property(lg: dict) -> dict:
    """Mapeo EXPLÍCITO LegacyProperty (campos en español del CRM) → Property (VERA)."""
    return {
        "title": lg.get("titulo", ""),
        "type": lg.get("tipo", ""),
        "operation": lg.get("operacion", ""),
        "price": lg.get("precio"),
        "currency": lg.get("moneda", "USD"),
        "address": lg.get("direccion", ""),
        "neighborhood": lg.get("barrio", ""),
        "city": lg.get("ciudad", ""),
        "province": lg.get("provincia", ""),
        "bedrooms": lg.get("dormitorios") or 0,
        "bathrooms": lg.get("banos") or 0,
        "rooms": lg.get("ambientes") or 0,
        "area_m2": lg.get("superficie_cubierta") or 0,
        "lot_area_m2": lg.get("superficie_terreno") or 0,
        "parking_covered": lg.get("cocheras") or 0,
        "amenities": lg.get("comodidades") or [],
        "condition": lg.get("estado_propiedad", ""),
        "year_built": str(lg.get("anio") or ""),
        "description": lg.get("descripcion", ""),
        "status": "active",
    }


async def _supports_legacy_col() -> bool:
    """Detecta si la tabla `properties` ya tiene la columna legacy_id (requiere SQL)."""
    global _legacy_col
    if _legacy_col is None:
        try:
            def _probe():
                from supabase_client import get_supabase
                return get_supabase().table("properties").select("legacy_id").limit(1).execute()
            await asyncio.to_thread(_probe)
            _legacy_col = True
        except Exception:  # noqa: BLE001
            _legacy_col = False
    return _legacy_col


async def _download(url: str) -> tuple[bytes, str]:
    async with httpx.AsyncClient(timeout=40, follow_redirects=True) as c:
        r = await c.get(url)
        r.raise_for_status()
        return r.content, r.headers.get("content-type", "application/octet-stream")


def _ext(ct: str, fallback: str) -> str:
    ct = (ct or "").lower()
    if "png" in ct:
        return ".png"
    if "webp" in ct:
        return ".webp"
    if "pdf" in ct:
        return ".pdf"
    if "jpeg" in ct or "jpg" in ct:
        return ".jpg"
    return fallback


async def _import_images(pid: str, wid: str, urls: list[str], job: dict) -> None:
    for idx, url in enumerate(urls):
        try:
            content, ct = await _download(url)
            object_path, stored = get_storage().build_object_path(wid, pid, "images", f"legacy{_ext(ct, '.jpg')}")
            await get_storage().upload(config.BUCKET_IMAGES, object_path, content, ct)
            await property_repository.add_image({
                "property_id": pid, "workspace_id": wid, "bucket": config.BUCKET_IMAGES,
                "object_path": object_path, "original_name": f"legacy-{idx + 1}", "stored_name": stored,
                "mime_type": ct, "size_bytes": len(content), "position": idx, "is_cover": idx == 0,
            })
            job["images_done"] += 1
        except Exception as e:  # noqa: BLE001
            job["errors"].append(f"Imagen ({url.split('/')[-1]}): {e}")


async def _import_documents(pid: str, wid: str, docs: list[dict], job: dict) -> None:
    for d in docs:
        url = d.get("url")
        if not url:
            continue
        try:
            content, ct = await _download(url)
            object_path, stored = get_storage().build_object_path(wid, pid, "documents", d.get("nombre") or f"doc{_ext(ct, '.pdf')}")
            await get_storage().upload(config.BUCKET_DOCUMENTS, object_path, content, ct)
            await property_repository.add_document({
                "property_id": pid, "workspace_id": wid, "doc_type": d.get("tipo", "otro"),
                "bucket": config.BUCKET_DOCUMENTS, "object_path": object_path,
                "original_name": d.get("nombre") or stored, "stored_name": stored,
                "mime_type": ct, "size_bytes": len(content),
            })
            job["docs_done"] += 1
        except Exception as e:  # noqa: BLE001
            job["errors"].append(f"Documento ({d.get('nombre')}): {e}")


async def run_import(job_id: str) -> None:
    job = JOBS[job_id]
    wid = config.DEFAULT_WORKSPACE_ID
    try:
        async with httpx.AsyncClient(timeout=40) as c:
            r = await c.get(config.LEGACY_EXPORT_URL)
            r.raise_for_status()
            legacy = r.json().get("properties", [])
        job["total"] = len(legacy)
        supports = await _supports_legacy_col()
        job["legacy_column"] = supports

        for lg in legacy:
            lid = lg.get("legacy_id", "")
            job["current"] = lg.get("titulo", lid)
            try:
                payload = _map_property(lg)
                if supports:
                    payload["legacy_id"] = lid

                mapped = await store.get_map(lid)
                existing = await property_repository.get(mapped["property_id"]) if mapped else None

                if existing:
                    pid = existing["id"]
                    await property_repository.update(pid, payload)
                    action = "actualizada"
                    job["updated"] += 1
                    do_media = len(existing.get("property_images") or []) == 0  # no duplicar imágenes
                else:
                    created = await property_repository.create(payload, wid)
                    pid = created["id"]
                    action = "creada"
                    job["created"] += 1
                    do_media = True

                await store.set_map(lid, pid, wid)
                if do_media:
                    await _import_images(pid, wid, lg.get("imagenes") or [], job)
                    await _import_documents(pid, wid, lg.get("documentos") or [], job)
                else:
                    job["items_media_skipped"] += 1

                job["items"].append({"legacy_id": lid, "title": payload["title"], "property_id": pid, "action": action})
            except Exception as e:  # noqa: BLE001
                job["errors"].append(f"Propiedad {lid} ({lg.get('titulo', '')}): {e}")
                job["items"].append({"legacy_id": lid, "title": lg.get("titulo", ""), "property_id": None, "action": "error"})
            finally:
                job["processed"] += 1

        job["status"] = "done"
        job["current"] = ""
        job["finished_at"] = _now()
    except Exception as e:  # noqa: BLE001
        job["status"] = "error"
        job["error"] = str(e)
        logger.exception("Legacy import failed")
    finally:
        try:
            await store.save_log({**job, "job_id": job_id})
        except Exception:  # noqa: BLE001
            logger.warning("No se pudo guardar el log de migración")


def start_job() -> str:
    job_id = uuid.uuid4().hex[:12]
    JOBS[job_id] = {
        "status": "running", "total": 0, "processed": 0, "created": 0, "updated": 0,
        "images_done": 0, "docs_done": 0, "items_media_skipped": 0, "current": "",
        "errors": [], "items": [], "legacy_column": None, "started_at": _now(),
    }
    asyncio.create_task(run_import(job_id))
    return job_id
