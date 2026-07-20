"""Endpoints de migración (lado VERA). Importa desde el CRM Varela (fuente real) y
expone el progreso por polling. Incluye un reset para dejar el workspace limpio antes
de importar la cartera real. Migración ÚNICA, no sincronización permanente."""
import logging

from fastapi import APIRouter, HTTPException

import config
from legacy_import import store
from legacy_import.importer import JOBS, start_job
from property_repository import property_repository
from storage_service import get_storage

router = APIRouter(prefix="/migration", tags=["migration"])
logger = logging.getLogger("vera")


@router.post("/import-legacy")
async def import_legacy():
    if not config.supabase_configured():
        raise HTTPException(503, "Storage/Base de VERA no configurados.")
    if not config.crm_configured():
        raise HTTPException(503, "CRM real no configurado (CRM_SUPABASE_URL / CRM_SUPABASE_KEY).")
    job_id = start_job()
    return {"job_id": job_id}


@router.get("/status/{job_id}")
async def status(job_id: str):
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(404, "Job de migración no encontrado.")
    return job


@router.post("/reset")
async def reset_workspace(confirm: str = ""):
    """Borra TODAS las propiedades del workspace (+ objetos de Storage y mapa de
    idempotencia). Deja VERA como fuente de verdad para importar la cartera real.
    Requiere ?confirm=BORRAR-TODO para evitar borrados accidentales."""
    if not config.supabase_configured():
        raise HTTPException(503, "Supabase de VERA no configurado.")
    if confirm != "BORRAR-TODO":
        raise HTTPException(400, "Confirmación requerida: ?confirm=BORRAR-TODO")

    deleted, assets, errors = 0, 0, []
    for st in (None, "archived"):
        rows = await property_repository.list_properties(status=st if st else "all")
        for prop in rows:
            for asset in (prop.get("property_images") or []) + (prop.get("property_documents") or []):
                try:
                    await get_storage().delete(asset["bucket"], asset["object_path"])
                    assets += 1
                except Exception:  # noqa: BLE001
                    pass
            try:
                await property_repository.delete(prop["id"])
                deleted += 1
            except Exception as e:  # noqa: BLE001
                errors.append(f"{prop.get('id')}: {e}")

    maps_cleared = await store.clear_maps()
    logger.info("Workspace reset: %d propiedades borradas, %d assets, %d mapas", deleted, assets, maps_cleared)
    return {"deleted": deleted, "assets_deleted": assets, "maps_cleared": maps_cleared, "errors": errors}
