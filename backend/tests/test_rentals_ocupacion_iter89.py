"""Iteration 89: extra coverage for Alquileres % ocupación (per property + cartera)."""
from __future__ import annotations

import os

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api/rentals"
FIXTURE_PID = "6744cf8a907f4a239a7504101c66a2df"


@pytest.fixture
def prop():
    pid = requests.post(f"{API}/properties", json={
        "titulo": "TEST_ocup_iter89", "tipo": "casa", "precioNoche": 1000,
    }).json()["id"]
    yield pid
    for r in requests.get(f"{API}/reservations", params={"propertyId": pid}).json():
        requests.delete(f"{API}/reservations/{r['id']}")
    requests.delete(f"{API}/properties/{pid}")


def _manual(pid, ci, co, nombre="TEST_res"):
    r = requests.post(f"{API}/reservations/manual", json={
        "propertyId": pid, "nombre": nombre, "checkIn": ci, "checkOut": co, "montoTotal": 1000,
    })
    assert r.status_code in (200, 201), r.text
    return r.json()


def _ocup(pid, desde, hasta):
    r = requests.get(f"{API}/properties/{pid}/ocupacion", params={"desde": desde, "hasta": hasta})
    assert r.status_code == 200, r.text
    return {m["mes"]: m for m in r.json()["meses"]}


# Case a: 10 confirmed + 5 blocked in 30-day month
def test_case_a(prop):
    _manual(prop, "2026-09-01", "2026-09-11")
    b = requests.post(f"{API}/blocks", json={"propertyId": prop, "checkIn": "2026-09-20", "checkOut": "2026-09-25"})
    assert b.status_code in (200, 201), b.text
    m = _ocup(prop, "2026-09", "2026-09")["2026-09"]
    assert (m["ocupadas"], m["disponibles"], m["pct"]) == (10, 25, 40.0)


# Block crossing month boundary splits correctly
def test_block_crossing_month(prop):
    requests.post(f"{API}/blocks", json={"propertyId": prop, "checkIn": "2027-01-28", "checkOut": "2027-02-03"})
    d = _ocup(prop, "2027-01", "2027-02")
    assert d["2027-01"]["disponibles"] == 31 - 4
    assert d["2027-02"]["disponibles"] == 28 - 2


# Leap-year Feb
def test_leap_feb(prop):
    d = _ocup(prop, "2028-02", "2028-02")
    assert d["2028-02"]["disponibles"] == 29


# Year-long range returns 12 months, ordered
def test_year_range(prop):
    r = requests.get(f"{API}/properties/{prop}/ocupacion", params={"desde": "2026-01", "hasta": "2026-12"})
    meses = [m["mes"] for m in r.json()["meses"]]
    assert meses == [f"2026-{i:02d}" for i in range(1, 13)]


# Cancelled reservation should not count
def test_cancelled_not_counted(prop):
    res = _manual(prop, "2026-10-01", "2026-10-06")
    p = requests.patch(f"{API}/reservations/{res['id']}", json={"estado": "cancelada"})
    assert p.status_code == 200, p.text
    assert _ocup(prop, "2026-10", "2026-10")["2026-10"]["ocupadas"] == 0


# finalizada / encurso count
@pytest.mark.parametrize("estado", ["encurso", "finalizada"])
def test_other_states_count(prop, estado):
    res = _manual(prop, "2026-10-01", "2026-10-04")
    p = requests.patch(f"{API}/reservations/{res['id']}", json={"estado": estado})
    assert p.status_code == 200, p.text
    assert _ocup(prop, "2026-10", "2026-10")["2026-10"]["ocupadas"] == 3


# Fully blocked month: disponibles 0 -> pct 0 (no div by zero)
def test_fully_blocked(prop):
    requests.post(f"{API}/blocks", json={"propertyId": prop, "checkIn": "2026-06-01", "checkOut": "2026-07-01"})
    m = _ocup(prop, "2026-06", "2026-06")["2026-06"]
    assert m["disponibles"] == 0 and m["pct"] == 0.0


def test_unknown_property_404():
    r = requests.get(f"{API}/properties/nonexistent_xyz/ocupacion", params={"desde": "2026-01", "hasta": "2026-01"})
    assert r.status_code == 404


def test_missing_params_422(prop):
    r = requests.get(f"{API}/properties/{prop}/ocupacion")
    assert r.status_code == 422


# Malformed input should be a 4xx, not 500
@pytest.mark.parametrize("desde,hasta", [("abc", "2026-01"), ("2026-13", "2026-13"), ("2026-00", "2026-01")])
def test_malformed_params_not_500(prop, desde, hasta):
    r = requests.get(f"{API}/properties/{prop}/ocupacion", params={"desde": desde, "hasta": hasta})
    assert r.status_code < 500, f"{desde}/{hasta} -> {r.status_code}"
    r2 = requests.get(f"{API}/ocupacion", params={"desde": desde, "hasta": hasta})
    assert r2.status_code < 500, f"general {desde}/{hasta} -> {r2.status_code}"


# General = sum over properties; fixture per-property consistent with dedicated endpoint
def test_general_consistency():
    g = requests.get(f"{API}/ocupacion", params={"desde": "2026-01", "hasta": "2026-12"})
    assert g.status_code == 200
    d = g.json()
    for i, row in enumerate(d["general"]):
        occ = sum(p["meses"][i]["ocupadas"] for p in d["propiedades"])
        disp = sum(p["meses"][i]["disponibles"] for p in d["propiedades"])
        assert row["ocupadas"] == occ and row["disponibles"] == disp
    fx = next(p for p in d["propiedades"] if p["propertyId"] == FIXTURE_PID)
    own = requests.get(f"{API}/properties/{FIXTURE_PID}/ocupacion", params={"desde": "2026-01", "hasta": "2026-12"}).json()
    assert fx["meses"] == own["meses"]
    assert fx["codigo"] == "A161"
    print("fixture 2026:", [m["pct"] for m in own["meses"]])
