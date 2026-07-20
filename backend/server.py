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
import routes_files
import routes_insights
import routes_integrations
import routes_migration
import routes_properties
from legacy_crm import exporter as legacy_exporter

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
api_router.include_router(legacy_exporter.router)
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
