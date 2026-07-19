"""Memory — conocimiento PROPIO de VERA construido en el tiempo.

No todo viene de las integraciones: VERA acumula preferencias, decisiones,
patrones de trabajo y contexto histórico. MVP: almacenamiento simple en archivo
(persistente). Escalará a Supabase cuando haga falta, sin cambiar la interfaz.
"""
import json
import threading
from datetime import datetime, timezone
from pathlib import Path

MEM_FILE = Path(__file__).resolve().parent.parent / "vera_memory.json"
_lock = threading.Lock()


class Memory:
    def _load(self) -> list[dict]:
        if MEM_FILE.exists():
            try:
                return json.loads(MEM_FILE.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                return []
        return []

    def remember(self, note: str, kind: str = "note") -> None:
        note = (note or "").strip()
        if not note:
            return
        with _lock:
            items = self._load()
            items.append(
                {"kind": kind, "note": note, "at": datetime.now(timezone.utc).isoformat()}
            )
            MEM_FILE.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")

    def recall(self, limit: int = 60) -> list[dict]:
        return self._load()[-limit:]

    def as_context(self) -> str:
        items = self.recall()
        if not items:
            return "(VERA todavía no registró memoria propia — se irá construyendo con el uso.)"
        return "\n".join(f"- [{i['kind']}] {i['note']}" for i in items)


memory = Memory()
