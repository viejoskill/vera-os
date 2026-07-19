"""Memory — lo que VERA APRENDIÓ trabajando con este usuario.

Distinto de Knowledge (lo que VERA SABE del negocio). Memory es conocimiento
propio, ESTRUCTURADO y TIPADO, que se construye con el uso y que INFLUYE en cómo
VERA razona y propone.

Regla permanente: Memory NUNCA guarda conversaciones completas (eso pertenece al
ConversationProvider). Memory sólo guarda lo que merece recordarse por su valor
futuro: decisiones, preferencias, relaciones, contexto y patrones aprendidos.

MVP: almacenamiento simple en archivo (persistente). Escalará a Supabase (por
usuario / por Persona) sin cambiar la interfaz.
"""
import json
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path

from pydantic import BaseModel, Field

MEM_FILE = Path(__file__).resolve().parent.parent / "vera_memory.json"
_lock = threading.Lock()

# Categorías de memoria. Crecer = sumar un tipo, sin cambiar la arquitectura.
MEMORY_TYPES = ("decision", "preference", "relationship", "context", "learned_pattern")

_TYPE_LABELS = {
    "decision": "Decisiones tomadas",
    "preference": "Preferencias del usuario",
    "relationship": "Relaciones y personas",
    "context": "Contexto de trabajo",
    "learned_pattern": "Patrones aprendidos",
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class MemoryEntry(BaseModel):
    """Unidad de memoria estructurada. `subject` habilita la consulta por Persona."""

    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    type: str = "context"          # decision | preference | relationship | context | learned_pattern
    subject: str = ""              # a quién/qué refiere (Persona, tema, propiedad)
    action: str = ""               # follow_up_sent | prefers_formal_tone | pushing_property…
    detail: str = ""               # texto legible (UI + contexto del Brain)
    confidence: float = 1.0
    at: str = Field(default_factory=_now)
    meta: dict = Field(default_factory=dict)


class Memory:
    def _load(self) -> list[dict]:
        if MEM_FILE.exists():
            try:
                return json.loads(MEM_FILE.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                return []
        return []

    def _save(self, items: list[dict]) -> None:
        MEM_FILE.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")

    @staticmethod
    def _coerce(raw: dict) -> MemoryEntry:
        """Tolera registros viejos ({kind, note, at}) y normaliza al modelo actual."""
        if "detail" not in raw and "note" in raw:
            raw = {**raw, "type": raw.get("kind", "context"), "detail": raw.get("note", "")}
        allowed = {k: v for k, v in raw.items() if k in MemoryEntry.model_fields}
        return MemoryEntry(**allowed)

    def remember(self, entry: MemoryEntry) -> MemoryEntry:
        if not (entry.detail or entry.action or entry.subject):
            return entry
        if entry.type not in MEMORY_TYPES:
            entry.type = "context"
        with _lock:
            items = self._load()
            items.append(entry.model_dump())
            self._save(items)
        return entry

    def recall(
        self,
        *,
        types: list[str] | None = None,
        subject: str | None = None,
        limit: int = 60,
    ) -> list[MemoryEntry]:
        out: list[MemoryEntry] = []
        for raw in self._load():
            e = self._coerce(raw)
            if types and e.type not in types:
                continue
            if subject and subject.lower() not in e.subject.lower():
                continue
            out.append(e)
        return out[-limit:]

    def for_subject(self, subject: str, limit: int = 40) -> list[MemoryEntry]:
        """Toda la memoria asociada a un sujeto. Punto de integración para Personas."""
        return self.recall(subject=subject, limit=limit)

    def as_context(self) -> str:
        items = self.recall(limit=80)
        if not items:
            return "(VERA todavía no aprendió nada de este usuario — la memoria se construye con el uso.)"
        by_type: dict[str, list[MemoryEntry]] = {}
        for e in items:
            by_type.setdefault(e.type, []).append(e)
        blocks: list[str] = []
        for t in MEMORY_TYPES:
            if t in by_type:
                lines = "\n".join(f"- {e.detail or f'{e.action} · {e.subject}'}" for e in by_type[t])
                blocks.append(f"{_TYPE_LABELS[t]}:\n{lines}")
        return "\n\n".join(blocks)


memory = Memory()
