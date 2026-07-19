"""Modelo de Insight — unidad de inteligencia de VERA."""
from pydantic import BaseModel, Field


class Insight(BaseModel):
    id: str
    type: str                      # opportunity | risk | recommendation | priority | reminder | task
    category: str                  # subtipo: follow_up | property_health | ...
    priority: str                  # high | medium | low
    title: str                     # encabezado (contacto, propiedad, asunto)
    reason: str                    # explicación transparente para el humano
    suggested_action: str = ""     # propuesta (mensaje/acción) — NUNCA se ejecuta sola
    action_label: str = ""         # etiqueta para copiar la acción (si aplica)
    link_route: str = ""           # ruta interna para "ver / abrir" (si aplica)
    link_label: str = ""
    signals: list[str] = Field(default_factory=list)
    meta: dict = Field(default_factory=dict)  # contact_id, conversation_id, property_id, hours...
