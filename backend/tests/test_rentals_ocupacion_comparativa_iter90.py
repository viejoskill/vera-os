"""Alquileres iter90: edge cases de la comparación de ocupación vs año anterior (testing agent)."""
from __future__ import annotations

import asyncio
import os
import sys

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api/rentals"
sys.path.insert(0, "/app/backend")


def _set_created(pid: str, created: str):
    import config as appconfig
    from motor.motor_asyncio import AsyncIOMotorClient

    async def _go():
        c = AsyncIOMotorClient(appconfig.MONGO_URL)
        await c[appconfig.DB_NAME]["rental_properties"].update_one({"_id": pid}, {"$set": {"createdAt": created}})
        c.close()
    asyncio.new_event_loop().run_until_complete(_go())


def _mk(titulo: str, created: str | None = None) -> str:
    r = requests.post(f"{API}/properties", json={"titulo": titulo, "tipo": "casa", "precioNoche": 1000})
    assert r.status_code == 201
    pid = r.json()["id"]
    if created:
        _set_created(pid, created)
    return pid


def _cleanup(pid: str):
    for r in requests.get(f"{API}/reservations", params={"propertyId": pid}).json():
        requests.delete(f"{API}/reservations/{r['id']}")
    requests.delete(f"{API}/properties/{pid}")


def _res(pid, ci, co, **kw):
    r = requests.post(f"{API}/reservations/manual", json={"propertyId": pid, "nombre": "TEST", "checkIn": ci, "checkOut": co, "montoTotal": 1000, **kw})
    assert r.status_code == 201, r.text
    return r.json()


@pytest.fixture
def created():
    ids: list[str] = []
    yield ids
    for pid in ids:
        _cleanup(pid)


# Variación negativa / cero / bloqueo en año anterior
class TestPropiedadComparativa:
    def test_variacion_negativa(self, created):
        pid = _mk("TEST_ocup90_neg", "2020-01-01T00:00:00+00:00"); created.append(pid)
        _res(pid, "2025-11-01", "2025-11-16")  # 15/30 = 50
        _res(pid, "2026-11-01", "2026-11-04")  # 3/30 = 10
        m = requests.get(f"{API}/properties/{pid}/ocupacion", params={"desde": "2026-11", "hasta": "2026-11"}).json()["meses"][0]
        assert m["pct"] == 10.0 and m["pctAnterior"] == 50.0 and m["variacion"] == -40.0

    def test_variacion_cero_y_mes_vacio(self, created):
        pid = _mk("TEST_ocup90_zero", "2020-01-01T00:00:00+00:00"); created.append(pid)
        _res(pid, "2025-10-01", "2025-10-06")
        _res(pid, "2026-10-01", "2026-10-06")
        ms = requests.get(f"{API}/properties/{pid}/ocupacion", params={"desde": "2026-09", "hasta": "2026-10"}).json()["meses"]
        assert ms[0]["mes"] == "2026-09" and ms[0]["variacion"] == 0.0 and ms[0]["pctAnterior"] == 0.0
        assert ms[1]["variacion"] == 0.0 and ms[1]["pctAnterior"] == 16.1

    def test_bloqueo_anio_anterior_reduce_denominador(self, created):
        pid = _mk("TEST_ocup90_blk", "2020-01-01T00:00:00+00:00"); created.append(pid)
        b = requests.post(f"{API}/blocks", json={"propertyId": pid, "checkIn": "2025-11-16", "checkOut": "2025-12-01", "motivo": "TEST"})
        assert b.status_code == 201, b.text
        _res(pid, "2025-11-01", "2025-11-06")  # 5/15
        m = requests.get(f"{API}/properties/{pid}/ocupacion", params={"desde": "2026-11", "hasta": "2026-11"}).json()["meses"][0]
        assert m["disponiblesAnterior"] == 15 and m["pctAnterior"] == 33.3 and m["variacion"] == -33.3

    def test_rango_cruza_anio_y_limite_createdat(self, created):
        # createdAt 2025-03 → mes previo 2025-02 null, 2025-03 en adelante con dato
        pid = _mk("TEST_ocup90_edge", "2025-03-10T00:00:00+00:00"); created.append(pid)
        ms = requests.get(f"{API}/properties/{pid}/ocupacion", params={"desde": "2026-02", "hasta": "2026-03"}).json()["meses"]
        assert ms[0]["pctAnterior"] is None and ms[0]["variacion"] is None
        assert ms[1]["pctAnterior"] == 0.0 and ms[1]["variacion"] == 0.0

    def test_dic_ene_cruce(self, created):
        pid = _mk("TEST_ocup90_dic", "2020-01-01T00:00:00+00:00"); created.append(pid)
        _res(pid, "2025-12-30", "2026-01-03")  # dic25: 2, ene26: 2
        ms = requests.get(f"{API}/properties/{pid}/ocupacion", params={"desde": "2026-12", "hasta": "2027-01"}).json()["meses"]
        assert [m["mes"] for m in ms] == ["2026-12", "2027-01"]
        assert ms[0]["pctAnterior"] == 6.5 and ms[1]["pctAnterior"] == 6.5

    def test_invalid_dates_still_400(self):
        r = requests.get(f"{API}/ocupacion", params={"desde": "2026-13", "hasta": "2026-12"})
        assert r.status_code == 400


# General: agregación solo de las propiedades comparables
class TestGeneralComparativa:
    def test_general_agrega_y_excluye_nuevas(self, created):
        vieja = _mk("TEST_ocup90_gen_old", "2020-01-01T00:00:00+00:00"); created.append(vieja)
        nueva = _mk("TEST_ocup90_gen_new"); created.append(nueva)
        base = requests.get(f"{API}/ocupacion", params={"desde": "2026-11", "hasta": "2026-11"}).json()
        _res(vieja, "2025-11-01", "2025-11-07")  # 6 noches año anterior
        _res(vieja, "2026-11-01", "2026-11-04")
        _res(nueva, "2026-11-01", "2026-11-21")
        d = requests.get(f"{API}/ocupacion", params={"desde": "2026-11", "hasta": "2026-11"}).json()
        g = d["general"][0]
        p_nueva = next(p for p in d["propiedades"] if p["propertyId"] == nueva)["meses"][0]
        p_vieja = next(p for p in d["propiedades"] if p["propertyId"] == vieja)["meses"][0]
        assert p_nueva["pctAnterior"] is None and p_nueva["variacion"] is None
        assert p_vieja["pctAnterior"] == 20.0 and p_vieja["variacion"] == -10.0
        assert g["ocupadas"] == base["general"][0]["ocupadas"] + 23
        assert g["pctAnterior"] is not None
        # La variación general es like-for-like: solo "vieja" es comparable, así que debe
        # coincidir exactamente con su propia variación (-10.0), sin mezclarse con "nueva".
        assert g["variacion"] == -10.0
        print("GENERAL", g, "BASE", base["general"][0])
