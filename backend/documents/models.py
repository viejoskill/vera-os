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

# --- Motor de firmas (transversal a TODOS los documentos) ------------------- #
# Métodos declarables por el template y elegibles por el documento.
SIGNATURE_METHODS = ["presencial", "digital"]
# Sub-modo con el que se capturó una firma presencial (se decide al firmar).
PRESENCIAL_MODES = ["paper", "drawn", "scanned"]

# Estado de CADA participante (independiente del estado del documento).
PARTICIPANT_STATUSES = ["pending", "sent", "viewed", "signed", "rejected", "expired"]
# Transiciones válidas del ciclo de firma de un participante.
PARTICIPANT_TRANSITIONS = {
    "pending": {"sent", "signed", "expired"},   # 'signed' directo = firma presencial en papel
    "sent": {"viewed", "signed", "rejected", "expired"},
    "viewed": {"signed", "rejected", "expired"},
    "signed": set(),
    "rejected": {"sent"},                        # se puede reenviar tras un rechazo
    "expired": {"sent"},                         # se puede reenviar tras vencer
}
# Estado AGREGADO de firma del documento (derivado de los participantes).
SIGNATURE_STATES = ["none", "pending", "in_progress", "signed", "rejected"]
# Canales por los que se distribuye el enlace de firma (todos usan el mismo token).
SIGNATURE_CHANNELS = ["whatsapp", "email", "link"]


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
    signature_methods: list[str] = []   # métodos de firma permitidos (presencial|digital)
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
    signature_methods: list[str] = []
    body: Optional[Any] = None
    status: str = "draft"


class NewTemplateVersionRequest(CamelModel):
    """Crea una nueva versión (v+1) a partir de un template_key existente."""
    name: Optional[str] = None
    description: Optional[str] = None
    variables: Optional[list[TemplateVariable]] = None
    signature_methods: Optional[list[str]] = None
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


# --- Participants (motor de firmas) ----------------------------------------- #
# Un DocumentParticipant lleva la información ESPECÍFICA de la firma de una
# persona en un documento (rol, si debe firmar, estado, orden, método, timestamps
# y token de firma). Permite N firmantes (varios propietarios/garantes), firma
# secuencial (order) o paralela, sin tocar la arquitectura.
class ParticipantInput(CamelModel):
    person_id: str
    role: Optional[str] = None
    signature_required: bool = True
    signature_method: Optional[str] = None   # hereda el método del documento si no se indica
    order: Optional[int] = None


class DocumentParticipant(CamelModel):
    id: str
    document_id: str
    person_id: Optional[str] = None
    person_name: Optional[str] = None        # hidratado desde people (no persistido)
    role: Optional[str] = None
    signature_required: bool = True
    signature_status: str = "pending"        # pending|sent|viewed|signed|rejected|expired
    signature_method: Optional[str] = None
    presencial_mode: Optional[str] = None     # paper|drawn|scanned (al firmar presencial)
    order: Optional[int] = None
    sent_at: Optional[str] = None
    viewed_at: Optional[str] = None
    signed_at: Optional[str] = None
    rejected_at: Optional[str] = None
    expires_at: Optional[str] = None
    signature_data: Optional[dict] = None     # firma dibujada/escaneada o certificación digital
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class SetSignatureMethodRequest(CamelModel):
    signature_method: str                     # presencial | digital


class SendSignatureRequest(CamelModel):
    """Distribuye el enlace de firma de un participante por un canal."""
    channel: str = "link"                     # whatsapp | email | link
    base_url: str = ""                        # origen del frontend para armar /firma/{token}


class SignSubmitRequest(CamelModel):
    """Envío del firmante desde el enlace público (VERA-nativo)."""
    action: str = "sign"                      # sign | reject
    typed_name: Optional[str] = None          # firma tipeada
    signature_image: Optional[str] = None     # data URL de firma dibujada/escaneada
    mode: Optional[str] = None                # paper | drawn | scanned (presencial)
    reason: Optional[str] = None              # motivo del rechazo


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
    signature_method: Optional[str] = None      # presencial | digital (método elegido)
    signature_state: str = "none"               # derivado de los participantes
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
    participants: list[DocumentParticipant] = []


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
    signature_method: Optional[str] = None   # presencial | digital (opcional)
    # Firmantes explícitos (paso "Firma" del wizard). Si vacío y hay método,
    # se derivan de `persons` (todos obligatorios, en orden de selección).
    signers: list[ParticipantInput] = []
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


def to_api_participant(row: dict) -> dict:
    return DocumentParticipant(**row).model_dump(by_alias=True)


def signature_state(participants: list[dict]) -> str:
    """Estado AGREGADO de firma del documento, derivado de los participantes.

    El documento puede estar "En proceso" aunque falte un solo firmante.
    """
    required = [p for p in participants if p.get("signature_required", True)]
    if not required:
        return "none"
    statuses = [p.get("signature_status", "pending") for p in required]
    if any(s == "rejected" for s in statuses):
        return "rejected"
    if all(s == "signed" for s in statuses):
        return "signed"
    if any(s in ("sent", "viewed", "signed") for s in statuses):
        return "in_progress"
    return "pending"
