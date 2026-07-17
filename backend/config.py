"""Central configuration. Reads env only; missing secrets stay None so the app
still boots (product-first). Data + Storage both run on the Supabase credentials."""
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

SUPABASE_URL = os.environ.get("SUPABASE_URL") or None
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or None

BUCKET_IMAGES = os.environ.get("SUPABASE_BUCKET_IMAGES", "property-images")
BUCKET_DOCUMENTS = os.environ.get("SUPABASE_BUCKET_DOCUMENTS", "property-documents")
SIGNED_URL_TTL_SECONDS = int(os.environ.get("SIGNED_URL_TTL_SECONDS", "3600"))
DEFAULT_WORKSPACE_ID = os.environ.get("DEFAULT_WORKSPACE_ID", "vera-default")

CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*").split(",")

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY") or None


def ai_configured() -> bool:
    return bool(EMERGENT_LLM_KEY)


def supabase_configured() -> bool:
    return bool(SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)
