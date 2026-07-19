"""Modelos del Opportunity Engine."""
from pydantic import BaseModel


class Opportunity(BaseModel):
    type: str                 # p.ej. "follow_up"
    priority: str             # "high" | "medium" | "low"
    reason: str               # explicación transparente para el humano
    suggested_message: str    # propuesta de mensaje — NUNCA se envía sola
    contact_id: str
    contact_name: str
    conversation_id: str
    hours_since_last: int     # horas de inactividad
    signals: list[str]        # señales de interés detectadas (transparencia)
