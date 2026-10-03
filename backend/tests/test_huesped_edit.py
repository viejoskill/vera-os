"""Backend tests for PATCH /api/rentals/reservations/{rid}/huesped (partial merge)."""
import os
import pytest
import requests
from datetime import date, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/") or "http://localhost:8001"
API = f"{BASE_URL}/api/rentals"


@pytest.fixture(scope="module")
def property_id():
    r = requests.get(f"{API}/properties")
    assert r.status_code == 200, r.text
    props = r.json()
    assert len(props) > 0, "No properties available"
    return props[0]["id"]


@pytest.fixture()
def reservation(property_id):
    """Create a prereserva for test; cleanup after."""
    start = date.today() + timedelta(days=400)
    end = start + timedelta(days=3)
    body = {
        "propertyId": property_id,
        "nombre": "TEST_Huesped Original",
        "telefono": "",
        "email": "",
        "dni": "11222333",
        "huespedes": 2,
        "comentario": "test",
        "checkIn": start.isoformat(),
        "checkOut": end.isoformat(),
        "estado": "prereserva",
        "origen": "Directo",
    }
    r = requests.post(f"{API}/reservations", json=body)
    assert r.status_code in (200, 201), r.text
    rid = r.json()["id"]
    yield rid
    requests.delete(f"{API}/reservations/{rid}")


def test_patch_huesped_partial_merge(reservation):
    rid = reservation
    # Patch only telefono + email
    r = requests.patch(f"{API}/reservations/{rid}/huesped", json={
        "telefono": "+5491122334455",
        "email": "test_new@vera.test",
    })
    assert r.status_code == 200, r.text
    out = r.json()
    h = out["huesped"]
    assert h["telefono"] == "+5491122334455"
    assert h["email"] == "test_new@vera.test"
    # Untouched fields preserved
    assert h["nombre"] == "TEST_Huesped Original"
    assert h["dni"] == "11222333"
    assert h["huespedes"] == 2

    # GET verifies persistence
    r2 = requests.get(f"{API}/reservations/{rid}")
    assert r2.status_code == 200
    h2 = r2.json()["huesped"]
    assert h2["telefono"] == "+5491122334455"
    assert h2["dni"] == "11222333"


def test_patch_huesped_single_field(reservation):
    rid = reservation
    r = requests.patch(f"{API}/reservations/{rid}/huesped", json={"nombre": "TEST_Nuevo Nombre"})
    assert r.status_code == 200, r.text
    h = r.json()["huesped"]
    assert h["nombre"] == "TEST_Nuevo Nombre"
    assert h["dni"] == "11222333"  # untouched
    assert h["huespedes"] == 2


def test_patch_huesped_404():
    r = requests.patch(f"{API}/reservations/does-not-exist-xyz/huesped", json={"nombre": "x"})
    assert r.status_code == 404


def test_patch_huesped_empty_body(reservation):
    """Empty body should not fail and not clobber existing data."""
    rid = reservation
    r = requests.patch(f"{API}/reservations/{rid}/huesped", json={})
    assert r.status_code == 200, r.text
    h = r.json()["huesped"]
    assert h["nombre"] == "TEST_Huesped Original"
    assert h["dni"] == "11222333"
