"""Reglas de oportunidad. Versión inicial: BASADA EN REGLAS (sin IA), totalmente
transparente y fácilmente configurable. La clasificación de interés se hace por
señales con pesos — editable en un solo lugar."""
from abc import ABC, abstractmethod
from datetime import datetime, timezone

from .types import Opportunity

# --- Configuración de INTERÉS (transparente y editable) --------------------- #
# Cada señal detectada en los mensajes del cliente suma peso al "interés".
INTEREST_SIGNALS: dict[str, dict] = {
    "pidio_visita": {
        "label": "Pidió visitar",
        "weight": 3,
        "keywords": ["visita", "visitar", "conocer", "ver la propiedad", "coordinar", "agendar"],
    },
    "pregunto_precio": {
        "label": "Preguntó precio",
        "weight": 2,
        "keywords": ["precio", "cuánto", "cuanto sale", "valor", "vale", "cotiza"],
    },
    "pregunto_ubicacion": {
        "label": "Preguntó ubicación",
        "weight": 1,
        "keywords": ["ubicación", "ubicacion", "dónde", "donde queda", "dirección", "zona", "barrio"],
    },
    "pregunto_financiacion": {
        "label": "Preguntó financiación",
        "weight": 2,
        "keywords": ["financ", "crédito", "credito", "cuotas", "hipotec", "anticipo"],
    },
    "compartio_nombre": {
        "label": "Compartió su nombre",
        "weight": 1,
        "keywords": ["me llamo", "mi nombre", "soy "],
    },
    "compartio_telefono": {
        "label": "Compartió teléfono",
        "weight": 1,
        "keywords": ["teléfono", "telefono", "celular", "mi número", "mi numero", "whatsapp"],
    },
    "envio_documentacion": {
        "label": "Envió documentación",
        "weight": 2,
        "keywords": ["adjunto", "documentación", "documentacion", "recibo", "dni", "comprobante"],
    },
}

INTEREST_THRESHOLD = 2   # interés mínimo para considerarlo "real"
FOLLOW_UP_HOURS = 48     # horas de silencio para sugerir seguimiento


def _detect_signals(client_text: str) -> list[str]:
    text = client_text.lower()
    found = []
    for key, cfg in INTEREST_SIGNALS.items():
        if any(k in text for k in cfg["keywords"]):
            found.append(key)
    return found


def _score(signals: list[str]) -> int:
    return sum(INTEREST_SIGNALS[s]["weight"] for s in signals if s in INTEREST_SIGNALS)


class OpportunityRule(ABC):
    type: str

    @abstractmethod
    def evaluate(self, conversation: dict) -> Opportunity | None:
        """Devuelve una Opportunity si la conversación cumple la regla, o None."""


class FollowUpRule(OpportunityRule):
    """Follow-up inteligente: si un cliente mostró interés real y dejó de responder
    ~48h, se marca FOLLOW_UP_SUGGESTED. VERA sólo sugiere; nunca envía."""

    type = "follow_up"

    def evaluate(self, conversation: dict) -> Opportunity | None:
        if (conversation.get("status") or "open") != "open":
            return None

        messages = conversation.get("messages", [])
        client_text = " ".join(m["text"] for m in messages if m.get("sender") == "client")
        signals = _detect_signals(client_text)
        score = _score(signals)
        if score < INTEREST_THRESHOLD:
            return None

        last_at = max((m["at"] for m in messages), default=None)
        if not last_at:
            return None
        last_dt = datetime.fromisoformat(last_at)
        hours = int((datetime.now(timezone.utc) - last_dt).total_seconds() // 3600)
        if hours < FOLLOW_UP_HOURS:
            return None

        top = max(signals, key=lambda s: INTEREST_SIGNALS[s]["weight"])
        top_label = INTEREST_SIGNALS[top]["label"]
        days = hours // 24
        when = f"hace {days} días" if days >= 1 else f"hace {hours} horas"
        reason = f"{top_label} {when} y no respondió."

        priority = "high" if ("pidio_visita" in signals or score >= 5) else "medium"

        first_name = (conversation.get("contact_name") or "").split(" ")[0] or "hola"
        prop = conversation.get("property_label") or "la propiedad que estuvimos viendo"
        suggested = (
            f"Hola {first_name} 😊\n"
            f"Quería saber si seguís interesado/a en {prop}. "
            "Si todavía estás buscando algo parecido, con gusto puedo ayudarte."
        )

        return Opportunity(
            type=self.type,
            priority=priority,
            reason=reason,
            suggested_message=suggested,
            contact_id=conversation.get("contact_id", ""),
            contact_name=conversation.get("contact_name", ""),
            conversation_id=conversation.get("id", ""),
            hours_since_last=hours,
            signals=[INTEREST_SIGNALS[s]["label"] for s in signals],
        )
