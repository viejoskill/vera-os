"""VERA OS API entrypoint.

Sprint 0A: the frontend runs on mock data, so this exposes only a health check.
The VERA backend structure (database.py, models.py, services/) is preserved and ready
to be mounted when real persistence is introduced.
"""
import logging
import os

from fastapi import APIRouter, FastAPI
from starlette.middleware.cors import CORSMiddleware

from database import close_client

app = FastAPI(title="VERA OS API")

# All routes are namespaced under /api (Kubernetes ingress requirement).
api_router = APIRouter(prefix="/api")


@api_router.get("/health")
async def health():
    return {"status": "ok", "service": "vera-os"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("vera")


@app.on_event("shutdown")
async def shutdown_db_client():
    close_client()
