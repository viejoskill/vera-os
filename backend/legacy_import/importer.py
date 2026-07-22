"""VERA importa desde el CRM Varela (fuente real) — migración IDEMPOTENTE.

Lee `propiedades` del CRM (driver `crm_source`), mapea EXPLÍCITAMENTE el esquema del
CRM → Property (VERA), persiste vía PropertyRepository, descarga las fotos (URLs
externas) y las re-sube al Storage propio de VERA. Idempotente por `legacy_id` (el `id`
del CRM): si ya existe, ACTUALIZA en lugar de duplicar. Conserva el `codigo` comercial
(VAR-xxxxx) como campo visible independiente del id interno. Log de auditoría en Mongo.
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

from . import crm_source, store

logger = logging.getLogger("vera")

JOBS: dict[str, dict] = {}

_col_support: dict[str, bool] = {}

# --- Normalización de vocabulario CRM → VERA ------------------------------- #
_TYPE_MAP = {
    "casa": "casa", "ph": "ph", "departamento": "departamento", "depto": "departamento",
    "terreno / lote": "terreno", "terreno": "terreno", "lote": "terreno",
    "local comercial": "local", "local": "local", "oficina": "oficina", "cochera": "cochera",
}
_OPERATION_MAP = {"venta": "venta", "alquiler": "alquiler", "alquiler temporario": "alquiler_temporario"}
_STATUS_MAP = {"disponible": "active", "reservada": "reserved", "vendida": "sold", "alquilada": "sold"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _to_int(v) -> int:
    try:
        return int(float(str(v).strip()))
    except (ValueError, TypeError):
        return 0


def _norm(mapping: dict, value, default: str) -> str:
    return mapping.get((str(value or "").strip().lower()), default)


def _map_property(lg: dict) -> dict:
    """Mapeo EXPLÍCITO propiedades (CRM Varela) → Property (VERA)."""
    nombre = (lg.get("propietario_nombre") or "").strip()
    tel = (lg.get("propietario_tel") or "").strip()
    owner_obs_parts = []
    if nombre:
        owner_obs_parts.append(f"Propietario: {nombre}")
    if tel:
        owner_obs_parts.append(f"Tel: {tel}")
    antiguedad = (lg.get("antiguedad") or "").strip()
    condition = "" if antiguedad in ("", "-- Seleccionar --") else antiguedad

    return {
        "title": lg.get("titulo", "") or "",
        "type": _norm(_TYPE_MAP, lg.get("tipo"), "casa"),
        "operation": _norm(_OPERATION_MAP, lg.get("operacion"), "venta"),
        "price": lg.get("precio") or 0,
        "currency": "USD",
        "address": lg.get("direccion", "") or "",
        "neighborhood": lg.get("zona", "") or "",
        "city": lg.get("ciudad", "") or "",
        "province": lg.get("provincia", "") or "",
        "postal_code": lg.get("codigo_postal", "") or "",
        "bedrooms": _to_int(lg.get("dormitorios")),
        "bathrooms": _to_int(lg.get("banios")),
        "rooms": _to_int(lg.get("ambientes")),
        "area_m2": _to_int(lg.get("mts_cubiertos")),
        "lot_area_m2": _to_int(lg.get("mts")),
        "semi_covered_area_m2": _to_int(lg.get("mts_semicubiertos")),
        "floors": _to_int(lg.get("plantas")),
        "amenities": lg.get("amenities") or [],
        "condition": condition,
        "description": lg.get("descripcion", "") or "",
        "owner_observations": " · ".join(owner_obs_parts),
        "status": _norm(_STATUS_MAP, lg.get("estado"), "active"),
        "publications": _map_publications(lg),
    }


def _map_publications(lg: dict) -> dict:
    """Estado de publicación por canal, desde los flags del CRM. La URL pública se
    persiste desde el pipeline (fuente única): `?propiedad=<legacy_id>`."""
    import web_publisher  # deferido para evitar ciclos

    pubs: dict = {}
    now = _now()
    if lg.get("publicado_web"):
        url = web_publisher.web_url({"legacy_id": lg.get("id")})
        pubs["web-varela"] = {"status": "published", "lastSync": now, "url": url}
    if lg.get("publicado_ml"):
        pubs["mercadolibre"] = {"status": "published", "lastSync": now, "url": lg.get("ml_link") or ""}
    if lg.get("publicado_zp"):
        pubs["zonaprop"] = {"status": "published", "lastSync": now, "url": ""}
    return pubs


async def _supports_column(col: str) -> bool:
    """Detecta si `properties` tiene la columna `col` (requiere DDL del usuario)."""
    if col not in _col_support:
        try:
            def _probe():
                from supabase_client import get_supabase
                return get_supabase().table("properties").select(col).limit(1).execute()
            await asyncio.to_thread(_probe)
            _col_support[col] = True
        except Exception:  # noqa: BLE001
            _col_support[col] = False
    return _col_support[col]


async def _download(url: str) -> tuple[bytes, str]:
    async with httpx.AsyncClient(timeout=60, follow_redirects=True) as c:
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
        if not url:
            continue
        try:
            content, ct = await _download(url)
            object_path, stored = get_storage().build_object_path(wid, pid, "images", f"crm{_ext(ct, '.jpg')}")
            await get_storage().upload(config.BUCKET_IMAGES, object_path, content, ct)
            await property_repository.add_image({
                "property_id": pid, "workspace_id": wid, "bucket": config.BUCKET_IMAGES,
                "object_path": object_path, "original_name": f"foto-{idx + 1}", "stored_name": stored,
                "mime_type": ct, "size_bytes": len(content), "position": idx, "is_cover": idx == 0,
            })
            job["images_done"] += 1
        except Exception as e:  # noqa: BLE001
            job["errors"].append(f"Imagen ({url.split('/')[-1][:40]}): {e}")


async def run_import(job_id: str) -> None:
    job = JOBS[job_id]
    wid = config.DEFAULT_WORKSPACE_ID
    try:
        legacy = await crm_source.fetch_properties()
        job["total"] = len(legacy)
        has_legacy = await _supports_column("legacy_id")
        has_codigo = await _supports_column("codigo")
        job["legacy_column"] = has_legacy
        job["codigo_column"] = has_codigo

        for lg in legacy:
            lid = str(lg.get("id", "") or "")
            job["current"] = lg.get("titulo", lid)
            try:
                payload = _map_property(lg)
                if has_legacy:
                    payload["legacy_id"] = lid
                if has_codigo:
                    payload["codigo"] = lg.get("codigo", "") or ""

                mapped = await store.get_map(lid)
                existing = await property_repository.get(mapped["property_id"]) if mapped else None

                if existing:
                    pid = existing["id"]
                    await property_repository.update(pid, payload)
                    action = "actualizada"
                    job["updated"] += 1
                    do_media = len(existing.get("property_images") or []) == 0
                else:
                    created = await property_repository.create(payload, wid)
                    pid = created["id"]
                    action = "creada"
                    job["created"] += 1
                    do_media = True

                await store.set_map(lid, pid, wid)
                if do_media:
                    await _import_images(pid, wid, lg.get("fotos") or [], job)
                else:
                    job["items_media_skipped"] += 1

                job["items"].append({"legacy_id": lid, "codigo": lg.get("codigo", ""),
                                     "title": payload["title"], "property_id": pid, "action": action})
            except Exception as e:  # noqa: BLE001
                job["errors"].append(f"Propiedad {lid} ({lg.get('titulo', '')}): {e}")
                job["items"].append({"legacy_id": lid, "title": lg.get("titulo", ""),
                                     "property_id": None, "action": "error"})
            finally:
                job["processed"] += 1

        job["status"] = "done"
        job["current"] = ""
        job["finished_at"] = _now()
    except Exception as e:  # noqa: BLE001
        job["status"] = "error"
        job["error"] = str(e)
        logger.exception("CRM import failed")
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
        "errors": [], "items": [], "legacy_column": None, "codigo_column": None, "started_at": _now(),
    }
    asyncio.create_task(run_import(job_id))
    return job_id
