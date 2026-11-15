"""Backfill único: genera las variantes WebP públicas (480/960/1600px) de todas
las fotos de propiedades YA PUBLICADAS en la web, para las que se subieron antes
de esta feature. Idempotente — usa upsert, se puede correr muchas veces sin
duplicar ni romper nada; las que ya tienen variantes simplemente se regeneran
igual (mismo contenido, mismo nombre determinístico).

Uso:  python -m scripts.backfill_public_photo_variants
"""
import asyncio
import logging

import public_photos
from inquiries import is_web_published
from property_repository import property_repository

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("backfill")


async def main() -> None:
    rows = await property_repository.list_properties(status="all")
    published = [r for r in rows if is_web_published(r)]
    logger.info("Propiedades publicadas en la web: %d", len(published))

    total_props = total_images = 0
    total_original_bytes = total_variant_bytes = 0

    for prop in published:
        n_images = len(prop.get("property_images") or [])
        if not n_images:
            continue
        stats = await public_photos.sync_property(prop)
        total_props += 1
        total_images += stats["images"]
        total_original_bytes += stats["original_bytes"]
        total_variant_bytes += stats["variant_bytes"]
        logger.info(
            "OK  %s — %d/%d fotos, %.0fKB original -> %.0fKB en variantes (480+960+1600)",
            prop.get("codigo") or prop["id"], stats["images"], n_images,
            stats["original_bytes"] / 1024, stats["variant_bytes"] / 1024,
        )

    avg_original = total_original_bytes / total_images if total_images else 0
    avg_variant_set = total_variant_bytes / total_images if total_images else 0
    logger.info(
        "Backfill terminado: %d propiedades, %d fotos procesadas.\n"
        "  Peso total de los originales:            %.1f MB\n"
        "  Peso total generado (3 variantes c/foto): %.1f MB\n"
        "  Promedio por foto -> original: %.0fKB | las 3 variantes juntas: %.0fKB"
        " (la que realmente baja una card de listado en celular es solo la de 480px,"
        " bastante menos que ese total)",
        total_props, total_images,
        total_original_bytes / 1024 / 1024, total_variant_bytes / 1024 / 1024,
        avg_original / 1024, avg_variant_set / 1024,
    )


if __name__ == "__main__":
    asyncio.run(main())
