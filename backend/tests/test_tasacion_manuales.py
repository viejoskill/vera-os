"""Tests for the new tasacion 'manuales' history endpoints (iteration 61)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://real-estate-os-10.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api/tasacion"


@pytest.fixture
def s():
    return requests.Session()


def _count(s):
    r = s.get(f"{API}/manuales")
    assert r.status_code == 200
    return len(r.json().get("items", []))


def test_get_manuales_returns_list(s):
    r = s.get(f"{API}/manuales")
    assert r.status_code == 200
    data = r.json()
    assert "items" in data
    assert isinstance(data["items"], list)


def test_calcular_without_owner_or_address_does_not_persist(s):
    before = _count(s)
    r = s.post(f"{API}/calcular", json={
        "tipo": "lote", "zona": "premium_norte", "lote": 550
    })
    assert r.status_code == 200
    # zone premium_norte has price 0 → cierre values may be 0
    assert "cierreMin" in r.json()
    after = _count(s)
    assert after == before, f"Expected no persistence; got before={before}, after={after}"


def test_calcular_with_owner_persists(s):
    before = _count(s)
    r = s.post(f"{API}/calcular", json={
        "tipo": "lote", "zona": "premium_norte", "lote": 550,
        "propietario": "TEST_QA Persist Calc", "direccion": "TEST_QA Calle 1", "telefono": "1141812941"
    })
    assert r.status_code == 200
    after_items = s.get(f"{API}/manuales").json()["items"]
    assert len(after_items) == before + 1
    top = after_items[0]
    for k in ["id", "createdAt", "propietario", "direccion", "telefono", "tipo", "zona",
              "zonaNombre", "tipoNombre", "cierreMin", "cierreMax"]:
        assert k in top, f"Missing field {k} in manual item"
    assert top["propietario"] == "TEST_QA Persist Calc"
    assert top["direccion"] == "TEST_QA Calle 1"
    # cleanup
    dr = s.delete(f"{API}/manuales/{top['id']}")
    assert dr.status_code == 200
    assert dr.json() == {"ok": True}


def test_jpg_with_owner_persists_and_delete(s):
    before = _count(s)
    r = s.post(f"{API}/jpg", json={
        "tipo": "lote", "zona": "premium_norte", "lote": 550,
        "propietario": "TEST_Mazzochi QA", "direccion": "TEST_Mazzochi 123",
        "telefono": "1141812941"
    })
    assert r.status_code == 200
    body = r.json()
    assert "image" in body and body["image"].startswith("data:image/jpeg;base64,")
    assert "result" in body

    items = s.get(f"{API}/manuales").json()["items"]
    assert len(items) == before + 1
    match = [i for i in items if i.get("propietario") == "TEST_Mazzochi QA"]
    assert len(match) == 1
    manual_id = match[0]["id"]
    assert match[0]["direccion"] == "TEST_Mazzochi 123"
    assert match[0]["telefono"] == "1141812941"
    assert match[0]["tipoNombre"] == "Lote / Terreno"

    # DELETE
    dr = s.delete(f"{API}/manuales/{manual_id}")
    assert dr.status_code == 200
    assert dr.json() == {"ok": True}

    items_after = s.get(f"{API}/manuales").json()["items"]
    assert not any(i["id"] == manual_id for i in items_after)


def test_jpg_without_owner_or_address_does_not_persist(s):
    before = _count(s)
    r = s.post(f"{API}/jpg", json={"tipo": "lote", "zona": "premium_norte", "lote": 550})
    assert r.status_code == 200
    assert _count(s) == before


def test_direccion_only_persists(s):
    """Only direccion filled (no propietario) should still persist."""
    before = _count(s)
    r = s.post(f"{API}/calcular", json={
        "tipo": "casa", "zona": "playa", "lote": 400, "cubiertos": 100,
        "direccion": "TEST_QA Solo Direccion 999"
    })
    assert r.status_code == 200
    items = s.get(f"{API}/manuales").json()["items"]
    assert len(items) == before + 1
    match = [i for i in items if i.get("direccion") == "TEST_QA Solo Direccion 999"]
    assert match
    s.delete(f"{API}/manuales/{match[0]['id']}")
