"""Backend regression — Sprint 20 (Duplicar + Publicaciones con URL).
Tests:
- POST /api/properties/{id}/duplicate → new property with '(copia)' title, new code,
  publications={}, without images/documents but with amenities/features preserved.
- POST /api/properties/{id}/publications/{channel} with url:
    publish + url → status published & url stored;
    update without url → keeps previous url;
    unpublish → url cleared to '' and status none.
"""
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
def source_property(api):
    """Create a source property with amenities to duplicate."""
    payload = {
        "title": f"TEST_SPRINT20_SRC_{uuid.uuid4().hex[:6]}",
        "operation": "venta",
        "type": "casa",
        "price": 150000,
        "currency": "USD",
        "address": "Calle 3 456",
        "neighborhood": "Zona Norte",
        "city": "Costa del Este",
        "bedrooms": 3,
        "bathrooms": 2,
        "areaM2": 120,
        "rooms": 5,
        "toilettes": 1,
        "floors": 1,
        "parkingCovered": 1,
        "orientation": "N",
        "condition": "usado",
        "description": "Fuente para test duplicar",
        "amenities": ["parrilla", "piscina", "gas-natural"],
    }
    r = api.post(f"{BASE_URL}/api/properties", json=payload, timeout=30)
    assert r.status_code == 201, r.text
    src = r.json()
    yield src
    # Cleanup source
    api.delete(f"{BASE_URL}/api/properties/{src['id']}", timeout=30)


@pytest.fixture(scope="module")
def duplicates_bag():
    """Registry of duplicate IDs created during tests, deleted at teardown."""
    ids: list[str] = []
    yield ids


@pytest.fixture(scope="module", autouse=True)
def cleanup_duplicates(api, duplicates_bag):
    yield
    for pid in duplicates_bag:
        try:
            api.delete(f"{BASE_URL}/api/properties/{pid}", timeout=15)
        except Exception:
            pass


class TestDuplicate:
    def test_duplicate_returns_new_property(self, api, source_property, duplicates_bag):
        src = source_property
        r = api.post(f"{BASE_URL}/api/properties/{src['id']}/duplicate", timeout=30)
        assert r.status_code in (200, 201), r.text
        copy = r.json()
        duplicates_bag.append(copy["id"])
        assert copy["id"] != src["id"]
        assert copy["title"] == f"{src['title']} (copia)"
        assert copy["status"] == "active"
        assert copy["archived"] is False
        assert copy["publications"] == {}

    def test_duplicate_preserves_data_and_amenities(self, api, source_property, duplicates_bag):
        src = source_property
        r = api.post(f"{BASE_URL}/api/properties/{src['id']}/duplicate", timeout=30)
        assert r.status_code in (200, 201)
        copy = r.json()
        duplicates_bag.append(copy["id"])
        # Core fields preserved
        assert copy["operation"] == src["operation"]
        assert copy["type"] == src["type"]
        assert copy["price"] == src["price"]
        assert copy["currency"] == src["currency"]
        assert copy["address"] == src["address"]
        assert copy["neighborhood"] == src["neighborhood"]
        assert copy["city"] == src["city"]
        assert copy["bedrooms"] == src["bedrooms"]
        assert copy["bathrooms"] == src["bathrooms"]
        assert copy["areaM2"] == src["areaM2"]
        assert copy["rooms"] == src["rooms"]
        assert copy["parkingCovered"] == src["parkingCovered"]
        assert copy["orientation"] == src["orientation"]
        assert copy["condition"] == src["condition"]
        assert copy["description"] == src["description"]
        # Amenities cloned (order-agnostic)
        assert sorted(copy["amenities"]) == sorted(src["amenities"])

    def test_duplicate_has_new_code(self, api, source_property, duplicates_bag):
        src = source_property
        r = api.post(f"{BASE_URL}/api/properties/{src['id']}/duplicate", timeout=30)
        copy = r.json()
        duplicates_bag.append(copy["id"])
        assert copy["code"] != src.get("code", "")
        assert copy["code"], "duplicate must have a non-empty code"

    def test_duplicate_has_no_images_or_documents(self, api, source_property, duplicates_bag):
        src = source_property
        r = api.post(f"{BASE_URL}/api/properties/{src['id']}/duplicate", timeout=30)
        copy = r.json()
        duplicates_bag.append(copy["id"])
        assert copy.get("images", []) == []
        assert copy.get("documents", []) == []

    def test_duplicate_get_persists(self, api, source_property, duplicates_bag):
        src = source_property
        r = api.post(f"{BASE_URL}/api/properties/{src['id']}/duplicate", timeout=30)
        copy = r.json()
        duplicates_bag.append(copy["id"])
        got = api.get(f"{BASE_URL}/api/properties/{copy['id']}", timeout=15).json()
        assert got["title"] == copy["title"]
        assert got["publications"] == {}
        assert sorted(got["amenities"]) == sorted(src["amenities"])

    def test_duplicate_404_for_missing(self, api):
        r = api.post(
            f"{BASE_URL}/api/properties/00000000-0000-0000-0000-000000000000/duplicate",
            timeout=15,
        )
        assert r.status_code == 404


@pytest.fixture(scope="module")
def pub_property(api):
    """Dedicated property for URL publication tests (independent from duplicate)."""
    payload = {
        "title": f"TEST_SPRINT20_PUB_{uuid.uuid4().hex[:6]}",
        "operation": "venta",
        "type": "casa",
        "price": 80000,
        "currency": "USD",
        "address": "Test URL 1",
        "city": "Test",
    }
    r = api.post(f"{BASE_URL}/api/properties", json=payload, timeout=30)
    assert r.status_code == 201, r.text
    pid = r.json()["id"]
    yield pid
    api.delete(f"{BASE_URL}/api/properties/{pid}", timeout=30)


class TestPublicationsWithURL:
    URL_1 = "https://web-varela.example.com/listing/abc-123"
    URL_2 = "https://web-varela.example.com/listing/updated-999"

    def test_publish_with_url_saves(self, api, pub_property):
        r = api.post(
            f"{BASE_URL}/api/properties/{pub_property}/publications/web-varela",
            json={"action": "publish", "url": self.URL_1},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        wv = r.json()["publications"]["web-varela"]
        assert wv["status"] == "published"
        assert wv["url"] == self.URL_1
        assert isinstance(wv["lastSync"], str)

    def test_get_persists_url(self, api, pub_property):
        r = api.get(f"{BASE_URL}/api/properties/{pub_property}", timeout=15)
        wv = r.json()["publications"]["web-varela"]
        assert wv["url"] == self.URL_1

    def test_update_without_url_preserves_url(self, api, pub_property):
        r = api.post(
            f"{BASE_URL}/api/properties/{pub_property}/publications/web-varela",
            json={"action": "update"},
            timeout=15,
        )
        assert r.status_code == 200
        wv = r.json()["publications"]["web-varela"]
        assert wv["url"] == self.URL_1  # preserved
        assert wv["status"] == "published"

    def test_update_with_new_url_replaces(self, api, pub_property):
        r = api.post(
            f"{BASE_URL}/api/properties/{pub_property}/publications/web-varela",
            json={"action": "update", "url": self.URL_2},
            timeout=15,
        )
        assert r.status_code == 200
        wv = r.json()["publications"]["web-varela"]
        assert wv["url"] == self.URL_2

    def test_unpublish_clears_url(self, api, pub_property):
        r = api.post(
            f"{BASE_URL}/api/properties/{pub_property}/publications/web-varela",
            json={"action": "unpublish"},
            timeout=15,
        )
        assert r.status_code == 200
        wv = r.json()["publications"]["web-varela"]
        assert wv["status"] == "none"
        assert wv["url"] == ""
        assert wv["lastSync"] is None

    def test_mercadolibre_url_independent_of_webvarela(self, api, pub_property):
        # publish ML with url
        api.post(
            f"{BASE_URL}/api/properties/{pub_property}/publications/mercadolibre",
            json={"action": "publish", "url": "https://articulo.mercadolibre.com.ar/xyz"},
            timeout=15,
        )
        # publish web-varela with different url
        api.post(
            f"{BASE_URL}/api/properties/{pub_property}/publications/web-varela",
            json={"action": "publish", "url": self.URL_1},
            timeout=15,
        )
        r = api.get(f"{BASE_URL}/api/properties/{pub_property}", timeout=15)
        pubs = r.json()["publications"]
        assert pubs["mercadolibre"]["url"] == "https://articulo.mercadolibre.com.ar/xyz"
        assert pubs["web-varela"]["url"] == self.URL_1
