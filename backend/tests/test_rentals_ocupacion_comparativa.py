"""Alquileres: comparación de % de ocupación vs el mismo mes del año anterior (iteration 90)."""
from __future__ import annotations

import os

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api/rentals"


@pytest.fixture
def prop_vieja(mongo_rental_properties=None):
    """Propiedad con createdAt antiguo, para poder comparar contra el año anterior."""
    import asyncio
    import sys
    sys.path.insert(0, "/app/backend")
    import config as appconfig
    from motor.motor_asyncio import AsyncIOMotorClient

    pid = requests.post(f"{API}/properties", json={
        "titulo": "TEST_ocup_comparativa_pytest", "tipo": "casa", "precioNoche": 1000,
    }).json()["id"]

    async def _age():
        client = AsyncIOMotorClient(appconfig.MONGO_URL)
        db = client[appconfig.DB_NAME]
        await db["rental_properties"].update_one({"_id": pid}, {"$set": {"createdAt": "2020-01-01T00:00:00+00:00"}})
        client.close()
    asyncio.get_event_loop().run_until_complete(_age())

    yield pid
    for r in requests.get(f"{API}/reservations", params={"propertyId": pid}).json():
        requests.delete(f"{API}/reservations/{r['id']}")
    requests.delete(f"{API}/properties/{pid}")


@pytest.fixture
def prop_nueva():
    pid = requests.post(f"{API}/properties", json={
        "titulo": "TEST_ocup_nueva_pytest", "tipo": "casa", "precioNoche": 1000,
    }).json()["id"]
    yield pid
    for r in requests.get(f"{API}/reservations", params={"propertyId": pid}).json():
        requests.delete(f"{API}/reservations/{r['id']}")
    requests.delete(f"{API}/properties/{pid}")


def test_variacion_vs_anio_anterior(prop_vieja):
    requests.post(f"{API}/reservations/manual", json={
        "propertyId": prop_vieja, "nombre": "T1", "checkIn": "2025-11-01", "checkOut": "2025-11-06", "montoTotal": 5000,
    })
    requests.post(f"{API}/reservations/manual", json={
        "propertyId": prop_vieja, "nombre": "T2", "checkIn": "2026-11-01", "checkOut": "2026-11-11", "montoTotal": 10000,
    })
    r = requests.get(f"{API}/properties/{prop_vieja}/ocupacion", params={"desde": "2026-11", "hasta": "2026-11"})
    mes = r.json()["meses"][0]
    assert mes["pct"] == 33.3
    assert mes["pctAnterior"] == 16.7
    assert mes["variacion"] == 16.6


def test_sin_datos_antes_de_createdat_da_none(prop_nueva):
    """Una propiedad recién creada no tiene con qué comparar el año pasado: None, no 0%."""
    requests.post(f"{API}/reservations/manual", json={
        "propertyId": prop_nueva, "nombre": "T", "checkIn": "2026-11-01", "checkOut": "2026-11-06", "montoTotal": 5000,
    })
    r = requests.get(f"{API}/properties/{prop_nueva}/ocupacion", params={"desde": "2026-11", "hasta": "2026-11"})
    mes = r.json()["meses"][0]
    assert mes["pctAnterior"] is None
    assert mes["variacion"] is None


def test_ocupacion_general_incluye_variacion(prop_vieja):
    requests.post(f"{API}/reservations/manual", json={
        "propertyId": prop_vieja, "nombre": "T", "checkIn": "2026-11-01", "checkOut": "2026-11-06", "montoTotal": 5000,
    })
    r = requests.get(f"{API}/ocupacion", params={"desde": "2026-11", "hasta": "2026-11"})
    assert r.status_code == 200
    general = r.json()["general"][0]
    assert "pctAnterior" in general and "variacion" in general
