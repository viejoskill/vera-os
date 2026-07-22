"""API REST del módulo Documentos (`/api/documents`).

Contrato camelCase (como el resto de VERA); CRUD básico. NO genera PDFs ni
integra firmas (solo modelo).
"""
from typing import Optional

from fastapi import APIRouter, HTTPException, Response

import config
from documents import service
from documents.models import (
    CreateDocumentRequest,
    CreateTemplateRequest,
    NewTemplateVersionRequest,
    RelationshipInput,
    ResolveRequest,
    SendSignatureRequest,
    SetSignatureMethodRequest,
    SignatureInput,
    TransitionRequest,
    UpdateDocumentRequest,
    UpdateSignatureRequest,
    UpdateTemplateRequest,
    to_api_document,
    to_api_participant,
    to_api_relationship,
    to_api_signature,
    to_api_template,
)

router = APIRouter(prefix="/documents", tags=["documents"])


def _ensure() -> None:
    if not config.supabase_configured():
        raise HTTPException(503, "Supabase no está configurado.")


# ------------------------------- Templates -------------------------------- #
@router.get("/templates")
async def list_templates(category: Optional[str] = None, status: Optional[str] = None,
                         templateKey: Optional[str] = None):
    _ensure()
    from documents.repository import template_repository
    rows = await template_repository.list(category=category, status=status, template_key=templateKey)
    return [to_api_template(r) for r in rows]


@router.post("/templates", status_code=201)
async def create_template(body: CreateTemplateRequest):
    _ensure()
    return to_api_template(await service.create_template(body.model_dump()))


@router.get("/templates/{template_id}")
async def get_template(template_id: str):
    _ensure()
    from documents.repository import template_repository
    tpl = await template_repository.get(template_id)
    if tpl is None:
        raise HTTPException(404, "Template no encontrado")
    return to_api_template(tpl)


@router.get("/templates/key/{template_key}/versions")
async def template_versions(template_key: str):
    _ensure()
    from documents.repository import template_repository
    return [to_api_template(r) for r in await template_repository.versions(template_key)]


@router.post("/templates/{template_id}/versions", status_code=201)
async def create_version(template_id: str, body: NewTemplateVersionRequest):
    _ensure()
    return to_api_template(await service.new_template_version(template_id, body.model_dump(exclude_none=True)))


@router.patch("/templates/{template_id}")
async def update_template(template_id: str, body: UpdateTemplateRequest):
    _ensure()
    return to_api_template(await service.update_template(template_id, body.model_dump(exclude_none=True)))


# ------------------------------- Documents -------------------------------- #
@router.get("")
async def list_documents(status: Optional[str] = None, templateKey: Optional[str] = None,
                         entityType: Optional[str] = None, entityId: Optional[str] = None):
    _ensure()
    rows = await service.list_documents(
        status=status, template_key=templateKey, entity_type=entityType, entity_id=entityId,
    )
    return [to_api_document(r) for r in rows]


@router.post("/resolve")
async def resolve_document(body: ResolveRequest):
    """Previsualiza qué completa VERA y qué falta, SIN crear el documento."""
    _ensure()
    return await service.resolve_document(body.model_dump())


@router.post("", status_code=201)
async def create_document(body: CreateDocumentRequest):
    _ensure()
    return to_api_document(await service.create_document(body.model_dump()))


@router.get("/{document_id}")
async def get_document(document_id: str):
    _ensure()
    return to_api_document(await service.get_document(document_id))


@router.patch("/{document_id}")
async def update_document(document_id: str, body: UpdateDocumentRequest):
    _ensure()
    return to_api_document(await service.update_document(document_id, body.model_dump(exclude_none=True)))


@router.post("/{document_id}/transition")
async def transition_document(document_id: str, body: TransitionRequest):
    _ensure()
    return to_api_document(await service.transition_document(document_id, body.status, actor=body.actor))


@router.get("/{document_id}/history")
async def document_history(document_id: str):
    _ensure()
    return await service.document_history(document_id)


# ----------------------------- Relationships ------------------------------ #
@router.get("/{document_id}/relationships")
async def list_relationships(document_id: str):
    _ensure()
    from documents.repository import relationship_repository
    return [to_api_relationship(r) for r in await relationship_repository.list(document_id)]


@router.post("/{document_id}/relationships", status_code=201)
async def add_relationship(document_id: str, body: RelationshipInput):
    _ensure()
    return to_api_relationship(await service.add_relationship(document_id, body.model_dump()))


@router.delete("/{document_id}/relationships/{rel_id}", status_code=204)
async def remove_relationship(document_id: str, rel_id: str):
    _ensure()
    await service.remove_relationship(document_id, rel_id)


# ------------------------------- Signatures ------------------------------- #
@router.get("/{document_id}/signatures")
async def list_signatures(document_id: str):
    _ensure()
    from documents.repository import signature_repository
    return [to_api_signature(r) for r in await signature_repository.list(document_id)]


@router.post("/{document_id}/signatures", status_code=201)
async def add_signature(document_id: str, body: SignatureInput):
    _ensure()
    return to_api_signature(await service.add_signature(document_id, body.model_dump()))


@router.patch("/{document_id}/signatures/{sig_id}")
async def update_signature(document_id: str, sig_id: str, body: UpdateSignatureRequest):
    _ensure()
    return to_api_signature(await service.update_signature(document_id, sig_id, body.status))


# ============================ Motor de firmas ============================== #
@router.get("/{document_id}/participants")
async def list_participants(document_id: str):
    _ensure()
    return [to_api_participant(p) for p in await service.list_participants(document_id)]


@router.patch("/{document_id}/signature-method")
async def set_signature_method(document_id: str, body: SetSignatureMethodRequest):
    _ensure()
    return to_api_document(await service.set_signature_method(document_id, body.signature_method))


@router.post("/{document_id}/participants/{participant_id}/send")
async def send_signature(document_id: str, participant_id: str, body: SendSignatureRequest):
    """Genera el enlace seguro de firma y arma el envío por canal (whatsapp|email|link)."""
    _ensure()
    return await service.send_signature(document_id, participant_id, body.channel, body.base_url)


@router.get("/by-property/{property_id}")
async def documents_by_property(property_id: str):
    """Documentos del módulo vinculados a una propiedad (para el checklist)."""
    _ensure()
    return [to_api_document(d) for d in await service.list_by_property(property_id)]


@router.get("/{document_id}/pdf")
async def document_pdf(document_id: str):
    """Genera y descarga el PDF del documento a demanda."""
    _ensure()
    data, filename = await service.generate_pdf(document_id)
    return Response(
        content=data,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )
