"""Driver de publicación web (canal 'web-varela').

Hoy la web pública de Varela (www.varelapropiedadescde.com.ar) es una página estática
que lee EN VIVO la tabla `propiedades` del CRM (Supabase) y muestra toda propiedad cuyo
`estado` ∈ {Disponible, Reservada, Vendida}. Para que "Publicar en Web" aparezca en la
web ACTUAL, VERA escribe/actualiza esa fila.

Contrato desacoplable: el día que reemplacemos el sitio, se cambia este driver
(publish/unpublish) y el botón de la UI sigue igual.
"""
from __future__ import annotations

import logging

import httpx

import config
from storage_service import get_storage

logger = logging.getLogger("vera")

# URL de detalle de la web actual (para "Ver en la web").
WEB_SITE_URL = "https://www.varelapropiedadescde.com.ar"
# La web necesita URLs de fotos que NO caduquen → firmamos con TTL largo (~10 años).
_PHOTO_TTL = 10 * 365 * 24 * 3600
_MAX_PHOTOS = 20
# Estado que la web NO muestra (para ocultar sin borrar la fila).
_HIDDEN_ESTADO = "Pausada"

_TYPE_TO_CRM = {
    "casa": "Casa", "ph": "PH", "departamento": "Departamento", "duplex": "Duplex",
    "terreno": "Terreno / Lote", "local": "Local comercial", "oficina": "Oficina", "cochera": "Cochera",
}
_OPERATION_TO_CRM = {"venta": "Venta", "alquiler": "Alquiler", "alquiler_temporario": "Alquiler temporario"}
_STATUS_TO_CRM = {"active": "Disponible", "reserved": "Reservada", "sold": "Vendida"}


def _legacy_id(prop: dict) -> str:
    """Id de la fila en la web: reutiliza el del CRM si la propiedad se importó,
    o uno determinístico `vera-<id>` para propiedades nacidas en VERA (idempotente)."""
    return (prop.get("legacy_id") or "").strip() or f"vera-{prop['id']}"


def web_url(prop: dict) -> str:
    return f"{WEB_SITE_URL}/?propiedad={_legacy_id(prop)}"


def _headers() -> dict:
    return {
        "apikey": config.CRM_SUPABASE_WRITE_KEY,
        "Authorization": f"Bearer {config.CRM_SUPABASE_WRITE_KEY}",
        "Content-Type": "application/json",
    }


def _to_int(v) -> int:
    try:
        return int(float(v))
    except (ValueError, TypeError):
        return 0


async def _photo_urls(prop: dict) -> list[str]:
    images = list(prop.get("property_images") or [])
    images.sort(key=lambda i: i.get("position", 0))
    images.sort(key=lambda i: not i.get("is_cover", False))  # portada primero
    urls: list[str] = []
    for img in images[:_MAX_PHOTOS]:
        try:
            u = await get_storage().signed_url(img["bucket"], img["object_path"], _PHOTO_TTL)
            if u:
                urls.append(u)
        except Exception:  # noqa: BLE001
            continue
    return urls


async def _row(prop: dict) -> dict:
    return {
        "id": _legacy_id(prop),
        "titulo": prop.get("title", "") or "",
        "descripcion": prop.get("description", "") or "",
        "tipo": _TYPE_TO_CRM.get(prop.get("type", ""), "Casa"),
        "operacion": _OPERATION_TO_CRM.get(prop.get("operation", ""), "Venta"),
        "estado": _STATUS_TO_CRM.get(prop.get("status", ""), "Disponible"),
        "precio": _to_int(prop.get("price")),
        "direccion": prop.get("address", "") or "",
        "zona": prop.get("neighborhood", "") or "",
        "ciudad": prop.get("city", "") or "",
        "provincia": prop.get("province", "") or "",
        "ambientes": _to_int(prop.get("rooms")),
        "dormitorios": _to_int(prop.get("bedrooms")),
        "banios": _to_int(prop.get("bathrooms")),
        "mts": _to_int(prop.get("lot_area_m2")),
        "mts_cubiertos": _to_int(prop.get("area_m2")),
        "mts_semicubiertos": _to_int(prop.get("semi_covered_area_m2")),
        "amenities": prop.get("amenities") or [],
        "fotos": await _photo_urls(prop),
        "codigo": (prop.get("codigo") or "").strip(),
        "publicado_web": True,
    }


async def publish(prop: dict) -> str:
    """Upsert de la propiedad en la web actual (tabla `propiedades`). Devuelve el id usado."""
    if not config.crm_configured():
        raise RuntimeError("La web (CRM) no está configurada (CRM_SUPABASE_URL / CRM_SUPABASE_KEY).")
    row = await _row(prop)
    url = f"{config.CRM_SUPABASE_URL}/rest/v1/propiedades?on_conflict=id"
    headers = {**_headers(), "Prefer": "resolution=merge-duplicates,return=minimal"}
    async with httpx.AsyncClient(timeout=60, follow_redirects=True) as c:
        r = await c.post(url, headers=headers, json=row)
        if r.status_code >= 400:
            raise RuntimeError(f"Web publish {r.status_code}: {r.text[:300]}")
    return row["id"]


async def unpublish(prop: dict) -> None:
    """Oculta la propiedad de la web (estado que la web no muestra). La fila se conserva."""
    if not config.crm_configured():
        return
    lid = _legacy_id(prop)
    url = f"{config.CRM_SUPABASE_URL}/rest/v1/propiedades?id=eq.{lid}"
    headers = {**_headers(), "Prefer": "return=minimal"}
    async with httpx.AsyncClient(timeout=60, follow_redirects=True) as c:
        r = await c.patch(url, headers=headers, json={"estado": _HIDDEN_ESTADO, "publicado_web": False})
        if r.status_code >= 400:
            raise RuntimeError(f"Web unpublish {r.status_code}: {r.text[:300]}")
