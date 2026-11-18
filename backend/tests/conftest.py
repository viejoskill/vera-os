"""Inyecta automáticamente un token de sesión (cuenta de QA Administrador persistente) en
TODOS los llamados de `requests` de la suite, porque desde la autorización por roles (2026-11)
cada endpoint no público exige un JWT válido (401 sin sesión). Sin esto, cualquier test que
use `requests.get/post/...` directo (sin pasar headers) recibiría 401 en vez de probar la
lógica real. Ver /app/memory/test_credentials.md para la cuenta usada."""
from __future__ import annotations

import os

import pytest
import requests


def _fetch_admin_token() -> str | None:
    frontend_env = "/app/frontend/.env"
    supa_url, supa_key = None, None
    if os.path.exists(frontend_env):
        for line in open(frontend_env, encoding="utf-8"):
            if line.startswith("REACT_APP_SUPABASE_URL="):
                supa_url = line.split("=", 1)[1].strip()
            elif line.startswith("REACT_APP_SUPABASE_ANON_KEY="):
                supa_key = line.split("=", 1)[1].strip()
    if not supa_url or not supa_key:
        return None
    r = requests.post(
        f"{supa_url}/auth/v1/token?grant_type=password",
        headers={"apikey": supa_key, "Content-Type": "application/json"},
        json={"email": "qa_admin_roles@vera.test", "password": "QaRoles!2026Admin"},
        timeout=15,
    )
    if r.status_code != 200:
        return None
    return r.json().get("access_token")


@pytest.fixture(scope="session", autouse=True)
def _inject_auth_header():
    token = _fetch_admin_token()
    if not token:
        yield
        return
    original_request = requests.Session.request

    def patched(self, method, url, *args, **kwargs):
        headers = dict(kwargs.get("headers") or {})
        headers.setdefault("Authorization", f"Bearer {token}")
        kwargs["headers"] = headers
        return original_request(self, method, url, *args, **kwargs)

    requests.Session.request = patched
    yield
    requests.Session.request = original_request
