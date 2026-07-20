"""Endpoints de migración (lado VERA). Dispara la importación desde el CRM Legacy y
expone el progreso por polling. Migración ÚNICA, no sincronización permanente."""
from fastapi import APIRouter, HTTPException

import config
from legacy_import.importer import JOBS, start_job

router = APIRouter(prefix="/migration", tags=["migration"])


@router.post("/import-legacy")
async def import_legacy():
    if not config.supabase_configured():
        raise HTTPException(503, "Storage/Base no configurados.")
    job_id = start_job()
    return {"job_id": job_id}


@router.get("/status/{job_id}")
async def status(job_id: str):
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(404, "Job de migración no encontrado.")
    return job
