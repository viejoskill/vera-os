"""Reglas del Insights Engine. Detectan HECHOS de forma transparente (sin IA).
Cada regla produce Insight[]. Sumar capacidades = agregar reglas."""
from abc import ABC, abstractmethod
from datetime import datetime, timezone

import config
from property_repository import property_repository

from conversations.provider import ConversationProvider
from .types import Insight

# --- Configuración de INTERÉS (transparente y editable) --------------------- #
INTEREST_SIGNALS: dict[str, dict] = {
    "pidio_visita": {"label": "Pidió visitar", "weight": 3,
                     "keywords": ["visita", "visitar", "conocer", "ver la propiedad", "coordinar", "agendar"]},
    "pregunto_precio": {"label": "Preguntó precio", "weight": 2,
                        "keywords": ["precio", "cuánto", "cuanto sale", "valor", "vale", "cotiza"]},
    "pregunto_ubicacion": {"label": "Preguntó ubicación", "weight": 1,
                           "keywords": ["ubicación", "ubicacion", "dónde", "donde queda", "dirección", "zona", "barrio"]},
    "pregunto_financiacion": {"label": "Preguntó financiación", "weight": 2,
                              "keywords": ["financ", "crédito", "credito", "cuotas", "hipotec", "anticipo"]},
    "compartio_nombre": {"label": "Compartió su nombre", "weight": 1,
                         "keywords": ["me llamo", "mi nombre", "soy "]},
    "compartio_telefono": {"label": "Compartió teléfono", "weight": 1,
                           "keywords": ["teléfono", "telefono", "celular", "mi número", "mi numero", "whatsapp"]},
    "envio_documentacion": {"label": "Envió documentación", "weight": 2,
                            "keywords": ["adjunto", "documentación", "documentacion", "recibo", "dni", "comprobante"]},
}
INTEREST_THRESHOLD = 2
FOLLOW_UP_HOURS = 48


def _detect_signals(text: str) -> list[str]:
    t = text.lower()
    return [k for k, c in INTEREST_SIGNALS.items() if any(kw in t for kw in c["keywords"])]


def _score(signals: list[str]) -> int:
    return sum(INTEREST_SIGNALS[s]["weight"] for s in signals if s in INTEREST_SIGNALS)


class InsightRule(ABC):
    @abstractmethod
    async def detect(self) -> list[Insight]:
        ...


class FollowUpRule(InsightRule):
    """Opportunity · follow-up: interés real + ~48h de silencio → sugerir seguimiento.
    VERA propone un mensaje; NUNCA lo envía. Consume el contrato ConversationProvider
    (nunca un proveedor concreto)."""

    def __init__(self, provider: ConversationProvider):
        self.provider = provider

    async def detect(self) -> list[Insight]:
        out: list[Insight] = []
        for conv in await self.provider.list_conversations():
            if conv.status != "open":
                continue
            signals = _detect_signals(conv.client_text)
            if _score(signals) < INTEREST_THRESHOLD:
                continue
            last_at = conv.last_at
            if not last_at:
                continue
            hours = int((datetime.now(timezone.utc) - datetime.fromisoformat(last_at)).total_seconds() // 3600)
            if hours < FOLLOW_UP_HOURS:
                continue

            top = max(signals, key=lambda s: INTEREST_SIGNALS[s]["weight"])
            days = hours // 24
            when = f"hace {days} días" if days >= 1 else f"hace {hours} horas"
            priority = "high" if ("pidio_visita" in signals or _score(signals) >= 5) else "medium"
            first = (conv.contact.name or "").split(" ")[0] or "hola"
            prop = conv.property_label or "la propiedad que estuvimos viendo"

            out.append(Insight(
                id=f"followup-{conv.id}",
                type="opportunity",
                category="follow_up",
                priority=priority,
                title=conv.contact.name,
                reason=f"{INTEREST_SIGNALS[top]['label']} {when} y no respondió.",
                suggested_action=(
                    f"Hola {first} 😊\nQuería saber si seguís interesado/a en {prop}. "
                    "Si todavía estás buscando algo parecido, con gusto puedo ayudarte."
                ),
                action_label="Copiar mensaje sugerido",
                link_route="/vera-bot",
                link_label="Ver conversación",
                signals=[INTEREST_SIGNALS[s]["label"] for s in signals],
                meta={"contact_id": conv.contact.id, "conversation_id": conv.id,
                      "contact_phone": conv.contact.phone, "hours_since_last": hours},
            ))
        return out


class PropertyHealthRule(InsightRule):
    """Recommendation/Priority sobre datos REALES de la cartera: propiedades activas
    sin fotos o sin publicar. Detecta hechos; el usuario decide."""

    async def detect(self) -> list[Insight]:
        if not config.supabase_configured():
            return []
        try:
            rows = await property_repository.list_properties()
        except Exception:  # noqa: BLE001
            return []

        out: list[Insight] = []
        for r in rows:
            if r.get("archived") or r.get("status") != "active":
                continue
            pid = r.get("id", "")
            title = r.get("title") or "Propiedad sin título"
            if not (r.get("property_images") or []):
                out.append(Insight(
                    id=f"prop-photos-{pid}", type="recommendation", category="property_health",
                    priority="medium", title=title, reason="Propiedad activa sin fotos cargadas.",
                    suggested_action="Sumá al menos una foto de portada para fortalecer la publicación.",
                    link_route="/propiedades", link_label="Abrir propiedad",
                    signals=["Sin fotos"], meta={"property_id": pid},
                ))
            if not (r.get("publications") or []):
                out.append(Insight(
                    id=f"prop-pub-{pid}", type="priority", category="property_health",
                    priority="high", title=title, reason="Propiedad activa sin publicar en portales.",
                    suggested_action="Publicá esta propiedad en Mercado Libre / Zonaprop para captar consultas.",
                    link_route="/propiedades", link_label="Abrir propiedad",
                    signals=["Sin publicaciones"], meta={"property_id": pid},
                ))
        return out
