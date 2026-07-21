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
        "PROVIDERS.md", "CONVERSATION_ADAPTER.md", "RELATIONSHIPS.md",
        "WORKSPACE.md", "ROADMAP.md", "PILOT.md",
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


class RelationshipKnowledgeSource(KnowledgeSource):
    """Relaciones activas con personas — el primer componente de la Relationship
    Foundation. No almacena conversaciones: ENRIQUECE la relación de cada Persona con el
    negocio, cruzando qué pidió, qué propiedad real de la cartera le encaja, qué se
    aprendió (memoria) y qué insight hay. Permite a VERA actuar como ASESOR: responder
    "¿qué debería hacer con María?" combinando conversación + cartera + memoria + insight
    + objetivo. Consume RelationshipService (que a su vez usa contratos, nunca Arturito)."""

    id = "relationships"
    label = "Relaciones con personas (conversación + cartera + memoria + insights)"

    def _price(self, p) -> str:
        return f"{p.currency} {int(p.price):,}".replace(",", ".") if p.price else "sin precio"

    async def fetch(self) -> str:
        from relationships.service import relationship_service

        snaps = await relationship_service.all_snapshots()
        if not snaps:
            return "Sin relaciones activas por ahora."

        parts: list[str] = [
            f"Relaciones activas con personas: {len(snaps)}. "
            "Usá esto para asesorar (qué debería hacer con cada persona), no sólo informar:"
        ]
        for s in snaps:
            p = s.person
            head = f"### {p.name or 'Contacto sin nombre'}"
            meta = " · ".join(x for x in [", ".join(p.channels), f"lead: {p.lead_status}" if p.lead_status else ""] if x)
            parts.append(f"{head}{f' ({meta})' if meta else ''}")

            asked = s.client_text
            if len(asked) > 220:
                asked = asked[:217] + "…"
            parts.append(f'- Qué pidió: "{asked}"')

            if s.interested_properties:
                props_txt = "; ".join(
                    f"[{pr.id[:8]}] {pr.title} · {self._price(pr)} · {pr.city}" for pr in s.interested_properties
                )
                parts.append(f"- Propiedad(es) de tu cartera que encajan: {props_txt}")
            else:
                parts.append("- Propiedad de cartera que encaje claramente: ninguna por ahora (evaluá similares o captar).")

            if s.insights:
                parts.append("- Estado de la relación: " + "; ".join(i.get("reason", "") for i in s.insights))
            if s.memory:
                parts.append("- Ya hiciste: " + "; ".join(m.detail for m in s.memory if m.detail))
            else:
                parts.append("- Ya hiciste: sin acciones registradas todavía.")
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


# Hub del sistema. Orden = permanencia: VERA (identidad) → cartera real → relaciones.
hub = KnowledgeHub()
hub.register(VeraKnowledgeSource())
hub.register(PropertiesKnowledgeSource())
hub.register(RelationshipKnowledgeSource())
