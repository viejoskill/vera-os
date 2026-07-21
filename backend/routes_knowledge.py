"""Endpoints del Knowledge Engine (VERA Brain).

Consulta estructurada del activo de conocimiento (ej. 'todos los agrimensores').
La vista por persona vive en `routes_people` (/people/{id}/knowledge)."""
from typing import Optional

from fastapi import APIRouter

from knowledge import store

router = APIRouter(prefix="/knowledge", tags=["knowledge"])


@router.get("/facts")
async def query_facts(type: Optional[str] = None, value: Optional[str] = None, limit: int = 200):
    """Consulta hechos estructurados. Ej: /knowledge/facts?type=role&value=Agrimensor"""
    return {"facts": await store.query_facts(type, value, limit)}
