"""Modelo de dominio canónico de la cartera (vendor-agnóstico).

Cualquier `PropertyProvider` (Supabase, Tokko, EasyBroker…) traduce su formato a este
modelo. Incluye señales DERIVADAS (antigüedad, completitud) para que VERA pueda razonar
sobre la cartera, no sólo listarla.
"""
from __future__ import annotations

from datetime import datetime, timezone

from pydantic import BaseModel, Field


def _days_since(iso: str | None) -> int | None:
    if not iso:
        return None
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return max(0, (datetime.now(timezone.utc) - dt).days)


class Property(BaseModel):
    id: str
    title: str = ""
    type: str = ""                 # casa | departamento | ph | terreno | ...
    operation: str = ""            # venta | alquiler | alquiler_temporario
    price: float | None = None
    currency: str = "USD"
    city: str = ""
    neighborhood: str = ""
    address: str = ""
    province: str = ""
    bedrooms: int | None = None
    bathrooms: int | None = None
    rooms: int | None = None
    area_m2: float | None = None
    lot_area_m2: float | None = None
    parking: int = 0
    amenities: list[str] = Field(default_factory=list)
    condition: str = ""
    year_built: str = ""
    description: str = ""
    status: str = "active"
    archived: bool = False
    owner_id: str = ""
    owner_observations: str = ""
    images_count: int = 0
    publications_count: int = 0
    has_video: bool = False
    created_at: str = ""
    updated_at: str = ""

    @property
    def days_published(self) -> int | None:
        return _days_since(self.created_at)

    @property
    def days_inactive(self) -> int | None:
        return _days_since(self.updated_at)

    @property
    def missing(self) -> list[str]:
        """Qué le falta a la ficha (para que VERA sugiera completarla)."""
        out: list[str] = []
        if self.images_count == 0:
            out.append("sin fotos")
        elif self.images_count < 3:
            out.append("pocas fotos")
        if not self.price:
            out.append("sin precio")
        if len((self.description or "").strip()) < 120:
            out.append("descripción breve")
        if self.type != "terreno" and self.bedrooms is None:
            out.append("sin ambientes")
        if self.area_m2 is None:
            out.append("sin superficie")
        if self.publications_count == 0:
            out.append("sin publicaciones")
        return out
