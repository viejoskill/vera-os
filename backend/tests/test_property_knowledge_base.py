"""
Backend regression tests for Sprint 'Cerrar módulo Características'.

Covers new PropertyCreate/Update/Response fields:
- rooms, toilettes, semiCoveredAreaM2, lotAreaM2, floors, floorNumber
- parkingCovered, parkingUncovered, orientation, condition
- amenities (list[str] of canonical keys)

Also verifies backward compatibility for a legacy property (no new fields on POST
should come back as safe defaults on GET).
"""
import os

import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://real-estate-os-10.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def created_ids():
    ids: list[str] = []
    yield ids
    # Teardown: clean up every property created during the module run.
    for pid in ids:
        try:
            requests.delete(f"{API}/properties/{pid}", timeout=30)
        except Exception:
            pass


def _create_full_payload() -> dict:
    """Full property with every new knowledge-base field set."""
    return {
        "title": "TEST_KB_full_property",
        "operation": "venta",
        "type": "departamento",
        "price": 250000,
        "currency": "USD",
        "city": "Buenos Aires",
        "neighborhood": "Palermo",
        "bedrooms": 2,
        "bathrooms": 2,
        "areaM2": 78,
        "rooms": 3,
        "toilettes": 1,
        "semiCoveredAreaM2": 12,
        "lotAreaM2": 0,
        "floors": 1,
        "floorNumber": 4,
        "parkingCovered": 1,
        "parkingUncovered": 0,
        "orientation": "NE",
        "condition": "muy-bueno",
        "yearBuilt": "2018",
        "amenities": ["parrilla", "gas-natural", "pileta", "seguridad-24hs"],
    }


class TestPropertyKnowledgeBase:
    """New fields round-trip through POST/GET/PATCH."""

    def test_create_persists_all_new_fields(self, created_ids):
        payload = _create_full_payload()
        r = requests.post(f"{API}/properties", json=payload, timeout=30)
        assert r.status_code == 201, r.text
        data = r.json()
        created_ids.append(data["id"])

        # New objective features
        assert data["rooms"] == 3
        assert data["toilettes"] == 1
        assert data["semiCoveredAreaM2"] == 12
        assert data["lotAreaM2"] == 0
        assert data["floors"] == 1
        assert data["floorNumber"] == 4
        assert data["parkingCovered"] == 1
        assert data["parkingUncovered"] == 0
        assert data["orientation"] == "NE"
        assert data["condition"] == "muy-bueno"
        # Amenities: list of canonical keys, exact
        assert isinstance(data["amenities"], list)
        assert sorted(data["amenities"]) == sorted(
            ["parrilla", "gas-natural", "pileta", "seguridad-24hs"]
        )

    def test_get_returns_all_new_fields(self, created_ids):
        assert created_ids, "previous create test must have populated created_ids"
        pid = created_ids[0]
        r = requests.get(f"{API}/properties/{pid}", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["rooms"] == 3
        assert data["toilettes"] == 1
        assert data["semiCoveredAreaM2"] == 12
        assert data["floors"] == 1
        assert data["floorNumber"] == 4
        assert data["orientation"] == "NE"
        assert data["condition"] == "muy-bueno"
        assert isinstance(data["amenities"], list)
        assert "parrilla" in data["amenities"]
        assert "gas-natural" in data["amenities"]

    def test_patch_replaces_amenities_and_updates_condition(self, created_ids):
        pid = created_ids[0]
        new_amenities = ["balcon", "cochera", "aire-acondicionado"]
        patch = {"amenities": new_amenities, "condition": "excelente"}
        r = requests.patch(f"{API}/properties/{pid}", json=patch, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        # PATCH response should reflect changes
        assert sorted(data["amenities"]) == sorted(new_amenities)
        assert data["condition"] == "excelente"

        # Verify with GET (persistence)
        g = requests.get(f"{API}/properties/{pid}", timeout=30)
        assert g.status_code == 200
        gd = g.json()
        assert sorted(gd["amenities"]) == sorted(new_amenities)
        assert gd["condition"] == "excelente"
        # Amenities list must be REPLACED, not merged (no stale keys)
        assert "parrilla" not in gd["amenities"]

    def test_patch_can_clear_amenities(self, created_ids):
        pid = created_ids[0]
        r = requests.patch(f"{API}/properties/{pid}", json={"amenities": []}, timeout=30)
        assert r.status_code == 200
        assert r.json()["amenities"] == []
        g = requests.get(f"{API}/properties/{pid}", timeout=30)
        assert g.json()["amenities"] == []


class TestLegacyCompatibility:
    """A property CREATED WITHOUT the new fields must still be usable
    (GET returns defaults; PATCH does not fail)."""

    def test_create_legacy_minimal_and_get_returns_defaults(self, created_ids):
        # Deliberately minimal: title, operation, type — pretend legacy client.
        r = requests.post(
            f"{API}/properties",
            json={
                "title": "TEST_KB_legacy_property",
                "operation": "alquiler",
                "type": "casa",
                "price": 500,
                "currency": "USD",
            },
            timeout=30,
        )
        assert r.status_code == 201, r.text
        data = r.json()
        pid = data["id"]
        created_ids.append(pid)

        # Defaults must be safe/typed for the frontend.
        assert data["rooms"] == 0
        assert data["toilettes"] == 0
        assert data["floors"] == 0
        assert data["floorNumber"] is None
        assert data["parkingCovered"] == 0
        assert data["parkingUncovered"] == 0
        assert data["orientation"] == ""
        assert data["condition"] == ""
        assert data["amenities"] == []
        assert data["semiCoveredAreaM2"] == 0
        assert data["lotAreaM2"] == 0

        # GET returns the same defaults (idempotent)
        g = requests.get(f"{API}/properties/{pid}", timeout=30)
        assert g.status_code == 200
        gd = g.json()
        assert gd["rooms"] == 0
        assert gd["floorNumber"] is None
        assert gd["amenities"] == []
        assert gd["orientation"] == ""
        assert gd["condition"] == ""

    def test_patch_legacy_property_adds_new_fields(self, created_ids):
        # The most recently created id belongs to the legacy fixture above.
        pid = created_ids[-1]
        patch = {
            "rooms": 4,
            "toilettes": 1,
            "orientation": "S",
            "condition": "bueno",
            "amenities": ["parque", "jardin"],
            "floorNumber": None,  # casa doesn't have piso
        }
        r = requests.patch(f"{API}/properties/{pid}", json=patch, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["rooms"] == 4
        assert data["toilettes"] == 1
        assert data["orientation"] == "S"
        assert data["condition"] == "bueno"
        assert sorted(data["amenities"]) == ["jardin", "parque"]
        assert data["floorNumber"] is None
