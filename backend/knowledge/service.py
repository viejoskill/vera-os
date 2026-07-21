"""Knowledge Engine — servicio de VERA Core. Orquesta: resumen → extractor (LLM)
→ fusión de hechos en el store. Es el único punto que 'aprende' de una conversación."""
from __future__ import annotations

import logging

from knowledge import extractor, store

logger = logging.getLogger("vera")


async def learn_from_summary(person_id: str, summary: str, source_ref: str, *, source: str = "arturito_summary", person_name: str = "") -> dict:
    """Extrae conocimiento del resumen y lo fusiona en el conocimiento de la Persona.
    Acumulativo e idempotente (re-procesar el mismo resumen confirma, no duplica)."""
    if not person_id or not summary or len(summary.strip()) < 15:
        return {"learned": 0, "facts": []}
    if not person_name:
        try:
            from people.repository import people_repository

            p = await people_repository.get(person_id)
            person_name = (p or {}).get("full_name") or ""
        except Exception:  # noqa: BLE001
            person_name = ""
    facts = await extractor.extract(summary, person_name)
    results = []
    for f in facts:
        outcome = await store.upsert_fact(person_id, f, source, source_ref)
        results.append({"type": f.get("type"), "value": f.get("value"), "outcome": outcome})
    logger.info("Knowledge Engine: persona %s aprendió %d hechos", person_id, len(results))
    return {"learned": len(results), "facts": results}


async def person_knowledge(person_id: str) -> dict:
    return await store.view(person_id)
