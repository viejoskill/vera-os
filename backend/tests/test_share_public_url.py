"""Sprint: Compartir Propiedades (Public URL).

Verifica que Property.publicUrl sea la URL pública canónica (backend = fuente única):
- Propiedad publicada en web -> publicUrl == https://www.varelapropiedadescde.com.ar/propiedad/<code-lowercase>
- Propiedad NO publicada (draft) -> publicUrl == None
- GET /api/public/listings/{id} -> publicUrl canónica SIN parámetros de tracking
"""
from __future__ import annotations

import os
import time

import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else "https://real-estate-os-10.preview.emergentagent.com"

PUBLISHED_ID = "9c1d4217-2522-4649-a269-bbd536a71f39"
PUBLISHED_CODE = "VAR-163159"
EXPECTED_CANONICAL = "https://www.varelapropiedadescde.com.ar/propiedad/var-163159"


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# --- Backend: list endpoint carries canonical publicUrl for published property ---
class TestListPublicUrl:
    def test_get_properties_returns_public_url_for_published(self, api):
        r = api.get(f"{BASE_URL}/api/properties", timeout=30)
        assert r.status_code == 200, r.text
        rows = r.json()
        assert isinstance(rows, list) and len(rows) > 0
        published = next((p for p in rows if p.get("code") == PUBLISHED_CODE), None)
        assert published is not None, f"Fixture property {PUBLISHED_CODE} not found"
        assert published["publicUrl"] == EXPECTED_CANONICAL
        # Sanity: no tracking params in canonical URL
        assert "?" not in published["publicUrl"]
        assert "source=" not in published["publicUrl"]

    def test_get_property_detail_returns_canonical_public_url(self, api):
        r = api.get(f"{BASE_URL}/api/properties/{PUBLISHED_ID}", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["publicUrl"] == EXPECTED_CANONICAL

    def test_all_properties_have_public_url_key(self, api):
        """Every property (published or not) must expose publicUrl in the response
        (either canonical string or explicit null)."""
        r = api.get(f"{BASE_URL}/api/properties", timeout=30)
        assert r.status_code == 200
        for p in r.json():
            assert "publicUrl" in p, f"Missing publicUrl key on {p.get('id')}"
            # Sanity check on non-null values
            if p["publicUrl"] is not None:
                assert p["publicUrl"].startswith(
                    "https://www.varelapropiedadescde.com.ar/propiedad/"
                ), f"Unexpected publicUrl format: {p['publicUrl']}"
                assert "?" not in p["publicUrl"]
                # Must be lower-cased code
                assert p["publicUrl"].endswith(f"/propiedad/{p['code'].lower()}"), (
                    f"publicUrl mismatch: {p['publicUrl']} vs code {p['code']}"
                )


# --- Backend: draft/unpublished has null publicUrl ---
class TestUnpublishedPublicUrl:
    def test_draft_property_has_null_public_url(self, api):
        payload = {
            "title": "TEST_share_unpub",
            "operation": "venta",
            "type": "departamento",
            "price": 1,
            "currency": "USD",
            "status": "draft",
        }
        r = api.post(f"{BASE_URL}/api/properties", json=payload, timeout=30)
        assert r.status_code in (200, 201), r.text
        created = r.json()
        pid = created["id"]
        try:
            # publicUrl on POST response must be null (draft, not web-published)
            assert created.get("publicUrl") is None, (
                f"Expected publicUrl=null on draft, got {created.get('publicUrl')!r}"
            )
            # And also via GET
            r2 = api.get(f"{BASE_URL}/api/properties/{pid}", timeout=30)
            assert r2.status_code == 200
            assert r2.json().get("publicUrl") is None
        finally:
            d = api.delete(f"{BASE_URL}/api/properties/{pid}", timeout=30)
            assert d.status_code in (200, 204), d.text


# --- Backend: /api/public/listings/{id} returns canonical publicUrl (no tracking) ---
class TestPublicListingsPublicUrl:
    def test_public_listing_returns_canonical_public_url(self, api):
        r = api.get(f"{BASE_URL}/api/public/listings/{PUBLISHED_ID}", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("publicUrl") == EXPECTED_CANONICAL
        assert "?" not in data["publicUrl"]
        assert "source=website" not in data["publicUrl"]
        # whatsappUrl still includes tracking (that's the WA link), but publicUrl must not.
        wa = data.get("whatsappUrl") or ""
        assert "wa.me" in wa

    def test_public_listings_index_contains_canonical_public_url(self, api):
        r = api.get(f"{BASE_URL}/api/public/listings", timeout=30)
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list) and len(rows) > 0
        item = next((x for x in rows if x.get("id") == PUBLISHED_ID), None)
        assert item is not None, "Published fixture not present in public listings"
        assert item.get("publicUrl") == EXPECTED_CANONICAL
        assert "?" not in item["publicUrl"]
