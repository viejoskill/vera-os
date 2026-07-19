"""Goals — lo que VERA INTENTA LOGRAR.

Tercer pilar del modelo cognitivo de VERA (Knowledge = lo que sabe; Memory = lo que
aprendió; Goals = lo que intenta lograr). El razonamiento del Brain SIEMPRE se hace en
función del objetivo actual del usuario: qué priorizar, qué proponer, qué ignorar.

Ejemplos: vender una propiedad específica, captar propietarios, priorizar alquileres,
aumentar tasaciones. MVP file-based; escalará a Supabase por-usuario sin cambiar la
interfaz.
"""
from __future__ import annotations

import json
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path

from pydantic import BaseModel, Field

GOALS_FILE = Path(__file__).resolve().parent.parent / "vera_goals.json"
_lock = threading.Lock()

# Tipos de objetivo. Crecer = sumar un tipo, sin cambiar la arquitectura.
GOAL_TYPES = ("sell_property", "capture_owners", "prioritize_rentals", "increase_appraisals", "custom")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class Goal(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    type: str = "custom"            # sell_property | capture_owners | prioritize_rentals | increase_appraisals | custom
    title: str = ""                # legible: "Vender la casa de Costa del Este"
    subject: str = ""              # opcional: property_id / zona / segmento
    status: str = "active"         # active | done | archived
    priority: str = "primary"      # primary | secondary
    # Alcance del objetivo (diseñado desde el inicio; hoy se usa 'global'):
    #   global   → objetivo general del profesional
    #   workspace→ objetivo de un espacio de trabajo
    #   entity   → objetivo atado a una entidad (persona, propiedad, oportunidad…)
    scope: str = "global"          # global | workspace | entity
    scope_type: str = ""           # persona | propiedad | oportunidad | workspace (si scope=entity/workspace)
    scope_id: str = ""             # id de la entidad/workspace al que aplica
    at: str = Field(default_factory=_now)
    meta: dict = Field(default_factory=dict)


class Goals:
    def _load(self) -> list[dict]:
        if GOALS_FILE.exists():
            try:
                return json.loads(GOALS_FILE.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                return []
        return []

    def _save(self, items: list[dict]) -> None:
        GOALS_FILE.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")

    def set_goal(self, goal: Goal) -> Goal:
        if not goal.title.strip():
            return goal
        if goal.type not in GOAL_TYPES:
            goal.type = "custom"
        with _lock:
            items = self._load()
            items.append(goal.model_dump())
            self._save(items)
        return goal

    def set_status(self, goal_id: str, status: str) -> Goal | None:
        with _lock:
            items = self._load()
            updated: Goal | None = None
            for raw in items:
                if raw.get("id") == goal_id:
                    raw["status"] = status
                    updated = Goal(**{k: raw.get(k) for k in Goal.model_fields if raw.get(k) is not None})
            if updated:
                self._save(items)
            return updated

    def list(self, limit: int = 40) -> list[Goal]:
        return [Goal(**{k: r.get(k) for k in Goal.model_fields if r.get(k) is not None}) for r in self._load()[-limit:]]

    def active(self) -> list[Goal]:
        return [g for g in self.list() if g.status == "active"]

    def as_context(self) -> str:
        active = self.active()
        if not active:
            return "(El usuario todavía no definió un objetivo. Si es oportuno, sugerí definir uno para poder priorizar.)"
        lines = [f"- {g.title}" + ("" if g.priority == "primary" else " (secundario)") for g in active]
        return (
            "Objetivo(s) actual(es) del usuario:\n"
            + "\n".join(lines)
            + "\nRazoná y priorizá SIEMPRE en función de esto: qué acerca al objetivo va primero."
        )


goals = Goals()
