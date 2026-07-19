"""Knowledge Sources + Knowledge Hub.

Las fuentes aportan CONOCIMIENTO del negocio (no solo contexto). Todas alimentan
un único repositorio — el Knowledge Hub — y VERA Brain consulta el Hub, nunca
las integraciones directamente. Sumar una fuente (Gmail, Meta, Arturito…) =
implementar KnowledgeSource y registrarla en el Hub. VERA Brain no cambia.
"""
from abc import ABC, abstractmethod
from pathlib import Path


class KnowledgeSource(ABC):
    id: str
    label: str

    @abstractmethod
    def fetch(self) -> str:
        """Devuelve un bloque de conocimiento (texto) para el Hub."""


class VeraKnowledgeSource(KnowledgeSource):
    """Conocimiento profundo de VERA: filosofía, visión, arquitectura, roadmap,
    principios y decisiones de producto. Es la PRIMera fuente del MVP: VERA debe
    entenderse a sí misma antes de conectar fuentes externas."""

    id = "vera"
    label = "Conocimiento de VERA (filosofía, arquitectura, roadmap)"

    DOCS = Path("/app/docs")
    PRD = Path("/app/memory/PRD.md")
    DOC_ORDER = ["VISION.md", "FOUNDATION.md", "WORKSPACE.md", "ROADMAP.md", "PILOT.md"]

    def fetch(self) -> str:
        parts: list[str] = []
        for name in self.DOC_ORDER:
            p = self.DOCS / name
            if p.exists():
                parts.append(f"## {name}\n{p.read_text(encoding='utf-8')}")
        if self.PRD.exists():
            prd = self.PRD.read_text(encoding="utf-8")
            # El PRD es largo: tomamos el arranque (identidad + design system + arquitectura)
            # y el final (changelog reciente de decisiones de producto).
            head = prd[:9000]
            tail = prd[-6000:] if len(prd) > 15000 else ""
            parts.append(f"## PRD — identidad y arquitectura\n{head}")
            if tail:
                parts.append(f"## PRD — decisiones y cambios recientes\n{tail}")
        return "\n\n".join(parts) if parts else "(Sin documentación de VERA disponible.)"


class KnowledgeHub:
    """Repositorio ÚNICO de conocimiento. Las fuentes lo alimentan; VERA Brain lo
    consulta. Desacopla al cerebro de las integraciones concretas."""

    def __init__(self) -> None:
        self._sources: list[KnowledgeSource] = []

    def register(self, source: KnowledgeSource) -> None:
        self._sources.append(source)

    def sources(self) -> list[dict]:
        return [{"id": s.id, "label": s.label} for s in self._sources]

    def knowledge(self) -> str:
        return "\n\n".join(
            f"===== {s.label} =====\n{s.fetch()}" for s in self._sources
        )


# Hub del sistema. MVP: sólo VeraKnowledgeSource. Próximas fuentes se registran acá.
hub = KnowledgeHub()
hub.register(VeraKnowledgeSource())
