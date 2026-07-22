"""Servicios del módulo Documentos — orquestación y reglas de arquitectura.

CRUD básico + versionado de templates + ciclo de vida único con historial por
eventos. La generación de PDF y la firma NO se implementan en este sprint.
"""
import hashlib
import json
from datetime import datetime, timezone

from fastapi import HTTPException

from documents import events
from documents.models import (
    DOCUMENT_TRANSITIONS,
    ENTITY_TYPES,
    TEMPLATE_CATEGORIES,
)
from documents.repository import (
    document_repository,
    relationship_repository,
    signature_repository,
    template_repository,
)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# =========================== Templates (versionado) ======================== #
async def create_template(data: dict) -> dict:
    if data.get("category") not in TEMPLATE_CATEGORIES:
        raise HTTPException(422, f"category inválida. Válidas: {TEMPLATE_CATEGORIES}")
    existing = await template_repository.max_version(data["template_key"])
    if existing:
        raise HTTPException(409, "El template_key ya existe. Usá /versions para una nueva versión.")
    row = {
        "template_key": data["template_key"],
        "name": data["name"],
        "category": data["category"],
        "version": 1,
        "description": data.get("description", ""),
        "variables": data.get("variables", []),
        "body": data.get("body"),
        "status": data.get("status", "draft"),
    }
    return await template_repository.insert(row)


async def new_template_version(template_id: str, patch: dict) -> dict:
    """Crea v+1 a partir de una versión existente (las versiones son inmutables)."""
    base = await template_repository.get(template_id)
    if base is None:
        raise HTTPException(404, "Template no encontrado")
    next_version = await template_repository.max_version(base["template_key"]) + 1
    row = {
        "template_key": base["template_key"],
        "name": patch.get("name") or base["name"],
        "category": base["category"],
        "version": next_version,
        "description": patch.get("description") if patch.get("description") is not None else base.get("description", ""),
        "variables": patch.get("variables") if patch.get("variables") is not None else base.get("variables", []),
        "body": patch.get("body") if patch.get("body") is not None else base.get("body"),
        "status": "draft",
    }
    return await template_repository.insert(row)


async def update_template(template_id: str, patch: dict) -> dict:
    clean = {k: v for k, v in patch.items() if v is not None}
    updated = await template_repository.update(template_id, clean)
    if updated is None:
        raise HTTPException(404, "Template no encontrado")
    return updated


# =============================== Documents ================================= #
def _hash_document(document: dict) -> str:
    """Hash de integridad sobre el snapshot del template + variables resueltas."""
    material = json.dumps(
        {"snapshot": document.get("template_snapshot"), "resolved": document.get("resolved_variables")},
        sort_keys=True, ensure_ascii=False, default=str,
    )
    return hashlib.sha256(material.encode("utf-8")).hexdigest()


async def _hydrate(document: dict) -> dict:
    document["relationships"] = await relationship_repository.list(document["id"])
    document["signatures"] = await signature_repository.list(document["id"])
    return document


async def create_document(data: dict) -> dict:
    template = await template_repository.get(data["template_id"])
    if template is None:
        raise HTTPException(404, "Template no encontrado")
    rels = data.get("relationships") or []
    if not rels:
        raise HTTPException(422, "Un documento nunca existe aislado: requiere al menos una relación.")
    for r in rels:
        if r["entity_type"] not in ENTITY_TYPES:
            raise HTTPException(422, f"entity_type inválido: {r['entity_type']}")

    # Snapshot CONGELADO de la versión del template (trazabilidad/auditoría).
    snapshot = {
        "templateId": template["id"],
        "name": template["name"],
        "version": template["version"],
        "variables": template.get("variables", []),
        "body": template.get("body"),
    }
    row = {
        "template_id": template["id"],
        "template_key": template["template_key"],
        "template_version": template["version"],
        "template_snapshot": snapshot,
        "category": template["category"],
        "title": data.get("title") or template["name"],
        "status": "draft",
        "pdf_status": "none",
        "origin": data.get("origin", "manual"),
        "created_by": data.get("created_by"),
        "last_modified_by": data.get("created_by"),
    }
    document = await document_repository.insert(row)

    rel_rows = [{
        "document_id": document["id"],
        "entity_type": r["entity_type"],
        "entity_id": r["entity_id"],
        "role": r.get("role"),
    } for r in rels]
    await relationship_repository.insert_many(rel_rows)

    sig_rows = [{
        "document_id": document["id"],
        "signer_person_id": s["signer_person_id"],
        "signer_role": s.get("signer_role"),
        "sign_order": s.get("sign_order"),
        "status": "pending",
    } for s in (data.get("signatures") or [])]
    await signature_repository.insert_many(sig_rows)

    await events.record(events.CREATED, document, actor=data.get("created_by"))
    return await _hydrate(document)


async def list_documents(**filters) -> list[dict]:
    rows = await document_repository.list(**filters)
    return rows  # lista liviana (sin hidratar relaciones/firmas)


async def get_document(document_id: str) -> dict:
    document = await document_repository.get(document_id)
    if document is None:
        raise HTTPException(404, "Documento no encontrado")
    return await _hydrate(document)


async def update_document(document_id: str, patch: dict) -> dict:
    document = await document_repository.get(document_id)
    if document is None:
        raise HTTPException(404, "Documento no encontrado")
    if document.get("locked_at"):
        raise HTTPException(409, "El documento está bloqueado (firmado): no puede editarse.")
    clean = {k: v for k, v in patch.items() if v is not None}
    if clean:
        document = await document_repository.update(document_id, clean)
        await events.record(events.EDITED, document, actor=patch.get("last_modified_by"))
    return await _hydrate(document)


async def transition_document(document_id: str, target: str, actor: str | None = None) -> dict:
    document = await document_repository.get(document_id)
    if document is None:
        raise HTTPException(404, "Documento no encontrado")
    current = document.get("status", "draft")
    if target not in DOCUMENT_TRANSITIONS.get(current, set()):
        raise HTTPException(422, f"Transición inválida: {current} → {target}")

    patch: dict = {"status": target, "last_modified_by": actor}
    if target == "generated":
        # No se genera PDF en este sprint; se congela el hash de integridad.
        patch["document_hash"] = _hash_document(document)
    if target == "signed":
        patch["locked_at"] = _now()  # queda inmutable
    document = await document_repository.update(document_id, patch)

    await events.record(events.LIFECYCLE_EVENT[target], document, actor=actor)
    return await _hydrate(document)


async def document_history(document_id: str) -> list[dict]:
    if await document_repository.get(document_id) is None:
        raise HTTPException(404, "Documento no encontrado")
    return await events.history(document_id)


# ============================ Relationships ================================ #
async def add_relationship(document_id: str, rel: dict) -> dict:
    if await document_repository.get(document_id) is None:
        raise HTTPException(404, "Documento no encontrado")
    if rel["entity_type"] not in ENTITY_TYPES:
        raise HTTPException(422, f"entity_type inválido: {rel['entity_type']}")
    rows = await relationship_repository.insert_many([{
        "document_id": document_id,
        "entity_type": rel["entity_type"],
        "entity_id": rel["entity_id"],
        "role": rel.get("role"),
    }])
    return rows[0]


async def remove_relationship(document_id: str, rel_id: str) -> None:
    rels = await relationship_repository.list(document_id)
    if len(rels) <= 1:
        raise HTTPException(422, "Un documento no puede quedar sin relaciones.")
    await relationship_repository.delete(rel_id)


# ============================== Signatures ================================= #
async def add_signature(document_id: str, sig: dict) -> dict:
    if await document_repository.get(document_id) is None:
        raise HTTPException(404, "Documento no encontrado")
    rows = await signature_repository.insert_many([{
        "document_id": document_id,
        "signer_person_id": sig["signer_person_id"],
        "signer_role": sig.get("signer_role"),
        "sign_order": sig.get("sign_order"),
        "status": "pending",
    }])
    return rows[0]


async def update_signature(document_id: str, sig_id: str, status: str) -> dict:
    from documents.models import SIGNATURE_STATUSES
    if status not in SIGNATURE_STATUSES:
        raise HTTPException(422, f"status inválido. Válidos: {SIGNATURE_STATUSES}")
    stamp_field = {"shared": "shared_at", "signed": "signed_at", "rejected": "rejected_at"}.get(status)
    patch = {"status": status}
    if stamp_field:
        patch[stamp_field] = _now()
    updated = await signature_repository.update(sig_id, patch)
    if updated is None:
        raise HTTPException(404, "Firma no encontrada")
    return updated
