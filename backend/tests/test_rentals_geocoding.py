"""Backend tests for rental auto-geocoding feature (iteration_69).

Scope:
- PUT /api/rentals/properties/{id} with `direccion` + null lat/lng auto-geocodes.
- POST /api/rentals/properties/geocode-pendientes backfills legacy docs
  (simulated by setting latitude=None directly in Mongo).
- POST /api/rentals/properties auto-geocodes on creation.
- A161 (shared test property) is left clean at the end.
"""
from __future__ import annotations

import asyncio
import os
import time

import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://real-estate-os-10.preview.emergentagent.com").rstrip("/")
A161_ID = "6744cf8a907f4a239a7504101c66a2df"

# Mongo direct access (needed to simulate legacy state for backfill test)
import sys
sys.path.insert(0, "/app/backend")
import config as appconfig  # noqa: E402


@pytest.fixture(scope="module")
def mongo():
    client = AsyncIOMotorClient(appconfig.MONGO_URL)
    yield client[appconfig.DB_NAME]
    client.close()


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


def _get_a161_full() -> dict:
    r = requests.get(f"{BASE_URL}/api/rentals/properties/{A161_ID}", timeout=20)
    r.raise_for_status()
    return r.json()


def _put_a161(body: dict) -> dict:
    r = requests.put(f"{BASE_URL}/api/rentals/properties/{A161_ID}", json=body, timeout=30)
    r.raise_for_status()
    return r.json()


def _body_from(doc: dict, **overrides) -> dict:
    """Build a valid PropertyBody payload from a GET response, applying overrides."""
    allowed = {
        "titulo", "tipo", "direccion", "localidad", "descripcion", "capacidad",
        "dormitorios", "banos", "amenities", "moneda", "precioNoche", "descSemana",
        "descQuincena", "descMes", "descSemanaMin", "descQuincenaMin", "descMesMin",
        "activa", "comisionPct", "comisionMinima", "notas", "propietario",
        "ropaBlanca", "aceptaMascotas", "depositoGarantia", "penalidadDiaria",
        "limpieza", "checkInHora", "checkOutHora", "estadiaMinima", "condiciones",
        "numeroLlave", "reelUrl", "latitude", "longitude",
    }
    body = {k: doc.get(k) for k in allowed if k in doc}
    body.setdefault("titulo", "CASA DE PRUEBA — Costa del Este (borrar)")
    body.update(overrides)
    return body


# ---------------------------------------------------------------- Test 1
def test_put_autogeocodes_a161(mongo):
    """PUT with direccion set and latitude=null -> response has lat/lng populated."""
    doc = _get_a161_full()
    body = _body_from(doc, direccion="Claveles 368", localidad="Costa del Este",
                      latitude=None, longitude=None)
    resp = _put_a161(body)
    assert resp.get("direccion") == "Claveles 368"
    assert resp.get("latitude") is not None, f"Expected auto-geocoded latitude, got {resp}"
    assert resp.get("longitude") is not None
    assert isinstance(resp["latitude"], (int, float))
    assert isinstance(resp["longitude"], (int, float))
    # Costa del Este is around lat -36.6, lng -56.7
    assert -37.5 < resp["latitude"] < -35.5, f"lat out of expected range: {resp['latitude']}"
    assert -57.5 < resp["longitude"] < -55.5, f"lng out of expected range: {resp['longitude']}"

    # Verify persistence
    time.sleep(0.3)
    fetched = _get_a161_full()
    assert fetched["latitude"] == resp["latitude"]
    assert fetched["longitude"] == resp["longitude"]


# ---------------------------------------------------------------- Test 2
def test_backfill_geocode_pendientes(mongo):
    """Simulate legacy state (direccion set, latitude=None in Mongo directly),
    then call backfill endpoint and verify A161 gets coordinates."""
    # Force legacy state in Mongo bypassing PUT
    async def _reset_to_legacy():
        await mongo["rental_properties"].update_one(
            {"_id": A161_ID},
            {"$set": {"direccion": "Av. Interbalnearia 568", "latitude": None, "longitude": None}},
        )
    _run(_reset_to_legacy())

    # Confirm legacy state via API
    pre = _get_a161_full()
    assert pre["direccion"] == "Av. Interbalnearia 568"
    assert pre["latitude"] is None
    assert pre["longitude"] is None

    # Call backfill endpoint
    r = requests.post(f"{BASE_URL}/api/rentals/properties/geocode-pendientes", timeout=180)
    assert r.status_code == 200, f"Backfill failed: {r.status_code} {r.text}"
    data = r.json()
    assert "updated" in data and "failed" in data
    assert isinstance(data["updated"], list)
    assert isinstance(data["failed"], list)
    # A161 should be in `updated` (by codigo "A161" or _id)
    found = ("A161" in data["updated"]) or (A161_ID in data["updated"])
    assert found, f"A161 not found in backfill updated list: {data}"

    # Verify A161 now has coords
    post = _get_a161_full()
    assert post["latitude"] is not None, "A161 still has null latitude after backfill"
    assert post["longitude"] is not None
    assert -37.5 < post["latitude"] < -35.5
    assert -57.5 < post["longitude"] < -55.5


# ---------------------------------------------------------------- Test 3
def test_create_property_autogeocodes_then_delete():
    """POST a new property with direccion but no coords -> response has coords. Delete after."""
    payload = {
        "titulo": "TEST BORRAR regresion geocoding",
        "tipo": "casa",
        "direccion": "Av. 3 1218",
        "localidad": "Costa del Este",
    }
    r = requests.post(f"{BASE_URL}/api/rentals/properties", json=payload, timeout=30)
    assert r.status_code == 201, f"Create failed: {r.status_code} {r.text}"
    created = r.json()
    new_id = created.get("id") or created.get("_id")
    try:
        assert created.get("latitude") is not None, f"Create did not auto-geocode: {created}"
        assert created.get("longitude") is not None
        assert -37.5 < created["latitude"] < -35.5
        assert -57.5 < created["longitude"] < -55.5
    finally:
        d = requests.delete(f"{BASE_URL}/api/rentals/properties/{new_id}", timeout=20)
        assert d.status_code in (200, 204), f"Delete failed: {d.status_code} {d.text}"
        # Verify gone
        g = requests.get(f"{BASE_URL}/api/rentals/properties/{new_id}", timeout=20)
        assert g.status_code == 404


# ---------------------------------------------------------------- Cleanup
def test_zz_cleanup_a161():
    """Leave A161 in its clean baseline state: direccion='', lat/lng=null."""
    doc = _get_a161_full()
    body = _body_from(doc, direccion="", latitude=None, longitude=None)
    resp = _put_a161(body)
    # When direccion is empty, backend MUST NOT geocode, so lat/lng stay null
    assert resp.get("direccion") in (None, "")
    assert resp.get("latitude") is None, f"A161 cleanup failed, latitude still {resp.get('latitude')}"
    assert resp.get("longitude") is None, f"A161 cleanup failed, longitude still {resp.get('longitude')}"

    # Confirm via GET
    fetched = _get_a161_full()
    assert fetched.get("direccion") in (None, "")
    assert fetched.get("latitude") is None
    assert fetched.get("longitude") is None
