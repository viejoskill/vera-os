"""Driver de lectura del CRM Varela (fuente real).

El CRM es una app client-side que expone su Supabase con una key anon pública; acá
leemos la tabla `propiedades` por PostgREST (SOLO lectura). Devuelve dicts crudos con
el esquema del CRM; el mapeo explícito a VERA vive en el importador.

Cambiar de CRM = reemplazar esta función (contrato: async -> list[dict]).
"""
from __future__ import annotations

import httpx

import config


async def fetch_properties() -> list[dict]:
    if not config.crm_configured():
        raise RuntimeError("CRM real no configurado (CRM_SUPABASE_URL / CRM_SUPABASE_KEY).")
    url = f"{config.CRM_SUPABASE_URL}/rest/v1/propiedades"
    headers = {
        "apikey": config.CRM_SUPABASE_KEY,
        "Authorization": f"Bearer {config.CRM_SUPABASE_KEY}",
    }
    async with httpx.AsyncClient(timeout=60, follow_redirects=True) as c:
        r = await c.get(url, headers=headers, params={"select": "*", "order": "created_at.asc"})
        r.raise_for_status()
        return r.json()
