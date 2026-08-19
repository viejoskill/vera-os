"""VERA OS API entrypoint.

Persistence lives behind repositories (Supabase Postgres) and files behind a
StorageService abstraction (private Supabase buckets + signed URLs). The app boots
even when credentials are missing; data routes then return 503 until configured.
"""
import logging

from fastapi import APIRouter, FastAPI
from starlette.middleware.cors import CORSMiddleware

import config
import routes_ai
import routes_brain
import routes_core
from documents.api import router as documents_router
import routes_events
import routes_knowledge
import knowledge.projection  # noqa: F401 — registra el handler del Knowledge Engine
import routes_files
import routes_insights
import routes_integrations
import routes_migration
import routes_people
import routes_public
import routes_ml
import routes_ml_rentals
import routes_properties
import routes_sign
import routes_notifications
import routes_studio
import routes_auth
import routes_tasacion
import routes_tasacion_online
import routes_rentals
import routes_contabilidad
import routes_sitemap

app = FastAPI(title="VERA OS API")

# All routes are namespaced under /api (Kubernetes ingress requirement).
api_router = APIRouter(prefix="/api")


@api_router.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "vera-os",
        "supabase_configured": config.supabase_configured(),
    }


api_router.include_router(routes_properties.router)
api_router.include_router(routes_files.router)
api_router.include_router(routes_ai.router)
api_router.include_router(routes_brain.router)
api_router.include_router(routes_integrations.router)
api_router.include_router(routes_insights.router)
api_router.include_router(routes_migration.router)
api_router.include_router(routes_people.router)
api_router.include_router(routes_public.router)
api_router.include_router(routes_ml.router)
api_router.include_router(routes_ml_rentals.router)
api_router.include_router(routes_events.router)
api_router.include_router(routes_core.router)
api_router.include_router(routes_knowledge.router)
api_router.include_router(documents_router)
api_router.include_router(routes_sign.router)
api_router.include_router(routes_notifications.router)
api_router.include_router(routes_studio.router)
api_router.include_router(routes_auth.router)
api_router.include_router(routes_tasacion.router)
api_router.include_router(routes_tasacion_online.router)
api_router.include_router(routes_rentals.router)
api_router.include_router(routes_contabilidad.router)
api_router.include_router(routes_sitemap.router)
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=config.CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("vera")
