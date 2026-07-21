"""Proyecciones — VERA Core consume los eventos y actualiza el estado derivado.
Punto de extensión para la lógica de negocio (que vive SIEMPRE en VERA, nunca en
Arturito). Hoy los read-models (timeline, contadores, último contacto) se calculan
por consulta sobre el event store; acá quedan registrados los handlers write-time
para cuando se agreguen oportunidades/tareas automáticas."""
from __future__ import annotations

import logging
from typing import Awaitable, Callable

logger = logging.getLogger("vera")

Handler = Callable[[dict], Awaitable[None]]
_handlers: list[Handler] = []


def register(handler: Handler) -> None:
    _handlers.append(handler)


async def apply(event: dict) -> None:
    """Ejecuta las proyecciones para un evento recién persistido (best-effort)."""
    for handler in _handlers:
        try:
            await handler(event)
        except Exception:  # noqa: BLE001 — una proyección no debe romper la ingesta
            logger.warning("Proyección falló para evento %s", event.get("type"))


async def _log_projection(event: dict) -> None:
    logger.info(
        "Evento %s v%s (%s) persona=%s propiedad=%s",
        event.get("type"), event.get("event_version"), event.get("source"),
        event.get("person_id"), (event.get("subject") or {}).get("property_id"),
    )


register(_log_projection)
