"""Sprint 'Ubicación Inteligente' — round-trip camelCase↔snake_case for geo fields.

Tests that latitude/longitude/googlePlaceId/formattedAddress/province/postalCode/country
sent as camelCase in POST/PATCH persist and are returned identically in GET.
"""
import os
import pytest
import requests
from pathlib import Path

def _load_backend_url():
    val = os.environ.get("REACT_APP_BACKEND_URL")
    if val:
        return val.rstrip("/")
    env_path = Path("/app/frontend/.env")
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith("REACT_APP_BACKEND_URL="):
                return line.split("=", 1)[1].strip().rstrip("/")
    raise RuntimeError("REACT_APP_BACKEND_URL not set")

BASE_URL = _load_backend_url()
API = f"{BASE_URL}/api"

GEO_PAYLOAD = {
    "title": "TEST_geo_roundtrip Property",
    "operation": "venta",
    "type": "departamento",
    "price": 150000,
    "currency": "USD",
    "address": "Av. Corrientes 1234",
    "neighborhood": "San Nicolás",
    "city": "Buenos Aires",
    "province": "CABA",
    "postalCode": "C1043",
    "country": "Argentina",
    "latitude": -34.60441,
    "longitude": -58.38559,
    "googlePlaceId": "ChIJTEST_placeid_corrientes_1234",
    "formattedAddress": "Av. Corrientes 1234, C1043 CABA, Argentina",
}


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def created_id(client):
    """Create one property with full geo payload, yield its id, delete at end."""
    r = client.post(f"{API}/properties", json=GEO_PAYLOAD, timeout=30)
    assert r.status_code == 201, f"POST /properties failed: {r.status_code} {r.text}"
    body = r.json()
    pid = body["id"]
    yield pid
    # cleanup
    try:
        client.delete(f"{API}/properties/{pid}", timeout=20)
    except Exception:
        pass


class TestGeoRoundTrip:
    """Verify POST → response carries geo fields, and GET returns them."""

    def test_post_response_has_geo_fields(self, client, created_id):
        # Re-fetch by id and validate
        r = client.get(f"{API}/properties/{created_id}", timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        # Field presence + values (camelCase on the wire).
        assert body["latitude"] == pytest.approx(GEO_PAYLOAD["latitude"], rel=1e-6)
        assert body["longitude"] == pytest.approx(GEO_PAYLOAD["longitude"], rel=1e-6)
        assert body["googlePlaceId"] == GEO_PAYLOAD["googlePlaceId"]
        assert body["formattedAddress"] == GEO_PAYLOAD["formattedAddress"]
        assert body["province"] == GEO_PAYLOAD["province"]
        assert body["postalCode"] == GEO_PAYLOAD["postalCode"]
        assert body["country"] == GEO_PAYLOAD["country"]
        assert body["address"] == GEO_PAYLOAD["address"]
        assert body["neighborhood"] == GEO_PAYLOAD["neighborhood"]
        assert body["city"] == GEO_PAYLOAD["city"]

    def test_no_snakecase_leaks_in_response(self, client, created_id):
        r = client.get(f"{API}/properties/{created_id}", timeout=15)
        body = r.json()
        # response must NOT expose snake_case aliases
        assert "google_place_id" not in body
        assert "formatted_address" not in body
        assert "postal_code" not in body

    def test_patch_updates_lat_lng(self, client, created_id):
        new_lat = -34.5875
        new_lng = -58.3974
        r = client.patch(
            f"{API}/properties/{created_id}",
            json={"latitude": new_lat, "longitude": new_lng},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["latitude"] == pytest.approx(new_lat, rel=1e-6)
        assert body["longitude"] == pytest.approx(new_lng, rel=1e-6)
        # Verify persistence via GET
        r2 = client.get(f"{API}/properties/{created_id}", timeout=15)
        b2 = r2.json()
        assert b2["latitude"] == pytest.approx(new_lat, rel=1e-6)
        assert b2["longitude"] == pytest.approx(new_lng, rel=1e-6)
        # Other geo fields must remain intact
        assert b2["googlePlaceId"] == GEO_PAYLOAD["googlePlaceId"]
        assert b2["formattedAddress"] == GEO_PAYLOAD["formattedAddress"]

    def test_patch_updates_place_id_and_formatted(self, client, created_id):
        new_pid = "ChIJTEST_updated_placeid"
        new_fmt = "Nueva Dirección 999, CABA"
        r = client.patch(
            f"{API}/properties/{created_id}",
            json={
                "googlePlaceId": new_pid,
                "formattedAddress": new_fmt,
                "address": "Nueva Dirección 999",
            },
            timeout=20,
        )
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["googlePlaceId"] == new_pid
        assert b["formattedAddress"] == new_fmt
        assert b["address"] == "Nueva Dirección 999"

    def test_list_properties_carries_geo(self, client, created_id):
        r = client.get(f"{API}/properties", timeout=20)
        assert r.status_code == 200
        rows = r.json()
        row = next((p for p in rows if p["id"] == created_id), None)
        assert row is not None, "created property not in list"
        # After patch: lat/lng updated, place id updated
        assert row["latitude"] is not None
        assert row["longitude"] is not None
        assert row["googlePlaceId"].startswith("ChIJTEST_")


class TestNullableLatLng:
    """Property created without coordinates: latitude/longitude must be null (not 0)."""

    def test_create_without_coords_returns_nulls(self, client):
        payload = {
            "title": "TEST_geo_no_coords",
            "operation": "venta",
            "type": "casa",
            "price": 0,
            "currency": "USD",
            "address": "",
        }
        r = client.post(f"{API}/properties", json=payload, timeout=20)
        assert r.status_code == 201, r.text
        body = r.json()
        pid = body["id"]
        try:
            assert body["latitude"] is None
            assert body["longitude"] is None
            assert body["googlePlaceId"] == ""
            assert body["formattedAddress"] == ""
        finally:
            client.delete(f"{API}/properties/{pid}", timeout=15)
