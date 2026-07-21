"""Modelo de las entidades de negocio de VERA Core (proyecciones del Event Pipeline).

Estas entidades son DERIVADAS: se reconstruyen a partir del stream inmutable de
eventos. Cambiar las reglas = rehacer las proyecciones (endpoint rebuild), sin
migrar datos. Todas referencian a la persona por `person_id` (regla de arquitectura).
"""
from __future__ import annotations

# --- Lead: la persona dentro del embudo comercial --------------------------- #
LEAD_NUEVO = "nuevo"
LEAD_CONTACTADO = "contactado"
LEAD_CALIFICADO = "calificado"
LEAD_CONVERTIDO = "convertido"
LEAD_PERDIDO = "perdido"
LEAD_STATUSES = {LEAD_NUEVO, LEAD_CONTACTADO, LEAD_CALIFICADO, LEAD_CONVERTIDO, LEAD_PERDIDO}
_LEAD_RANK = {LEAD_NUEVO: 0, LEAD_CONTACTADO: 1, LEAD_CALIFICADO: 2, LEAD_CONVERTIDO: 3}


def lead_can_advance(current: str, target: str) -> bool:
    """El lead sólo progresa hacia adelante (no vuelve a un estado anterior).
    `perdido` es terminal y sólo lo setea una acción explícita."""
    if current in (LEAD_CONVERTIDO, LEAD_PERDIDO):
        return False
    return _LEAD_RANK.get(target, -1) > _LEAD_RANK.get(current, -1)


# --- Opportunity: una posibilidad concreta de negocio (persona + propiedad) -- #
OPP_INTERES = "interes"
OPP_VISITA_AGENDADA = "visita_agendada"
OPP_VISITADA = "visitada"
OPP_OFERTA = "oferta"
OPP_RESERVA = "reserva"
OPP_GANADA = "ganada"
OPP_PERDIDA = "perdida"
OPP_STAGES = {
    OPP_INTERES, OPP_VISITA_AGENDADA, OPP_VISITADA, OPP_OFERTA,
    OPP_RESERVA, OPP_GANADA, OPP_PERDIDA,
}
_OPP_RANK = {
    OPP_INTERES: 1, OPP_VISITA_AGENDADA: 2, OPP_VISITADA: 3,
    OPP_OFERTA: 4, OPP_RESERVA: 5, OPP_GANADA: 6,
}
_OPP_TERMINAL = {OPP_GANADA, OPP_PERDIDA}


def opp_can_advance(current: str, target: str) -> bool:
    """La oportunidad sólo avanza de etapa (nunca retrocede). `ganada`/`perdida`
    son terminales."""
    if current in _OPP_TERMINAL:
        return False
    return _OPP_RANK.get(target, 0) > _OPP_RANK.get(current, 0)


# --- Task: la próxima acción sugerida (VERA propone, el humano decide) ------- #
TASK_RESPONDER = "responder"
TASK_CONTACTAR = "contactar"
TASK_CONFIRMAR_VISITA = "confirmar_visita"
TASK_SEGUIMIENTO = "seguimiento"
TASK_SEGUIR_OFERTA = "seguir_oferta"
TASK_TYPES = {
    TASK_RESPONDER, TASK_CONTACTAR, TASK_CONFIRMAR_VISITA,
    TASK_SEGUIMIENTO, TASK_SEGUIR_OFERTA,
}

TASK_PENDIENTE = "pendiente"
TASK_HECHA = "hecha"
TASK_DESCARTADA = "descartada"
TASK_STATUSES = {TASK_PENDIENTE, TASK_HECHA, TASK_DESCARTADA}
