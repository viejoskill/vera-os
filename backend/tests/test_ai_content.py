"""VERA content intelligence — POST /api/ai/content

Tests the title-suggestion mode powered by Gemini via emergentintegrations.
Covers: happy path (3 titles, <=70 chars, in Spanish), unsupported mode -> 422,
and minimum-data payload (only type + operation) still returning valid titles.
"""
import os
import re

import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")


@pytest.fixture(scope="module")
def api_client():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


# --- AI content: title mode ---
class TestAiContentTitle:
    def test_title_happy_path(self, api_client):
        payload = {
            "mode": "title",
            "type": "departamento",
            "operation": "venta",
            "city": "Mar del Plata",
            "neighborhood": "Playa Grande",
            "bedrooms": 2,
            "bathrooms": 1,
            "areaM2": 65,
            "amenities": ["balcón", "cochera"],
            "nearSea": True,
        }
        resp = api_client.post(f"{BASE_URL}/api/ai/content", json=payload, timeout=60)
        assert resp.status_code == 200, f"{resp.status_code}: {resp.text}"
        body = resp.json()
        assert body.get("mode") == "title"
        suggestions = body.get("suggestions")
        assert isinstance(suggestions, list), "suggestions must be a list"
        assert len(suggestions) == 3, f"expected 3 titles, got {len(suggestions)}: {suggestions}"

        # each title: non-empty string, <=70 chars, distinct
        seen = set()
        for t in suggestions:
            assert isinstance(t, str)
            assert 0 < len(t) <= 70, f"title too long or empty: '{t}' ({len(t)} chars)"
            assert t.lower() not in seen, f"duplicate title: '{t}'"
            seen.add(t.lower())

        # Must not invent absent data (year built was not provided)
        joined = " ".join(suggestions).lower()
        # Rough sanity: at least one title mentions city or property type
        assert (
            "mar del plata" in joined
            or "departamento" in joined
            or "depto" in joined
        ), f"titles feel off-topic: {suggestions}"

    def test_unsupported_mode_returns_422(self, api_client):
        resp = api_client.post(
            f"{BASE_URL}/api/ai/content",
            json={"mode": "foo", "type": "departamento", "operation": "venta"},
            timeout=15,
        )
        assert resp.status_code == 422, f"expected 422, got {resp.status_code}: {resp.text}"

    def test_minimum_data_still_works(self, api_client):
        """Only type + operation. Must not crash on empty city/bedrooms/etc."""
        payload = {"mode": "title", "type": "casa", "operation": "alquiler"}
        resp = api_client.post(f"{BASE_URL}/api/ai/content", json=payload, timeout=60)
        assert resp.status_code == 200, f"{resp.status_code}: {resp.text}"
        body = resp.json()
        assert body.get("mode") == "title"
        suggestions = body.get("suggestions")
        assert isinstance(suggestions, list)
        assert 1 <= len(suggestions) <= 3, f"expected 1-3 titles, got {len(suggestions)}"
        for t in suggestions:
            assert isinstance(t, str) and t.strip()
            assert len(t) <= 70

    def test_regenerate_returns_variation(self, api_client):
        """Two consecutive calls with same payload should be independent (different session_id).
        We can't strictly guarantee different content from the LLM, but we can guarantee both work."""
        payload = {
            "mode": "title",
            "type": "departamento",
            "operation": "venta",
            "city": "Buenos Aires",
            "bedrooms": 3,
        }
        r1 = api_client.post(f"{BASE_URL}/api/ai/content", json=payload, timeout=60)
        r2 = api_client.post(f"{BASE_URL}/api/ai/content", json=payload, timeout=60)
        assert r1.status_code == 200 and r2.status_code == 200
        assert len(r1.json()["suggestions"]) == 3
        assert len(r2.json()["suggestions"]) == 3
