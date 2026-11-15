"""Bucket PÚBLICO (sin firmar, cacheable) con copias livianas WebP de fotos de
propiedades PUBLICADAS en la web. Nunca contiene el original en alta ni documentos
— eso sigue en el bucket privado de siempre (`config.BUCKET_IMAGES`, con signed URLs).

Se sincroniza:
- al publicar/despublicar el canal 'web-varela' (routes_properties.set_publication)
- al subir/borrar una foto en una propiedad YA publicada (routes_files)
- en el backfill (scripts/backfill_public_photo_variants.py), para fotos subidas antes
  de esta feature

El manifest.json por propiedad (en el mismo bucket público) es la única fuente de
verdad de "qué variantes existen"; evita tener que pegarle a Storage con un HEAD por
imagen en cada request pública. Se lee con un GET http simple (bucket público, sin
auth) y se cachea en memoria `_MANIFEST_CACHE_TTL` segundos.
"""
import asyncio
import json
import logging
import time
from pathlib import PurePosixPath

import httpx

import config
from image_variants import VARIANT_WIDTHS, generate_webp_variants
from storage_service import get_storage

logger = logging.getLogger("vera")


async def _with_retries(fn, *args, attempts: int = 5, **kwargs):
    """Supabase Storage corta la conexión ('Server disconnected') de vez en cuando
    bajo carga sostenida (backfill de muchas fotos); es transitorio, no un error de
    datos — reintentar 2 veces con backoff corto resuelve prácticamente todos los
    casos sin tener que bajar más la concurrencia."""
    last_exc: Exception | None = None
    for attempt in range(attempts):
        try:
            return await fn(*args, **kwargs)
        except Exception as e:  # noqa: BLE001
            last_exc = e
            if attempt < attempts - 1:
                await asyncio.sleep(0.5 * (attempt + 1))
    raise last_exc

_MANIFEST_CACHE_TTL = 60
_MANIFEST_CACHE: dict[str, tuple[dict, float]] = {}
_bucket_ready = False
# Limita cuántas descargas/subidas de Storage corren en paralelo. Sin esto, el
# backfill (varias fotos x 3 anchos x muchas propiedades, todo en simultáneo)
# satura el pool de conexiones y Supabase empieza a cortar con "Server disconnected".
_CONCURRENCY = asyncio.Semaphore(6)


def _variant_path(object_path: str, width: int) -> str:
    p = PurePosixPath(object_path)
    return str(p.with_suffix("")) + f"_w{width}.webp"


def _manifest_path(property_id: str) -> str:
    return f"manifests/{property_id}.json"


async def _ensure_bucket() -> None:
    global _bucket_ready
    if _bucket_ready:
        return
    await get_storage().create_bucket_if_missing(config.BUCKET_IMAGES_PUBLIC)
    _bucket_ready = True


def public_variant_urls(object_path: str) -> dict[str, str]:
    """URLs públicas DETERMINÍSTICAS (string building, sin red). No implican que el
    archivo exista — para eso está el manifest."""
    storage = get_storage()
    return {
        str(w): storage.get_public_url(config.BUCKET_IMAGES_PUBLIC, _variant_path(object_path, w))
        for w in VARIANT_WIDTHS
    }


async def generate_and_store(object_path: str, content: bytes) -> dict[int, int]:
    """Genera las variantes y las sube al bucket público (cache-control 1 año,
    immutable — el nombre es estable mientras el original no cambie). Devuelve
    {ancho: bytes_generados} (puede faltar algún ancho si la foto original es chica)."""
    await _ensure_bucket()
    variants = await asyncio.to_thread(generate_webp_variants, content)
    if not variants:
        return {}

    async def _upload(width: int, data: bytes) -> None:
        async with _CONCURRENCY:
            await _with_retries(
                get_storage().upload,
                config.BUCKET_IMAGES_PUBLIC,
                _variant_path(object_path, width),
                data,
                "image/webp",
                upsert=True,
                cache_control="31536000",
            )

    await asyncio.gather(*(_upload(w, d) for w, d in variants.items()))
    return {w: len(d) for w, d in variants.items()}


async def delete_variants(object_path: str) -> None:
    storage = get_storage()
    results = await asyncio.gather(
        *(storage.delete(config.BUCKET_IMAGES_PUBLIC, _variant_path(object_path, w)) for w in VARIANT_WIDTHS),
        return_exceptions=True,
    )
    for r in results:
        if isinstance(r, Exception):
            logger.warning("No se pudo borrar una variante pública de %s: %s", object_path, r)


async def write_manifest(property_id: str, widths_by_image: dict[str, list[int]]) -> None:
    await _ensure_bucket()
    data = json.dumps(widths_by_image).encode()
    await get_storage().upload(
        config.BUCKET_IMAGES_PUBLIC, _manifest_path(property_id), data, "application/json",
        upsert=True, cache_control="60",
    )
    _MANIFEST_CACHE.pop(property_id, None)


async def delete_manifest(property_id: str) -> None:
    try:
        await get_storage().delete(config.BUCKET_IMAGES_PUBLIC, _manifest_path(property_id))
    except Exception:  # noqa: BLE001
        pass
    _MANIFEST_CACHE.pop(property_id, None)


async def read_manifest(property_id: str) -> dict[str, list[int]]:
    """{"imageId": [480, 960, 1600]} de las variantes que SÍ existen hoy para esta
    propiedad. {} si nunca se generaron o ya no está publicada."""
    now = time.monotonic()
    hit = _MANIFEST_CACHE.get(property_id)
    if hit and hit[1] > now:
        return hit[0]
    storage = get_storage()
    url = storage.get_public_url(config.BUCKET_IMAGES_PUBLIC, _manifest_path(property_id))
    data: dict = {}
    try:
        async with httpx.AsyncClient(timeout=5) as c:
            r = await c.get(url)
            if r.status_code == 200:
                data = r.json()
    except Exception:  # noqa: BLE001
        data = {}
    _MANIFEST_CACHE[property_id] = (data, now + _MANIFEST_CACHE_TTL)
    return data


async def sync_single_image(property_id: str, img: dict) -> dict[int, int]:
    """Genera (o borra, si ya no se puede) las variantes de UNA foto y actualiza el
    manifest de la propiedad sin tocar las demás fotos. Usado al subir una foto
    nueva a una propiedad ya publicada."""
    storage = get_storage()
    content = await _with_retries(storage.download, img["bucket"], img["object_path"])
    sizes = await generate_and_store(img["object_path"], content)
    manifest = await read_manifest(property_id)
    if sizes:
        manifest[img["id"]] = sorted(sizes)
    else:
        manifest.pop(img["id"], None)
    await write_manifest(property_id, manifest)
    return sizes


async def remove_single_image(property_id: str, img: dict) -> None:
    """Borra las variantes públicas de UNA foto borrada y actualiza el manifest."""
    await delete_variants(img["object_path"])
    manifest = await read_manifest(property_id)
    if manifest.pop(img.get("id"), None) is not None:
        await write_manifest(property_id, manifest)
    else:
        _MANIFEST_CACHE.pop(property_id, None)


async def sync_property(prop: dict) -> dict:
    """Genera/actualiza TODAS las variantes públicas de una propiedad (al publicar,
    re-sincronizar o en el backfill) y reescribe su manifest completo. Devuelve
    stats {'images', 'original_bytes', 'variant_bytes'} para reportes."""
    images = prop.get("property_images") or []
    storage = get_storage()
    widths_by_image: dict[str, list[int]] = {}
    stats = {"images": 0, "original_bytes": 0, "variant_bytes": 0}

    async def _one(img: dict) -> None:
        try:
            async with _CONCURRENCY:
                content = await _with_retries(storage.download, img["bucket"], img["object_path"])
        except Exception as e:  # noqa: BLE001
            logger.warning("No se pudo descargar el original de la imagen %s: %s", img.get("id"), e)
            return
        try:
            sizes = await generate_and_store(img["object_path"], content)
        except Exception as e:  # noqa: BLE001
            logger.warning("No se pudieron generar variantes públicas de la imagen %s: %s", img.get("id"), e)
            return
        if sizes:
            widths_by_image[img["id"]] = sorted(sizes)
            stats["images"] += 1
            stats["original_bytes"] += len(content)
            stats["variant_bytes"] += sum(sizes.values())

    await asyncio.gather(*(_one(img) for img in images))
    await write_manifest(prop["id"], widths_by_image)
    return stats


async def unsync_property(prop: dict) -> None:
    """Borra TODAS las variantes públicas + el manifest de una propiedad al
    despublicarla: no debe quedar nada servible sin firmar."""
    images = prop.get("property_images") or []
    await asyncio.gather(*(delete_variants(img["object_path"]) for img in images), return_exceptions=True)
    await delete_manifest(prop["id"])
