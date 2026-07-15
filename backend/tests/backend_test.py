"""VERA OS backend regression tests (Sprint 0A.1).

Only /api/health is exposed this sprint. StatusCheck/example routes were
intentionally removed and MUST return 404.
"""
import os

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://real-estate-os-10.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="module")
def api_client():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


# --- Health check (only exposed route) ---
class TestHealth:
    def test_health_status_code(self, api_client):
        resp = api_client.get(f"{BASE_URL}/api/health", timeout=15)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"

    def test_health_payload(self, api_client):
        resp = api_client.get(f"{BASE_URL}/api/health", timeout=15)
        data = resp.json()
        assert data == {"status": "ok", "service": "vera-os"}, f"Unexpected body: {data}"


# --- Removed routes MUST be gone ---
class TestRemovedRoutes:
    @pytest.mark.parametrize("path", ["/api/", "/api/status"])
    def test_removed_routes_return_404(self, api_client, path):
        resp = api_client.get(f"{BASE_URL}{path}", timeout=15)
        assert resp.status_code == 404, (
            f"{path} should be removed (404) but returned {resp.status_code}: {resp.text}"
        )

    def test_removed_status_post_returns_404_or_405(self, api_client):
        resp = api_client.post(f"{BASE_URL}/api/status", json={"client_name": "regression"}, timeout=15)
        assert resp.status_code in (404, 405), (
            f"POST /api/status should be removed; got {resp.status_code}"
        )


# --- CORS still configured ---
class TestCors:
    def test_cors_headers_present(self, api_client):
        resp = api_client.get(
            f"{BASE_URL}/api/health",
            headers={"Origin": "https://real-estate-os-10.preview.emergentagent.com"},
            timeout=15,
        )
        assert resp.status_code == 200
        # CORS header should be present when Origin is sent.
        assert "access-control-allow-origin" in {k.lower() for k in resp.headers.keys()}
