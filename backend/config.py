"""Central configuration. Reads env only; missing secrets stay None so the app
still boots (product-first). Feature helpers gate DB/Storage-backed routes."""
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

DATABASE_URL = os.environ.get("DATABASE_URL") or None
SUPABASE_URL = os.environ.get("SUPABASE_URL") or None
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or None

BUCKET_IMAGES = os.environ.get("SUPABASE_BUCKET_IMAGES", "property-images")
BUCKET_DOCUMENTS = os.environ.get("SUPABASE_BUCKET_DOCUMENTS", "property-documents")
SIGNED_URL_TTL_SECONDS = int(os.environ.get("SIGNED_URL_TTL_SECONDS", "3600"))
DEFAULT_WORKSPACE_ID = os.environ.get("DEFAULT_WORKSPACE_ID", "vera-default")

CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*").split(",")


def db_configured() -> bool:
    return bool(DATABASE_URL)


def storage_configured() -> bool:
    return bool(SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)
