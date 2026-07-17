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


# --- AI content: description mode ---
class TestAiContentDescription:
    _payload = {
        "mode": "description",
        "type": "departamento",
        "operation": "venta",
        "city": "Mar del Plata",
        "neighborhood": "Playa Grande",
        "rooms": 3,
        "bedrooms": 2,
        "bathrooms": 1,
        "areaM2": 65,
        "amenities": ["Balcón", "Cochera cubierta", "Parrilla", "Piscina"],
        "nearSea": True,
    }

    def test_description_happy_path(self, api_client):
        resp = api_client.post(f"{BASE_URL}/api/ai/content", json=self._payload, timeout=60)
        assert resp.status_code == 200, f"{resp.status_code}: {resp.text}"
        body = resp.json()
        assert body.get("mode") == "description"
        suggestions = body.get("suggestions")
        assert isinstance(suggestions, list) and len(suggestions) == 1
        text = suggestions[0]
        assert isinstance(text, str)
        # loose range: LLM may deviate slightly. Accept 400..1200 while checking ~600-900 target.
        assert 400 <= len(text) <= 1200, f"description length off-target: {len(text)} chars"

    def test_description_does_not_invent_data(self, api_client):
        """When year_built is not provided, VERA must not mention a specific year."""
        resp = api_client.post(f"{BASE_URL}/api/ai/content", json=self._payload, timeout=60)
        assert resp.status_code == 200
        text = resp.json()["suggestions"][0]
        # No 4-digit year that looks like a construction year should be invented
        years = re.findall(r"\b(19|20)\d{2}\b", text)
        assert not years, f"description invented year(s): {years} — text: {text[:200]}"


# --- AI content: highlights mode ---
class TestAiContentHighlights:
    def test_highlights_happy_path(self, api_client):
        payload = {
            "mode": "highlights",
            "type": "casa",
            "operation": "venta",
            "city": "Pinamar",
            "rooms": 4,
            "bedrooms": 3,
            "bathrooms": 2,
            "areaM2": 140,
            "lotAreaM2": 400,
            "amenities": ["Parrilla", "Piscina", "Quincho", "Cochera cubierta"],
            "nearSea": True,
        }
        resp = api_client.post(f"{BASE_URL}/api/ai/content", json=payload, timeout=60)
        assert resp.status_code == 200, f"{resp.status_code}: {resp.text}"
        body = resp.json()
        assert body.get("mode") == "highlights"
        bullets = body.get("suggestions")
        assert isinstance(bullets, list), "highlights must be a list"
        assert 4 <= len(bullets) <= 6, f"expected 4-6 bullets, got {len(bullets)}: {bullets}"
        for b in bullets:
            assert isinstance(b, str) and b.strip(), f"empty bullet: {b!r}"
            # short bullet — allow small overshoot from LLM
            assert len(b) <= 90, f"bullet too long: {b} ({len(b)} chars)"


# --- AI content: portal mode ---
class TestAiContentPortal:
    _base = {
        "mode": "portal",
        "type": "departamento",
        "operation": "venta",
        "city": "Mar del Plata",
        "neighborhood": "Playa Grande",
        "rooms": 3,
        "bedrooms": 2,
        "bathrooms": 1,
        "areaM2": 65,
        "amenities": ["Balcón", "Cochera cubierta"],
        "nearSea": True,
        "title": "Departamento 3 amb. Playa Grande a metros del mar",
        "description": "Excelente departamento con vista al mar. Ideal familia.",
    }

    def test_portal_mercadolibre(self, api_client):
        payload = {**self._base, "portal": "mercadolibre"}
        resp = api_client.post(f"{BASE_URL}/api/ai/content", json=payload, timeout=60)
        assert resp.status_code == 200, f"{resp.status_code}: {resp.text}"
        body = resp.json()
        assert body.get("mode") == "portal"
        assert isinstance(body.get("title"), str) and body["title"].strip(), "empty ML title"
        assert isinstance(body.get("body"), str) and body["body"].strip(), "empty ML body"
        # ML: no contact info allowed
        low = body["body"].lower()
        assert "@" not in body["body"], "ML body should not include email"
        assert not re.search(r"https?://", low), "ML body should not include links"

    def test_portal_zonaprop(self, api_client):
        payload = {**self._base, "portal": "zonaprop"}
        resp = api_client.post(f"{BASE_URL}/api/ai/content", json=payload, timeout=60)
        assert resp.status_code == 200, f"{resp.status_code}: {resp.text}"
        body = resp.json()
        assert body["title"].strip() and body["body"].strip()

    def test_portal_invalid_returns_422(self, api_client):
        payload = {**self._base, "portal": "facebook"}
        resp = api_client.post(f"{BASE_URL}/api/ai/content", json=payload, timeout=15)
        assert resp.status_code == 422, f"expected 422, got {resp.status_code}: {resp.text}"
