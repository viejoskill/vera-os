"""Contrato de eventos — la interfaz definitiva entre CUALQUIER capa conversacional
y VERA Core (el "Conversation Adapter Contract").

VERA Core NO conoce a ningún proveedor concreto. Cualquier motor conversacional
(Arturito, WhatsApp Cloud, Kommo, un bot propio, la web…) es sólo un *adapter*:
transforma sus conversaciones en estos eventos tipados y los envía a
`POST /api/events`. Arturito es simplemente el PRIMER adapter; conectar otro motor
no requiere cambios en VERA Core. Toda la lógica de negocio vive en VERA (proyecciones).

Principios:
- Eventos INMUTABLES: nunca se actualizan ni eliminan. Un cambio de estado = evento nuevo.
- Contrato VERSIONADO (`event_version`) desde el inicio para compatibilidad futura.
- AGNÓSTICO del proveedor: el mismo envelope sirve para todos los adapters.
"""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

# Versión del contrato de eventos. Incrementar ante cambios incompatibles.
EVENT_VERSION = 1

# Tipos canónicos de evento (la UI y las proyecciones se basan en esto).
EVENT_TYPES = {
    "PersonCreated",
    "ConversationStarted",
    "MessageReceived",
    "PropertyInquiry",
    "VisitScheduled",
    "PropertyVisited",
    "OpportunityCreated",
    "OfferSent",
    "PropertyReserved",
    "PropertySold",
}

# Orígenes (adapters) válidos. Cada motor conversacional se identifica con su propio
# `source`; agregar un adapter nuevo = sumar su id acá (aditivo, retrocompatible).
EVENT_SOURCES = {
    "arturito", "website", "crm", "app", "system",
    "conversation", "whatsapp", "kommo", "instagram", "facebook",
}


class _CamelBase(BaseModel):
    """Contrato en camelCase (occurredAt, idempotencyKey, propertyId...),
    aceptando también snake_case por compatibilidad."""
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class EventContact(_CamelBase):
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    email: Optional[str] = None
    document: Optional[str] = None
    crm_id: Optional[str] = None
    name: Optional[str] = None


class EventSubject(_CamelBase):
    property_id: Optional[str] = None
    property_code: Optional[str] = None


class EventEnvelope(_CamelBase):
    """Payload de ingesta. Lo que Arturito/web/CRM envían a VERA."""
    type: str
    source: str = "arturito"
    occurred_at: Optional[str] = None
    idempotency_key: Optional[str] = None
    contact: EventContact = Field(default_factory=EventContact)
    subject: EventSubject = Field(default_factory=EventSubject)
    payload: dict = Field(default_factory=dict)


def validate_envelope(env: EventEnvelope) -> None:
    if env.type not in EVENT_TYPES:
        raise ValueError(f"Tipo de evento inválido: {env.type}. Válidos: {sorted(EVENT_TYPES)}")
    if env.source not in EVENT_SOURCES:
        raise ValueError(f"Origen inválido: {env.source}. Válidos: {sorted(EVENT_SOURCES)}")
