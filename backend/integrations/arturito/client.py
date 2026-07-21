"""Cliente tRPC de Arturito (autenticado con la API Key).

Superficie PULL/gestión. Hoy se usa para provisionar el webhook de VERA;
más adelante, para el backfill histórico (`pipeline.getLeadsByStage`). Detalles del
contrato en `/app/docs/ARTURITO_API_DISCOVERY.md`.

Transporte real (verificado): tRPC sin transformer, input JSON crudo en `?input=`,
auth `Authorization: Bearer art_…`, respuesta `{"result":{"data": …}}`."""
from __future__ import annotations

import json
import urllib.parse

import httpx

import config

BASE = "https://app.arturito.ai/api/trpc"


def _headers() -> dict:
    return {"Authorization": f"Bearer {config.ARTURITO_API_KEY}", "Content-Type": "application/json"}


async def query(procedure: str, input_obj: dict | None = None) -> dict:
    params = {}
    if input_obj is not None:
        params["input"] = json.dumps(input_obj, separators=(",", ":"))
    url = f"{BASE}/{procedure}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    async with httpx.AsyncClient(timeout=20.0) as c:
        r = await c.get(url, headers=_headers())
    r.raise_for_status()
    return r.json().get("result", {}).get("data")


async def mutate(procedure: str, input_obj: dict) -> dict:
    """Mutación tRPC (POST). El body va como `{"json": <input>}`? NO: sin transformer,
    el body es el input crudo."""
    async with httpx.AsyncClient(timeout=20.0) as c:
        r = await c.post(f"{BASE}/{procedure}", headers=_headers(), content=json.dumps(input_obj))
    r.raise_for_status()
    return r.json().get("result", {}).get("data")


# --- Helpers de gestión de webhooks ---------------------------------------- #
async def list_webhooks() -> list[dict]:
    return await query("webhooks.list", {"workspaceId": config.ARTURITO_WORKSPACE_ID})


async def create_webhook(url: str, events: list[str], agent_ids: list[str] | None = None) -> dict:
    return await mutate("webhooks.create", {
        "workspaceId": config.ARTURITO_WORKSPACE_ID,
        "url": url, "events": events, "agentIds": agent_ids or [],
    })


async def delete_webhook(webhook_id: str) -> dict:
    return await mutate("webhooks.delete", {
        "workspaceId": config.ARTURITO_WORKSPACE_ID, "id": webhook_id,
    })
