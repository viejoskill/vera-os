"""PropertyProvider — el CONTRATO de la cartera inmobiliaria.

VERA razona sobre la cartera SÓLO a través de esta interfaz. NUNCA conoce Supabase ni un
CRM concreto. Cambiar de fuente = implementar la interfaz y cambiar
`active_property_provider` (1 línea). VERA Brain no se toca.

Implementaciones futuras posibles: TokkoPropertyProvider, EasyBrokerPropertyProvider, etc.
Hoy: `SupabasePropertyProvider` (sobre el repositorio existente).
"""
from __future__ import annotations

from abc import ABC, abstractmethod

import config
from property_repository import property_repository

from .types import Property


def _int(v) -> int | None:
    try:
        return int(v) if v not in (None, "") else None
    except (ValueError, TypeError):
        return None


def _float(v) -> float | None:
    try:
        return float(v) if v not in (None, "") else None
    except (ValueError, TypeError):
        return None


def _amenities(v) -> list[str]:
    if isinstance(v, list):
        return [str(x) for x in v if x]
    if isinstance(v, dict):
        return [str(k) for k, val in v.items() if val]
    return []


class PropertyProvider(ABC):
    id: str
    label: str

    @abstractmethod
    async def list_properties(self) -> list[Property]:
        """Cartera completa (no archivada), traducida al dominio."""

    @abstractmethod
    async def get_property(self, property_id: str) -> Property | None:
        """Una propiedad por id, o None."""


class SupabasePropertyProvider(PropertyProvider):
    id = "supabase"
    label = "Cartera de propiedades (Supabase)"

    async def list_properties(self) -> list[Property]:
        if not config.supabase_configured():
            return []
        try:
            rows = await property_repository.list_properties(status="all")
        except Exception:  # noqa: BLE001
            return []
        return [self._to_domain(r) for r in rows]

    async def get_property(self, property_id: str) -> Property | None:
        if not config.supabase_configured():
            return None
        row = await property_repository.get(property_id)
        return self._to_domain(row) if row else None

    @staticmethod
    def _to_domain(r: dict) -> Property:
        return Property(
            id=str(r.get("id", "")),
            title=r.get("title") or "",
            type=r.get("type") or "",
            operation=r.get("operation") or "",
            price=_float(r.get("price")),
            currency=r.get("currency") or "USD",
            city=r.get("city") or "",
            neighborhood=r.get("neighborhood") or "",
            address=r.get("address") or "",
            province=r.get("province") or "",
            bedrooms=_int(r.get("bedrooms")),
            bathrooms=_int(r.get("bathrooms")),
            rooms=_int(r.get("rooms")),
            area_m2=_float(r.get("area_m2")),
            lot_area_m2=_float(r.get("lot_area_m2")),
            parking=(_int(r.get("parking_covered")) or 0) + (_int(r.get("parking_uncovered")) or 0),
            amenities=_amenities(r.get("amenities")),
            condition=r.get("condition") or "",
            year_built=str(r.get("year_built") or ""),
            description=r.get("description") or "",
            status=r.get("status") or "active",
            archived=bool(r.get("archived")),
            owner_id=str(r.get("owner_id") or ""),
            owner_observations=r.get("owner_observations") or "",
            images_count=len(r.get("property_images") or []),
            publications_count=len(r.get("publications") or []),
            has_video=bool(r.get("video_url")),
            created_at=r.get("created_at") or "",
            updated_at=r.get("updated_at") or "",
        )


# Punto ÚNICO de acoplamiento del proveedor de cartera.
active_property_provider: PropertyProvider = SupabasePropertyProvider()
