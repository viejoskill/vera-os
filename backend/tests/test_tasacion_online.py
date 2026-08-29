"""Tests for Tasador Online público (semáforo)."""
import os
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else None
if not BASE_URL:
    # fallback for backend tests: read from frontend .env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL"):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

CASA_PAYLOAD = {
    "tipo": "casa",
    "zona": "costanera",
    "cubiertos": 100,
    "lote": 300,
    "calidad": "estandar",
    "estado": "bueno",
    "antiguedad": "hasta10",
    "gas": True,
    "cloacas": True,
    "nombre": "TEST_Visitante",
    "telefono": "2257000000",
}

LOTE_PAYLOAD = {
    "tipo": "lote",
    "zona": "costanera",
    "lote": 500,
    "nombre": "TEST_Lote",
    "telefono": "2257000001",
}


def _validate_structure(data):
    for key in ["mktMin", "mktMax", "base", "semaforo", "method", "tipoNombre",
                "zonaNombre", "area", "market", "estMin", "estMax"]:
        assert key in data, f"Missing key {key} in response: {data}"
    assert data["method"] in ("mercadolibre", "varela")
    assert data["mktMin"] < data["mktMax"], f"mktMin ({data['mktMin']}) should be < mktMax ({data['mktMax']})"
    # Compat
    assert data["estMin"] == data["mktMin"]
    assert data["estMax"] == data["mktMax"]
    # Semáforo
    sem = data["semaforo"]
    assert isinstance(sem, list) and len(sem) == 3
    niveles = [s["nivel"] for s in sem]
    assert niveles == ["verde", "amarillo", "rojo"]
    ajustes = {s["nivel"]: s["ajuste"] for s in sem}
    assert ajustes["verde"] == -0.12
    assert ajustes["amarillo"] == -0.07
    assert ajustes["rojo"] == 0.0
    valores = {s["nivel"]: s["valor"] for s in sem}
    assert valores["verde"] < valores["amarillo"] < valores["rojo"], f"Ordering incorrect: {valores}"
    assert valores["rojo"] == data["base"], f"Rojo ({valores['rojo']}) should equal base ({data['base']})"
    # Market struct
    m = data["market"]
    for k in ["available", "count", "medianPm2"]:
        assert k in m


def test_estimar_casa_structure():
    r = requests.post(f"{BASE_URL}/api/public/tasacion/estimar", json=CASA_PAYLOAD, timeout=60)
    assert r.status_code == 200, r.text
    data = r.json()
    _validate_structure(data)
    assert "leadSaved" in data
    assert data["area"] == 100


def test_simular_no_lead_and_flag():
    r = requests.post(f"{BASE_URL}/api/public/tasacion/simular", json=CASA_PAYLOAD, timeout=60)
    assert r.status_code == 200, r.text
    data = r.json()
    _validate_structure(data)
    assert data.get("simulado") is True
    assert data.get("leadSaved") is False


def test_estimar_lote_uses_lote_area():
    r = requests.post(f"{BASE_URL}/api/public/tasacion/estimar", json=LOTE_PAYLOAD, timeout=60)
    assert r.status_code == 200, r.text
    data = r.json()
    _validate_structure(data)
    assert data["area"] == 500


def test_get_mercado_structure():
    r = requests.get(f"{BASE_URL}/api/public/tasacion/mercado", params={"tipo": "casa"}, timeout=90)
    assert r.status_code == 200, r.text
    data = r.json()
    for k in ["available", "count", "medianPm2"]:
        assert k in data
    assert isinstance(data["available"], bool)
    assert isinstance(data["count"], int)
