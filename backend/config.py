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

MONGO_URL = os.environ.get("MONGO_URL") or None
DB_NAME = os.environ.get("DB_NAME", "vera")
# CRM Varela (fuente real). App client-side → su URL + key anon son públicas (en el HTML).
# El importador LEE de acá (PostgREST) y mapea a VERA. Solo lectura.
CRM_SUPABASE_URL = os.environ.get("CRM_SUPABASE_URL") or None
CRM_SUPABASE_KEY = os.environ.get("CRM_SUPABASE_KEY") or None


def crm_configured() -> bool:
    return bool(CRM_SUPABASE_URL and CRM_SUPABASE_KEY)


# Mercado Libre (API real). App del vendedor Varela. Secret solo en backend.
MELI_APP_ID = os.environ.get("MELI_APP_ID") or None
MELI_CLIENT_SECRET = os.environ.get("MELI_CLIENT_SECRET") or None
MELI_AUTH_HOST = os.environ.get("MELI_AUTH_HOST", "https://auth.mercadolibre.com.ar")
MELI_API = "https://api.mercadolibre.com"


def meli_configured() -> bool:
    return bool(MELI_APP_ID and MELI_CLIENT_SECRET)

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY") or None

# Publication channels the agent can operate today (status board). Scalable: add
# more providers here; the UI reads its own catalog. No integration is hardcoded.
ENABLED_PUBLICATION_CHANNELS = {"web-varela", "mercadolibre"}


def ai_configured() -> bool:
    return bool(EMERGENT_LLM_KEY)


def supabase_configured() -> bool:
    return bool(SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)
