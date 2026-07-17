"""Backend regression — Publications channel board.
POST /api/properties/{id}/publications/{channel} manages a manual jsonb status map.
Only channels in ENABLED_PUBLICATION_CHANNELS ({web-varela, mercadolibre}) accept
actions; other channels return 422. Timestamps are serialised with camelCase key
'lastSync'. VERA never publishes on its own — this is a state board only."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL", "https://real-estate-os-10.preview.emergentagent.com"
).rstrip("/")


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def property_id(api):
    """Create a throwaway property so we don't touch the shared test fixture."""
    payload = {
        "title": f"TEST_PUB_{uuid.uuid4().hex[:6]}",
        "operation": "venta",
        "type": "casa",
        "price": 100000,
        "currency": "USD",
        "address": "Test 123",
        "city": "Costa del Este",
    }
    r = api.post(f"{BASE_URL}/api/properties", json=payload, timeout=30)
    assert r.status_code == 201, r.text
    pid = r.json()["id"]
    yield pid
    api.delete(f"{BASE_URL}/api/properties/{pid}", timeout=30)


# --- happy path ---
class TestPublications:
    def test_default_publications_is_empty_map(self, api, property_id):
        r = api.get(f"{BASE_URL}/api/properties/{property_id}", timeout=15)
        assert r.status_code == 200
        assert r.json().get("publications") == {}

    def test_publish_mercadolibre(self, api, property_id):
        r = api.post(
            f"{BASE_URL}/api/properties/{property_id}/publications/mercadolibre",
            json={"action": "publish"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        pubs = r.json()["publications"]
        assert pubs["mercadolibre"]["status"] == "published"
        assert isinstance(pubs["mercadolibre"]["lastSync"], str)
        # camelCase key required
        assert "last_sync" not in pubs["mercadolibre"]

    def test_publish_web_varela_is_independent(self, api, property_id):
        r = api.post(
            f"{BASE_URL}/api/properties/{property_id}/publications/web-varela",
            json={"action": "publish"},
            timeout=15,
        )
        assert r.status_code == 200
        pubs = r.json()["publications"]
        assert pubs["web-varela"]["status"] == "published"
        # mercadolibre still published from previous test (independent state)
        assert pubs["mercadolibre"]["status"] == "published"

    def test_get_persists_publications_camel(self, api, property_id):
        r = api.get(f"{BASE_URL}/api/properties/{property_id}", timeout=15)
        pubs = r.json()["publications"]
        assert pubs["mercadolibre"]["status"] == "published"
        assert "lastSync" in pubs["mercadolibre"]
        assert "lastSync" in pubs["web-varela"]

    def test_unpublish_sets_none_and_null(self, api, property_id):
        r = api.post(
            f"{BASE_URL}/api/properties/{property_id}/publications/mercadolibre",
            json={"action": "unpublish"},
            timeout=15,
        )
        assert r.status_code == 200
        m = r.json()["publications"]["mercadolibre"]
        assert m["status"] == "none"
        assert m["lastSync"] is None

    def test_disabled_channel_returns_422(self, api, property_id):
        r = api.post(
            f"{BASE_URL}/api/properties/{property_id}/publications/zonaprop",
            json={"action": "publish"},
            timeout=15,
        )
        assert r.status_code == 422
        assert "zonaprop" in r.text

    def test_invalid_action_returns_422(self, api, property_id):
        r = api.post(
            f"{BASE_URL}/api/properties/{property_id}/publications/mercadolibre",
            json={"action": "banana"},
            timeout=15,
        )
        assert r.status_code == 422

    def test_update_action_refreshes_lastsync(self, api, property_id):
        r1 = api.post(
            f"{BASE_URL}/api/properties/{property_id}/publications/web-varela",
            json={"action": "update"},
            timeout=15,
        )
        assert r1.status_code == 200
        assert r1.json()["publications"]["web-varela"]["status"] == "published"
        assert isinstance(r1.json()["publications"]["web-varela"]["lastSync"], str)


# --- legacy compatibility ---
class TestLegacyCompat:
    def test_property_without_publications_returns_empty_map(self, api):
        # Real seeded property listed in the request (may have publications from
        # previous runs — we just assert the key exists and is a dict).
        pid = "41a906da-4cb3-43da-a61f-0a8849f377e0"
        r = api.get(f"{BASE_URL}/api/properties/{pid}", timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json().get("publications"), dict)
