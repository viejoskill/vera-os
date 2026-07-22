"""Backfill único de `publications['web-varela'].url`.

Para cada propiedad publicada en la web SIN url persistida, calcula la URL pública
con el pipeline (`web_publisher.web_url`) y VALIDA que la fila exista en el CRM
antes de escribirla. Si no existe → marca la publicación como 'inconsistent'
(preferimos una propiedad sin botón "Compartir" a una con link roto).

Uso:  python -m scripts.backfill_public_url
"""
import asyncio
import logging
from datetime import datetime, timezone

import web_publisher
from property_repository import property_repository

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("backfill")


async def main() -> None:
    rows = await property_repository.list_properties(status="all")
    fixed = inconsistent = skipped = 0
    for r in rows:
        web = (r.get("publications") or {}).get("web-varela") or {}
        if web.get("status") not in ("published", "inconsistent"):
            continue
        if web.get("status") == "published" and web.get("url"):
            skipped += 1
            continue
        prop = await property_repository.get(r["id"])  # incluye legacy_id
        if prop is None:
            continue
        lid = web_publisher._legacy_id(prop)
        exists = await web_publisher._row_exists(lid)
        pubs = dict(prop.get("publications") or {})
        now = datetime.now(timezone.utc).isoformat()
        if exists:
            pubs["web-varela"] = {"status": "published", "lastSync": now, "url": web_publisher.web_url(prop)}
            fixed += 1
            logger.info("OK  %s -> %s", prop.get("codigo") or prop["id"], pubs["web-varela"]["url"])
        else:
            pubs["web-varela"] = {"status": "inconsistent", "lastSync": now, "url": ""}
            inconsistent += 1
            logger.warning("INCONSISTENTE %s (id CRM %s no existe)", prop.get("codigo") or prop["id"], lid)
        await property_repository.update(prop["id"], {"publications": pubs})
    logger.info("Backfill terminado: %d corregidas, %d inconsistentes, %d ya OK", fixed, inconsistent, skipped)


if __name__ == "__main__":
    asyncio.run(main())
