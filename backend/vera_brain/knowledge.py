"""Knowledge Sources + Knowledge Hub.

Las fuentes aportan CONOCIMIENTO del negocio. Todas alimentan un único repositorio
—el Knowledge Hub— y VERA Brain consulta el Hub, nunca las integraciones directamente.
Sumar una fuente (Arturito, Gmail, Meta…) = implementar KnowledgeSource y registrarla.
"""
from abc import ABC, abstractmethod
from pathlib import Path

import config


class KnowledgeSource(ABC):
    id: str
    label: str

    @abstractmethod
    async def fetch(self) -> str:
        """Devuelve un bloque de conocimiento (texto) para el Hub."""


class VeraKnowledgeSource(KnowledgeSource):
    """Conocimiento PERMANENTE de VERA: identidad, modelo cognitivo, arquitectura,
    marca/voz, workspace y roadmap. Se alimenta de docs CURADOS (`/app/docs`), no del
    PRD (que es un changelog interno de implementación, no conocimiento de identidad).
    Cachea el contenido e invalida por mtime, así refleja ediciones sin reiniciar."""

    id = "vera"
    label = "Conocimiento de VERA (identidad, modelo cognitivo, arquitectura, marca)"

    DOCS = Path("/app/docs")
    DOC_ORDER = [
        "VISION.md", "COGNITION.md", "FOUNDATION.md", "BRAND.md",
        "PROVIDERS.md", "WORKSPACE.md", "ROADMAP.md", "PILOT.md",
    ]

    _cache: str | None = None
    _sig: float = 0.0

    async def fetch(self) -> str:
        files = [self.DOCS / n for n in self.DOC_ORDER]
        sig = max((f.stat().st_mtime for f in files if f.exists()), default=0.0)
        if VeraKnowledgeSource._cache is not None and sig == VeraKnowledgeSource._sig:
            return VeraKnowledgeSource._cache
        parts = [
            f"## {f.name.replace('.md', '')}\n{f.read_text(encoding='utf-8').strip()}"
            for f in files
            if f.exists()
        ]
        result = "\n\n".join(parts) if parts else "(Sin documentación de VERA disponible.)"
        VeraKnowledgeSource._cache = result
        VeraKnowledgeSource._sig = sig
        return result


class PropertiesKnowledgeSource(KnowledgeSource):
    """Transforma la cartera real en CONOCIMIENTO CONSULTABLE (no un listado ni un
    buscador). Consume el contrato `PropertyProvider` (hoy Supabase, mañana otro CRM;
    VERA Brain nunca lo sabe). Entrega specs por propiedad + señales derivadas (info
    incompleta, antigüedad, actividad) para que VERA razone: matching con lo que busca
    un comprador, opciones por presupuesto, similares, qué impulsar y qué necesita atención."""

    id = "properties"
    label = "Cartera de propiedades (conocimiento consultable del negocio)"

    _OP = {"venta": "venta", "alquiler": "alquiler", "alquiler_temporario": "alquiler temporario"}

    def _price(self, p) -> str:
        return f"{p.currency} {int(p.price):,}".replace(",", ".") if p.price else "sin precio"

    def _describe(self, p) -> str:
        specs = []
        if p.bedrooms is not None:
            specs.append(f"{p.bedrooms} dorm")
        if p.bathrooms is not None:
            specs.append(f"{p.bathrooms} baños")
        if p.area_m2:
            specs.append(f"{int(p.area_m2)} m² cub")
        if p.lot_area_m2:
            specs.append(f"lote {int(p.lot_area_m2)} m²")
        if p.parking:
            specs.append(f"{p.parking} cocheras")
        specs_txt = " · ".join(specs) if specs else "sin specs cargadas"
        loc = ", ".join(x for x in [p.neighborhood, p.city, p.province] if x) or "ubicación sin datos"
        amen = f" · amenities: {', '.join(p.amenities)}" if p.amenities else ""
        desc = " ".join((p.description or "").split())
        if len(desc) > 220:
            desc = desc[:217] + "…"
        flags = f" · INCOMPLETA: {', '.join(p.missing)}" if p.missing else ""
        op = self._OP.get(p.operation, p.operation)
        head = (
            f"- [{p.id[:8]}] {p.title} · {p.type or 's/tipo'} · {op} · {self._price(p)} · {loc} · "
            f"{specs_txt} · {p.images_count} fotos · {p.publications_count} publicaciones"
            f" · {p.days_published if p.days_published is not None else '?'} días publicada{amen}{flags}"
        )
        return head + (f"\n  Descripción: {desc}" if desc else "")

    async def fetch(self) -> str:
        # Import diferido: el Hub no se acopla al proveedor en import time.
        from collections import Counter

        from properties.provider import active_property_provider

        if not config.supabase_configured():
            return "(Cartera no disponible: almacenamiento no configurado.)"
        try:
            props = await active_property_provider.list_properties()
        except Exception:  # noqa: BLE001
            return "(No se pudo leer la cartera en este momento.)"
        if not props:
            return "El profesional todavía no cargó propiedades."

        active = [p for p in props if p.status == "active" and not p.archived]
        by_op = Counter(self._OP.get(p.operation, p.operation) for p in props)
        op_txt = ", ".join(f"{v} en {k}" for k, v in by_op.items()) or "sin datos"

        out: list[str] = [
            f"Cartera: {len(props)} propiedades (activas: {len(active)}). Operaciones: {op_txt}.",
            "",
            "Detalle de cada propiedad (usalo para razonar: matching con lo que busca un "
            "comprador, opciones por presupuesto, similares, qué impulsar, qué necesita atención):",
        ]
        out.extend(self._describe(p) for p in props[:50])

        incompletas = [p for p in active if p.missing]
        if incompletas:
            out.append("")
            out.append("Propiedades con información incompleta (conviene completar antes de impulsar):")
            out.extend(f"- {p.title}: {', '.join(p.missing)}." for p in incompletas[:20])

        published = sorted(
            (p for p in active if p.days_published is not None),
            key=lambda x: x.days_published or 0,
            reverse=True,
        )
        if published:
            out.append("")
            out.append("Antigüedad de publicación (más tiempo primero — candidatas a impulsar o revisar precio):")
            out.extend(
                f"- {p.title}: {p.days_published} días publicada, "
                f"{p.days_inactive if p.days_inactive is not None else '?'} días sin actividad."
                for p in published[:10]
            )

        out.append("")
        out.append(
            "Nota de honestidad: todavía NO se registran métricas de consultas por mes ni la fecha "
            "del último contacto con cada propietario. Si te preguntan por eso, aclaralo y ofrecé "
            "lo que sí podés razonar (antigüedad, actividad reciente, completitud, matching)."
        )
        return "\n".join(out)


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
