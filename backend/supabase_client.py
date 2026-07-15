"""Single Supabase client for the whole backend (data via PostgREST + Storage).
The only module that imports the Supabase SDK. Everything else depends on the
repository / StorageService abstractions."""
from supabase import Client, create_client

import config

_client: Client | None = None


def get_supabase() -> Client:
    global _client
    if _client is None:
        if not config.supabase_configured():
            raise RuntimeError("Supabase is not configured (SUPABASE_URL / key missing)")
        _client = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY)
    return _client
