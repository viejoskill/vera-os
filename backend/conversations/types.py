"""Modelo de dominio canónico de Conversaciones (vendor-agnóstico).

Cualquier `ConversationProvider` (Arturito, WhatsApp Cloud, Kommo, HubSpot, Tokko…)
DEBE traducir su formato propio a estos tipos. Así el resto de VERA nunca conoce el
formato de un proveedor concreto.
"""
from pydantic import BaseModel, Field


class ConversationMessage(BaseModel):
    sender: str          # 'client' | 'agent'
    text: str
    at: str              # ISO 8601 (UTC)


class Contact(BaseModel):
    id: str = ""
    name: str = ""
    phone: str = ""


class Conversation(BaseModel):
    id: str
    contact: Contact = Field(default_factory=Contact)
    channel: str = "whatsapp"          # whatsapp | instagram | facebook | web | email
    property_label: str = ""           # propiedad consultada (si el proveedor la expone)
    status: str = "open"               # open | pending | closed
    lead_status: str = ""              # nuevo | calificado | frío… (si el proveedor lo da)
    tags: list[str] = Field(default_factory=list)
    messages: list[ConversationMessage] = Field(default_factory=list)

    @property
    def client_text(self) -> str:
        """Texto concatenado de los mensajes del cliente (para análisis de interés)."""
        return " ".join(m.text for m in self.messages if m.sender == "client")

    @property
    def last_at(self) -> str | None:
        return max((m.at for m in self.messages), default=None)
