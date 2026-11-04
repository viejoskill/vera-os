# Tests for Equipamiento % (5 / 7.5 / 10) in manual and public tasador (iteration 82)
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api/tasacion"

CASA = {"tipo": "casa", "zona": "av2", "cubiertos": 100, "lote": 300,
        "calidad": "estandar", "estado": "bueno", "antiguedad": "hasta10"}


@pytest.fixture(scope="module")
def s():
    return requests.Session()


def _calc(s, **extra):
    r = s.post(f"{API}/calcular", json={**CASA, **extra})
    assert r.status_code == 200, r.text
    return r.json()


# Manual: equipamiento multiplies precioBase
@pytest.mark.parametrize("val,pct", [("5", 0.05), ("7.5", 0.075), ("10", 0.10)])
def test_equipamiento_variants(s, val, pct):
    base = _calc(s)
    eq = _calc(s, equipamiento=val)
    assert base["precioBase"] > 0
    ratio = eq["precioBase"] / base["precioBase"]
    assert abs(ratio - (1 + pct)) < 0.002, ratio
    assert eq["cierreMax"] > base["cierreMax"]
    assert any("Equipamiento" in b["paso"] for b in eq["breakdown"])


def test_equipamiento_empty_and_null_same_as_none(s):
    base = _calc(s)
    assert _calc(s, equipamiento="")["precioBase"] == base["precioBase"]
    assert _calc(s, equipamiento=None)["precioBase"] == base["precioBase"]


def test_equipamiento_invalid_value_ignored(s):
    base = _calc(s)
    assert _calc(s, equipamiento="99")["precioBase"] == base["precioBase"]


def test_equipamiento_no_effect_on_lote(s):
    body = {"tipo": "lote", "zona": "av2", "lote": 500}
    a = s.post(f"{API}/calcular", json=body).json()
    b = s.post(f"{API}/calcular", json={**body, "equipamiento": "10"}).json()
    assert a["precioBase"] == b["precioBase"]
    assert a["cierreMin"] == b["cierreMin"]


def test_jpg_accepts_equipamiento(s):
    r = s.post(f"{API}/jpg", json={**CASA, "equipamiento": "10"})
    assert r.status_code == 200
    body = r.json()
    assert body["image"].startswith("data:image/jpeg;base64,")
    base = _calc(s)
    assert body["result"]["precioBase"] > base["precioBase"]


# Public tasador
def test_public_estimar_equipamiento(s):
    pub = {**CASA, "nombre": "", "telefono": "", "email": ""}
    a = s.post(f"{BASE_URL}/api/public/tasacion/estimar", json=pub)
    if a.status_code == 404:
        pytest.skip("estimar route path differs")
    assert a.status_code == 200, a.text
    b = s.post(f"{BASE_URL}/api/public/tasacion/estimar", json={**pub, "equipamiento": "10"})
    assert b.status_code == 200
    a, b = a.json(), b.json()
    assert a["leadSaved"] is False
    assert b["estMax"] > a["estMax"], (a, b)


# Public tasador with an UNCALIBRATED zone (falls back to ML market pm2) - equipamiento effect
def test_public_estimar_equipamiento_uncalibrated_zone(s):
    pub = {**CASA, "zona": "centro", "nombre": "", "telefono": "", "email": ""}
    a = s.post(f"{BASE_URL}/api/public/tasacion/estimar", json=pub).json()
    b = s.post(f"{BASE_URL}/api/public/tasacion/estimar", json={**pub, "equipamiento": "10"}).json()
    print("method:", a.get("method"), a.get("estMax"), b.get("estMax"))
    if a.get("method") != "mercadolibre":
        pytest.skip("ML market not used")
    assert b["estMax"] > a["estMax"], "equipamiento ignored when public estimate uses ML market pm2"
