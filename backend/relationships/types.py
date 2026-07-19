"""Modelo de dominio de la Relación: la Persona y su vista 360°.

`Person` es la identidad; `RelationshipSnapshot` es la foto completa de la relación,
ensamblada desde las distintas fuentes (conversaciones, cartera, memoria, objetivos,
insights). Visitas y tareas quedan como SLOTS de dirección (se completan en App Personas).
"""
from __future__ import annotations

from pydantic import BaseModel, Field

from conversations.types import Conversation
from properties.types import Property
from vera_brain.goals import Goal
from vera_brain.memory import MemoryEntry


class Person(BaseModel):
    id: str = ""
    name: str = ""
    phone: str = ""
    email: str = ""
    channels: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    lead_status: str = ""


class RelationshipSnapshot(BaseModel):
    """Vista 360° de una Persona. Combina todo lo que VERA sabe de la relación."""

    person: Person
    conversations: list[Conversation] = Field(default_factory=list)
    interested_properties: list[Property] = Field(default_factory=list)
    memory: list[MemoryEntry] = Field(default_factory=list)
    goals: list[Goal] = Field(default_factory=list)
    insights: list[dict] = Field(default_factory=list)
    # Slots de dirección (App Personas los completará):
    visits: list[dict] = Field(default_factory=list)
    tasks: list[dict] = Field(default_factory=list)

    @property
    def client_text(self) -> str:
        return " ".join(c.client_text for c in self.conversations).strip()
