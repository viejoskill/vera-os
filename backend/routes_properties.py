"""Property CRUD endpoints. All persistence goes through SupabasePropertyRepository."""
import asyncio
import logging
import random
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response, HTMLResponse

import config
import web_publisher
from property_repository import property_repository
from schemas import (
    PropertyCreate,
    PropertyDetailResponse,
    PropertyResponse,
    PropertyUpdate,
    PublicationAction,
    VisitCreate,
    VisitResponse,
)
from serializers import property_to_detail, property_to_response, visit_to_response
from storage_service import get_storage

router = APIRouter(prefix="/properties", tags=["properties"])

logger = logging.getLogger("vera")


def _ensure() -> None:
    if not config.supabase_configured():
        raise HTTPException(503, "Supabase is not configured.")


async def _gen_ventas_code() -> str:
    """Código aleatorio y único para Ventas: V100–V1000 (letra V + número, sin guion)."""
    rows = await property_repository.list_properties(status="all")
    used: set[int] = set()
    for p in rows:
        c = str(p.get("codigo") or "")
        if c.startswith("V") and c[1:].isdigit():
            used.add(int(c[1:]))
    pool = [n for n in range(100, 1001) if n not in used]
    if not pool:  # sin números libres en el rango → seguimos por encima de 1000
        return f"V{1001 + len(used)}"
    return f"V{random.choice(pool)}"



@router.get("", response_model=list[PropertyResponse])
async def list_properties(status: Optional[str] = None, query: Optional[str] = None):
    _ensure()
    rows = await property_repository.list_properties(status=status, query=query)
    # Firmamos las portadas en paralelo (evita el N+1 secuencial ~10s → <1s).
    return list(await asyncio.gather(*(property_to_response(r) for r in rows)))


@router.post("", response_model=PropertyDetailResponse, status_code=201)
async def create_property(payload: PropertyCreate):
    _ensure()
    data = payload.model_dump()
    data["codigo"] = await _gen_ventas_code()
    # El número de llave se guarda dentro del JSON `publications` (sin columna nueva).
    key_number = data.pop("key_number", None)
    if key_number is not None:
        data["publications"] = {**(data.get("publications") or {}), "keyNumber": int(key_number)}
    prop = await property_repository.create(data, workspace_id=config.DEFAULT_WORKSPACE_ID)
    if prop is None:
        raise HTTPException(500, "Could not create property")
    return await property_to_detail(prop)


@router.get("/{property_id}", response_model=PropertyDetailResponse)
async def get_property(property_id: str):
    _ensure()
    prop = await property_repository.get(property_id)
    if prop is None:
        raise HTTPException(404, "Property not found")
    return await property_to_detail(prop)


@router.patch("/{property_id}/auto-stamp")
async def set_auto_stamp(property_id: str, body: dict):
    """Activa/desactiva el sello automático RESERVADA/VENDIDA quemado en la portada
    (ML/OG). Se usa cuando el usuario ya trae el sello dentro de la imagen (ej. Studio)
    y no quiere que se pise. Se guarda en publications.autoStamp."""
    _ensure()
    prop = await property_repository.get(property_id)
    if prop is None:
        raise HTTPException(404, "Property not found")
    enabled = bool(body.get("enabled", True))
    pubs = prop.get("publications") or {}
    pubs["autoStamp"] = enabled
    await property_repository.update(property_id, {"publications": pubs})
    return {"autoStamp": enabled}


@router.get("/{property_id}/stamped-cover")
async def stamped_cover(property_id: str, status: Optional[str] = None):
    """Portada con el sello VENDIDA/RESERVADA + logo Varela quemado (JPEG), para
    descargar/compartir. Si no se pasa `status`, usa el estado actual de la propiedad."""
    _ensure()
    from property_stamp import get_stamped_cover_bytes
    prop = await property_repository.get(property_id)
    if prop is None:
        raise HTTPException(404, "Property not found")
    st = status or prop.get("status") or "sold"
    data = await get_stamped_cover_bytes(prop, st)
    if not data:
        raise HTTPException(404, "La propiedad no tiene una foto de portada.")
    return Response(
        content=data,
        media_type="image/jpeg",
        headers={"Content-Disposition": f'attachment; filename="portada-{st}.jpg"'},
    )


@router.get("/{property_id}/story")
async def story_cover(property_id: str, status: Optional[str] = None):
    """Placa en formato HISTORIA (9:16) con la foto sellada + datos, para redes."""
    _ensure()
    from property_stamp import get_story_bytes
    prop = await property_repository.get(property_id)
    if prop is None:
        raise HTTPException(404, "Property not found")
    st = status or prop.get("status") or "sold"
    data = await get_story_bytes(prop, st)
    if not data:
        raise HTTPException(404, "La propiedad no tiene una foto de portada.")
    return Response(
        content=data,
        media_type="image/jpeg",
        headers={"Content-Disposition": f'attachment; filename="historia-{st}.jpg"'},
    )


@router.get("/{property_id}/share", response_class=HTMLResponse)
async def share_page(property_id: str, request: Request):
    """Página de compartir con OG tags por propiedad (foto + título reales) que
    redirige a la ficha pública propia `/web/{id}`. Así WhatsApp/redes muestran la
    miniatura correcta y el link abre la propiedad (no la home del sitio externo)."""
    import html as _html
    _ensure()
    try:
        prop = await property_repository.get(property_id)
    except Exception:  # noqa: BLE001 — id malformado u otro error de lookup
        prop = None
    if prop is None:
        raise HTTPException(404, "Property not found")
    detail = await property_to_detail(prop)

    cover = ""
    imgs = detail.images or []
    if imgs:
        cover = next((i.url for i in imgs if getattr(i, "isCover", False)), imgs[0].url)
    status = prop.get("status")
    if status in ("reserved", "sold") and (prop.get("publications") or {}).get("autoStamp", True):
        from property_stamp import stamped_cover_url
        stamped = await stamped_cover_url(prop, status)
        if stamped:
            cover = stamped

    price = prop.get("price")
    try:
        price_str = f"{int(float(price)):,}".replace(",", ".") if price else ""
    except (ValueError, TypeError):
        price_str = ""
    moneda = prop.get("currency") or "USD"
    desc_parts = [f"{moneda} {price_str}".strip(), prop.get("address"), prop.get("city")]
    desc = " · ".join([p for p in desc_parts if p])

    host = request.headers.get("x-forwarded-host") or request.headers.get("host") or ""
    scheme = request.headers.get("x-forwarded-proto", "https")
    site = f"{scheme}://{host}"
    target = f"{site}/web/{property_id}"

    title = _html.escape(prop.get("title") or "Propiedad — Varela")
    desc_e = _html.escape(desc)
    cover_e = _html.escape(cover)
    target_e = _html.escape(target)
    page = f"""<!doctype html><html lang="es"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>{title}</title>
<meta property="og:type" content="website"/>
<meta property="og:title" content="{title}"/>
<meta property="og:description" content="{desc_e}"/>
<meta property="og:image" content="{cover_e}"/>
<meta property="og:url" content="{target_e}"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="{title}"/>
<meta name="twitter:description" content="{desc_e}"/>
<meta name="twitter:image" content="{cover_e}"/>
<meta http-equiv="refresh" content="0; url={target_e}"/>
</head><body style="font-family:sans-serif;background:#14140f;color:#fff;text-align:center;padding:48px">
<p>Abriendo la propiedad… <a style="color:#e3ff33" href="{target_e}">Ver ahora</a></p>
<script>window.location.replace("{target_e}");</script>
</body></html>"""
    return HTMLResponse(content=page)



@router.patch("/{property_id}", response_model=PropertyDetailResponse)
async def update_property(property_id: str, payload: PropertyUpdate):
    _ensure()
    patch = payload.model_dump(exclude_none=True)
    patch.pop("key_number", None)
    # Número de llave → dentro de `publications` (solo si el cliente lo envió; null = limpiar).
    if "key_number" in payload.model_fields_set:
        existing = await property_repository.get(property_id)
        if existing is None:
            raise HTTPException(404, "Property not found")
        pubs = dict(existing.get("publications") or {})
        if payload.key_number is None:
            pubs.pop("keyNumber", None)
        else:
            pubs["keyNumber"] = int(payload.key_number)
        patch["publications"] = pubs
    prop = await property_repository.update(property_id, patch)
    if prop is None:
        raise HTTPException(404, "Property not found")
    # Auto-sync al Guardar: reflejar los cambios en Web Varela y Mercado Libre en
    # PARALELO (si ya están publicadas), con un único write de `publications`.
    from routes_ml import ml_resync_patch
    web_patch, ml_patch = await asyncio.gather(
        _web_resync_patch(property_id, prop),
        ml_resync_patch(prop),
    )
    if web_patch or ml_patch:
        merged = {**(prop.get("publications") or {}), **web_patch, **ml_patch}
        prop = await property_repository.update(property_id, {"publications": merged}) or prop
    return await property_to_detail(prop)


async def _web_resync_patch(property_id: str, prop: dict) -> dict:
    """Re-empuja la propiedad a la web (si está publicada) y devuelve el patch de
    `publications['web-varela']` (sin escribir en DB). Best-effort."""
    web = (prop.get("publications") or {}).get("web-varela") or {}
    if web.get("status") not in ("published", "inconsistent"):
        return {}
    try:
        url_value = await web_publisher.publish(prop)  # valida persistencia en la web
        return {"web-varela": {
            "status": "published",
            "lastSync": datetime.now(timezone.utc).isoformat(),
            "url": url_value,
        }}
    except Exception as e:  # noqa: BLE001 — best-effort, no romper el guardado
        logger.error("Re-sync web INCONSISTENTE para %s: %s", property_id, e)
        return {"web-varela": {**web, "status": "inconsistent", "url": ""}}


@router.patch("/{property_id}/archive", response_model=PropertyDetailResponse)
async def archive_property(property_id: str):
    _ensure()
    prop = await property_repository.set_archived(property_id, True)
    if prop is None:
        raise HTTPException(404, "Property not found")
    return await property_to_detail(prop)


@router.patch("/{property_id}/restore", response_model=PropertyDetailResponse)
async def restore_property(property_id: str):
    _ensure()
    prop = await property_repository.set_archived(property_id, False)
    if prop is None:
        raise HTTPException(404, "Property not found")
    return await property_to_detail(prop)


@router.get("/{property_id}/visits", response_model=list[VisitResponse])
async def list_visits(property_id: str):
    _ensure()
    rows = await property_repository.list_visits(property_id)
    return [visit_to_response(r) for r in rows]


@router.post("/{property_id}/visits", response_model=VisitResponse, status_code=201)
async def create_visit(property_id: str, payload: VisitCreate):
    _ensure()
    data = {**payload.model_dump(), "property_id": property_id}
    row = await property_repository.add_visit(data)
    if row is None:
        raise HTTPException(500, "Could not register visit")
    await property_repository.touch(property_id)
    return visit_to_response(row)


@router.post("/{property_id}/publications/{channel}", response_model=PropertyDetailResponse)
async def set_publication(property_id: str, channel: str, payload: PublicationAction):
    """Manual publication status board (no live portal API yet). VERA never publishes
    automatically — the agent operates the state; VERA only records and shows it."""
    _ensure()
    if channel not in config.ENABLED_PUBLICATION_CHANNELS:
        raise HTTPException(422, f"Canal no disponible: {channel}")
    if payload.action not in ("publish", "update", "unpublish"):
        raise HTTPException(422, f"Acción no válida: {payload.action}")

    prop = await property_repository.get(property_id)
    if prop is None:
        raise HTTPException(404, "Property not found")

    publications = dict(prop.get("publications") or {})
    existing = publications.get(channel) or {}
    if payload.action == "unpublish":
        if channel == "web-varela":
            try:
                await web_publisher.unpublish(prop)
            except Exception as e:  # noqa: BLE001
                raise HTTPException(502, f"No se pudo despublicar de la web: {e}")
        publications[channel] = {"status": "none", "lastSync": None, "url": ""}
    else:  # publish | update
        url_value = existing.get("url", "")
        if channel == "web-varela":
            try:
                url_value = await web_publisher.publish(prop)  # valida persistencia
            except Exception as e:  # noqa: BLE001
                logger.error("Publicación web INCONSISTENTE para %s: %s", property_id, e)
                publications[channel] = {
                    "status": "inconsistent",
                    "lastSync": datetime.now(timezone.utc).isoformat(),
                    "url": "",
                }
                await property_repository.update(property_id, {"publications": publications})
                raise HTTPException(502, f"No se pudo publicar en la web: {e}")
        elif payload.url is not None:
            url_value = payload.url
        publications[channel] = {
            "status": "published",
            "lastSync": datetime.now(timezone.utc).isoformat(),
            "url": url_value,
        }

    updated = await property_repository.update(property_id, {"publications": publications})
    if updated is None:
        raise HTTPException(500, "Could not update publications")
    return await property_to_detail(updated)


@router.post("/{property_id}/duplicate", response_model=PropertyDetailResponse)
async def duplicate_property(property_id: str):
    """Clone a full property card to load similar listings fast. Copies all data
    fields (no photos/documents — those are property-specific), resets status and
    publications, and marks the title as a copy."""
    _ensure()
    prop = await property_repository.get(property_id)
    if prop is None:
        raise HTTPException(404, "Property not found")

    exclude = {
        "id", "created_at", "updated_at", "workspace_id", "code",
        "property_images", "property_documents",
    }
    data = {k: v for k, v in prop.items() if k not in exclude}
    data["title"] = f"{prop.get('title', 'Propiedad')} (copia)"
    data["status"] = "active"
    data["archived"] = False
    data["publications"] = {}
    data["radar"] = False

    workspace_id = prop.get("workspace_id") or config.DEFAULT_WORKSPACE_ID
    created = await property_repository.create(data, workspace_id)
    if created is None:
        raise HTTPException(500, "Could not duplicate property")
    return await property_to_detail(created)


@router.delete("/{property_id}", status_code=204)
async def delete_property(property_id: str):
    _ensure()
    prop = await property_repository.get(property_id)
    if prop is None:
        raise HTTPException(404, "Property not found")
    # Remove storage objects first so private buckets don't accumulate orphans.
    for asset in (prop.get("property_images") or []) + (prop.get("property_documents") or []):
        try:
            await get_storage().delete(asset["bucket"], asset["object_path"])
        except Exception:
            pass
    await property_repository.delete(property_id)
