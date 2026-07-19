"""Knowledge Sources + Knowledge Hub.

Las fuentes aportan CONOCIMIENTO del negocio. Todas alimentan un único repositorio
—el Knowledge Hub— y VERA Brain consulta el Hub, nunca las integraciones directamente.
Sumar una fuente (Arturito, Gmail, Meta…) = implementar KnowledgeSource y registrarla.
"""
from abc import ABC, abstractmethod
from pathlib import Path

import config
from property_repository import property_repository


class KnowledgeSource(ABC):
    id: str
    label: str

    @abstractmethod
    async def fetch(self) -> str:
        """Devuelve un bloque de conocimiento (texto) para el Hub."""


class VeraKnowledgeSource(KnowledgeSource):
    """Conocimiento profundo de VERA: filosofía, visión, arquitectura, roadmap y
    decisiones de producto. Primera fuente PERMANENTE del sistema."""

    id = "vera"
    label = "Conocimiento de VERA (filosofía, arquitectura, roadmap)"

    DOCS = Path("/app/docs")
    PRD = Path("/app/memory/PRD.md")
    DOC_ORDER = ["VISION.md", "FOUNDATION.md", "PROVIDERS.md", "WORKSPACE.md", "ROADMAP.md", "PILOT.md"]

    async def fetch(self) -> str:
        parts: list[str] = []
        for name in self.DOC_ORDER:
            p = self.DOCS / name
            if p.exists():
                parts.append(f"## {name}\n{p.read_text(encoding='utf-8')}")
        if self.PRD.exists():
            prd = self.PRD.read_text(encoding="utf-8")
            parts.append(f"## PRD — identidad y arquitectura\n{prd[:9000]}")
            if len(prd) > 15000:
                parts.append(f"## PRD — decisiones y cambios recientes\n{prd[-6000:]}")
        return "\n\n".join(parts) if parts else "(Sin documentación de VERA disponible.)"


class PropertiesKnowledgeSource(KnowledgeSource):
    """Cartera real de propiedades del negocio (Supabase). Es conocimiento propio
    del profesional; permite a VERA razonar sobre el inventario real."""

    id = "properties"
    label = "Cartera de propiedades (datos reales del negocio)"

    _OP = {"venta": "Venta", "alquiler": "Alquiler", "alquiler_temporario": "Alquiler temporario"}

    async def fetch(self) -> str:
        if not config.supabase_configured():
            return "(Cartera no disponible: almacenamiento no configurado.)"
        try:
            rows = await property_repository.list_properties()
        except Exception:  # noqa: BLE001
            return "(No se pudo leer la cartera en este momento.)"
        if not rows:
            return "El profesional todavía no cargó propiedades."

        active = [r for r in rows if r.get("status") == "active" and not r.get("archived")]
        lines = [f"Total de propiedades: {len(rows)} (activas: {len(active)})."]
        for r in rows[:40]:
            op = self._OP.get(r.get("operation", ""), r.get("operation", ""))
            price = r.get("price")
            price_txt = f"{r.get('currency', 'USD')} {int(price):,}".replace(",", ".") if price else "sin precio"
            imgs = len(r.get("property_images") or [])
            pubs = len(r.get("publications") or [])
            lines.append(
                f"- {r.get('title', 'Sin título')} · {r.get('type', '')} · {op} · {price_txt} · "
                f"{r.get('city', '')} · estado: {r.get('status', '')} · {imgs} fotos · {pubs} publicaciones"
            )
        return "\n".join(lines)


class ConversationKnowledgeSource(KnowledgeSource):
    """Conversaciones activas + oportunidades del día. Consume el CONTRATO
    `ConversationProvider` — nunca a Arturito ni a un proveedor concreto. Cierra el
    círculo AI-First: VERA sabe QUIÉN es cada contacto, QUÉ preguntó y POR QUÉ es una
    oportunidad. Al conectar un provider real, esta fuente no cambia."""

    id = "conversations"
    label = "Conversaciones activas y oportunidades (vía ConversationProvider)"

    async def fetch(self) -> str:
        # Import diferido: el Hub no se acopla al proveedor ni al motor en import time.
        from conversations.provider import active_conversation_provider
        from insights_engine.engine import engine

        parts: list[str] = []

        convs = [c for c in await active_conversation_provider.list_conversations() if c.status == "open"]
        if convs:
            parts.append(f"Conversaciones activas: {len(convs)}.")
            for c in convs:
                name = c.contact.name or "Contacto sin nombre"
                prop = c.property_label or "una propiedad"
                asked = c.client_text.strip()
                if len(asked) > 260:
                    asked = asked[:257] + "…"
                phone_txt = f" · tel: {c.contact.phone}" if c.contact.phone else ""
                parts.append(f'- {name} — consulta por {prop} (canal: {c.channel}){phone_txt}. Dijo: "{asked}"')

        try:
            insights = await engine.detect()
        except Exception:  # noqa: BLE001
            insights = []
        if insights:
            parts.append("")
            parts.append("Oportunidades e insights detectados hoy (VERA propone, el usuario decide):")
            for i in insights:
                who = i.title or i.category
                sig = f" Señales: {', '.join(i.signals)}." if i.signals else ""
                parts.append(f"- [{i.type}/{i.priority}] {who}: {i.reason}{sig}")

        if not parts:
            return "Sin conversaciones activas ni oportunidades detectadas por ahora."
        return "\n".join(parts)


class KnowledgeHub:
    """Repositorio ÚNICO de conocimiento. Las fuentes lo alimentan; VERA Brain lo
    consulta. Desacopla al cerebro de las integraciones concretas."""

    def __init__(self) -> None:
        self._sources: list[KnowledgeSource] = []

    def register(self, source: KnowledgeSource) -> None:
        self._sources.append(source)

    def sources(self) -> list[dict]:
        return [{"id": s.id, "label": s.label} for s in self._sources]

    async def knowledge(self) -> str:
        blocks = []
        for s in self._sources:
            blocks.append(f"===== {s.label} =====\n{await s.fetch()}")
        return "\n\n".join(blocks)


# Hub del sistema. Orden = permanencia: VERA (identidad) → cartera real → conversaciones.
hub = KnowledgeHub()
hub.register(VeraKnowledgeSource())
hub.register(PropertiesKnowledgeSource())
hub.register(ConversationKnowledgeSource())
