"""Modelos (contrato API camelCase) del módulo Documentos.

Estados y catálogos compartidos por TODOS los tipos de documento (sin estados
por tipo). Las variables pertenecen al Template, no al Document.
"""
from typing import Any, Optional

from schemas import CamelModel

# --- Catálogos / ciclos de vida (únicos para todos los tipos) --------------- #
TEMPLATE_CATEGORIES = [
    "autorizacion", "recibo", "reserva", "oferta", "contrato", "poder", "tasacion",
]
TEMPLATE_STATUSES = ["draft", "active", "deprecated", "archived"]

DOCUMENT_STATUSES = ["draft", "generated", "shared", "signed", "archived"]
# Transiciones permitidas del ciclo de vida único.
DOCUMENT_TRANSITIONS = {
    "draft": {"generated", "archived"},
    "generated": {"shared", "signed", "archived"},
    "shared": {"signed", "archived"},
    "signed": {"archived"},
    "archived": set(),
}
PDF_STATUSES = ["none", "pending", "generated", "failed"]

ENTITY_TYPES = ["property", "person", "opportunity", "task"]
SIGNATURE_STATUSES = ["pending", "shared", "signed", "rejected", "expired"]


# --- Templates -------------------------------------------------------------- #
class TemplateVariable(CamelModel):
    """Definición de una variable del template (NO su valor)."""
    key: str
    label: str
    source: str = "input"          # person | property | input | system
    role: Optional[str] = None     # p.ej. comprador/vendedor cuando source=person
    path: Optional[str] = None     # p.ej. full_name / address / price
    type: str = "text"             # text | money | date | number
    required: bool = False


class DocumentTemplate(CamelModel):
    id: str
    template_key: str
    name: str
    category: str
    version: int
    description: str = ""
    variables: list[TemplateVariable] = []
    body: Optional[Any] = None
    status: str = "draft"
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class CreateTemplateRequest(CamelModel):
    template_key: str
    name: str
    category: str
    description: str = ""
    variables: list[TemplateVariable] = []
    body: Optional[Any] = None
    status: str = "draft"


class NewTemplateVersionRequest(CamelModel):
    """Crea una nueva versión (v+1) a partir de un template_key existente."""
    name: Optional[str] = None
    description: Optional[str] = None
    variables: Optional[list[TemplateVariable]] = None
    body: Optional[Any] = None


class UpdateTemplateRequest(CamelModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None


# --- Relationships ---------------------------------------------------------- #
class RelationshipInput(CamelModel):
    entity_type: str               # property | person | opportunity | task
    entity_id: str
    role: Optional[str] = None     # comprador | vendedor | escribania | testigo | ...


class DocumentRelationship(RelationshipInput):
    id: str
    document_id: str
    created_at: Optional[str] = None


# --- Signatures ------------------------------------------------------------- #
class SignatureInput(CamelModel):
    signer_person_id: str
    signer_role: Optional[str] = None
    sign_order: Optional[int] = None


class DocumentSignature(CamelModel):
    id: str
    document_id: str
    signer_person_id: Optional[str] = None
    signer_role: Optional[str] = None
    status: str = "pending"
    sign_order: Optional[int] = None
    shared_at: Optional[str] = None
    signed_at: Optional[str] = None
    rejected_at: Optional[str] = None
    expires_at: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class UpdateSignatureRequest(CamelModel):
    status: str


# --- Documents -------------------------------------------------------------- #
class DocumentModel(CamelModel):
    id: str
    number: Optional[int] = None
    template_id: str
    template_key: str
    template_version: int
    template_snapshot: Optional[dict] = None
    category: str
    title: str = ""
    status: str = "draft"
    pdf_status: str = "none"
    origin: str = "manual"
    resolved_variables: Optional[dict] = None
    generated_pdf: Optional[dict] = None
    document_hash: Optional[str] = None
    locked_at: Optional[str] = None
    locked_by: Optional[str] = None
    created_by: Optional[str] = None
    last_modified_by: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    relationships: list[DocumentRelationship] = []
    signatures: list[DocumentSignature] = []


class PersonLink(CamelModel):
    person_id: str
    role: str


class CreateDocumentRequest(CamelModel):
    template_id: str
    title: str = ""
    origin: str = "manual"          # manual | automation | api | migration
    created_by: Optional[str] = None
    property_id: Optional[str] = None
    persons: list[PersonLink] = []  # personas relacionadas con su rol
    inputs: dict = {}               # valores para variables source=input
    # Compat: relaciones explícitas (además de property/persons del wizard).
    relationships: list[RelationshipInput] = []
    signatures: list[SignatureInput] = []


class ResolveRequest(CamelModel):
    template_id: str
    property_id: Optional[str] = None
    persons: list[PersonLink] = []
    inputs: dict = {}


class UpdateDocumentRequest(CamelModel):
    title: Optional[str] = None
    last_modified_by: Optional[str] = None


class TransitionRequest(CamelModel):
    """Transición del ciclo de vida único (draft→generated→shared→signed→archived)."""
    status: str
    actor: Optional[str] = None


# --- Serialización a camelCase (contrato de VERA en el borde de la API) ----- #
def to_api_template(row: dict) -> dict:
    return DocumentTemplate(**row).model_dump(by_alias=True)


def to_api_document(row: dict) -> dict:
    return DocumentModel(**row).model_dump(by_alias=True)


def to_api_relationship(row: dict) -> dict:
    return DocumentRelationship(**row).model_dump(by_alias=True)


def to_api_signature(row: dict) -> dict:
    return DocumentSignature(**row).model_dump(by_alias=True)
