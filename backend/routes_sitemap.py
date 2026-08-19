"""Sitemap dinámico para el sitio público. IMPORTANTE: en este entorno el backend
solo es alcanzable bajo `/api` (requisito del ingress k8s); por eso el sitemap se
sirve en `/api/sitemap.xml` y se declara así en `robots.txt`. Google acepta un
sitemap alojado en cualquier ruta del mismo host siempre que esté declarado en
robots.txt. Las URLs de adentro apuntan a la raíz pública (`/web/{id}`, sin `/api`)."""
from fastapi import APIRouter, Request
from fastapi.responses import Response

import config
import inquiries
from property_repository import property_repository

router = APIRouter(tags=["seo"])

STATIC_URLS = [
    "/",
    "/web",
    "/tasar",
    "/venta/costa-del-este",
    "/venta/casas-costa-del-este",
    "/venta/lotes-costa-del-este",
    "/venta/ph-costa-del-este",
]


@router.get("/sitemap.xml")
async def sitemap(request: Request):
    host = (
        request.headers.get("x-forwarded-host")
        or request.headers.get("host")
        or "www.varelapropiedadescde.com.ar"
    )
    scheme = request.headers.get("x-forwarded-proto", "https")
    base = f"{scheme}://{host}"

    urls = [f"{base}{p}" for p in STATIC_URLS]
    if config.supabase_configured():
        rows = await property_repository.list_properties(status="all")
        urls += [
            f"{base}/web/{r['id']}"
            for r in rows
            if inquiries.is_web_published(r)
        ]

    body = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    body += [f"<url><loc>{u}</loc></url>" for u in urls]
    body.append("</urlset>")

    return Response(content="\n".join(body), media_type="application/xml")
