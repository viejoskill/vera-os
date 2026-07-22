"""Historial de documentos como EVENTOS (append-only, inmutable).

Reutiliza el Event Pipeline existente de VERA (MongoDB). NO se sobrescriben
estados: cada cambio agrega un evento. Deja preparada la integración con el
Knowledge Engine (un `document.signed` ya es un evento del ledger que un
projection handler futuro podrá consumir).
"""
from events import store as event_store
from events.pipeline import emit

SOURCE = "documents"

# Tipos de evento del módulo (ciclo de vida + firmas).
CREATED = "document.created"
EDITED = "document.edited"
GENERATED = "document.generated"
SHARED = "document.shared"
SIGNED = "document.signed"
ARCHIVED = "document.archived"
SIGNATURE_REQUESTED = "document.signature.requested"
SIGNATURE_SIGNED = "document.signature.signed"
SIGNATURE_REJECTED = "document.signature.rejected"

# Estado del documento → tipo de evento de ciclo de vida.
LIFECYCLE_EVENT = {
    "generated": GENERATED,
    "shared": SHARED,
    "signed": SIGNED,
    "archived": ARCHIVED,
}


async def record(event_type: str, document: dict, *, actor: str | None = None,
                 extra: dict | None = None) -> dict:
    """Agrega un evento de documento al ledger. `subject.document_id` permite
    consultar el historial por documento."""
    payload = {
        "documentId": document["id"],
        "templateKey": document.get("template_key"),
        "templateVersion": document.get("template_version"),
        "status": document.get("status"),
        "actor": actor,
        **(extra or {}),
    }
    return await emit(
        event_type, SOURCE,
        subject={"document_id": document["id"]},
        payload=payload,
    )


async def history(document_id: str) -> list[dict]:
    """Timeline del documento (todos sus eventos, más recientes primero)."""
    return await event_store.list_by_document(document_id)
