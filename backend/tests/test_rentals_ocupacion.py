"""Alquileres: % de ocupación mensual, por propiedad y de toda la cartera (iteration 89).

Definición: ocupadas = noches con reserva en estado confirmada/encurso/finalizada (las
pre-reservas no cuentan, no están garantizadas). disponibles = noches del mes menos las
noches bloqueadas (bloqueo = la propiedad no está en oferta esos días, no debe penalizar
el % como si estuviera "libre y sin alquilar"). pct = ocupadas/disponibles*100.
"""
from __future__ import annotations

import os

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api/rentals"


@pytest.fixture
def prop():
    pid = requests.post(f"{API}/properties", json={
        "titulo": "TEST_ocupacion_pytest", "tipo": "casa", "precioNoche": 1000,
    }).json()["id"]
    yield pid
    for r in requests.get(f"{API}/reservations", params={"propertyId": pid}).json():
        requests.delete(f"{API}/reservations/{r['id']}")
    requests.delete(f"{API}/properties/{pid}")


def test_ocupacion_propiedad_con_reserva_y_bloqueo(prop):
    requests.post(f"{API}/reservations/manual", json={
        "propertyId": prop, "nombre": "Test Ocup", "checkIn": "2026-11-01", "checkOut": "2026-11-11",
        "montoTotal": 10000,
    })
    requests.post(f"{API}/blocks", json={"propertyId": prop, "checkIn": "2026-11-20", "checkOut": "2026-11-25"})

    r = requests.get(f"{API}/properties/{prop}/ocupacion", params={"desde": "2026-11", "hasta": "2026-11"})
    assert r.status_code == 200, r.text
    mes = r.json()["meses"][0]
    assert mes["mes"] == "2026-11"
    assert mes["ocupadas"] == 10  # 10 noches de la reserva confirmada
    assert mes["disponibles"] == 25  # 30 días de noviembre - 5 bloqueadas
    assert mes["pct"] == 40.0


def test_ocupacion_sin_nada_da_cero(prop):
    r = requests.get(f"{API}/properties/{prop}/ocupacion", params={"desde": "2027-05", "hasta": "2027-05"})
    mes = r.json()["meses"][0]
    assert mes["ocupadas"] == 0
    assert mes["disponibles"] == 31  # mayo tiene 31 días, sin bloqueos
    assert mes["pct"] == 0.0


def test_prereserva_no_cuenta_como_ocupada(prop):
    """Una pre-reserva (sin confirmar) no debe sumar a 'ocupadas': no está garantizada."""
    pre = requests.post(f"{API}/reservations/manual", json={
        "propertyId": prop, "nombre": "Test Pre", "checkIn": "2026-11-01", "checkOut": "2026-11-05",
        "montoTotal": 4000,
    }).json()
    requests.patch(f"{API}/reservations/{pre['id']}", json={"estado": "prereserva"})

    r = requests.get(f"{API}/properties/{prop}/ocupacion", params={"desde": "2026-11", "hasta": "2026-11"})
    mes = r.json()["meses"][0]
    assert mes["ocupadas"] == 0
    assert mes["disponibles"] == 30  # una prereserva no bloquea disponibilidad tampoco


def test_meses_multiples_en_rango(prop):
    requests.post(f"{API}/reservations/manual", json={
        "propertyId": prop, "nombre": "Test Dic", "checkIn": "2026-12-25", "checkOut": "2027-01-05",
        "montoTotal": 11000,
    })
    r = requests.get(f"{API}/properties/{prop}/ocupacion", params={"desde": "2026-12", "hasta": "2027-01"})
    meses = {m["mes"]: m for m in r.json()["meses"]}
    assert meses["2026-12"]["ocupadas"] == 7  # 25,26,27,28,29,30,31 -> 7 noches en diciembre
    assert meses["2027-01"]["ocupadas"] == 4  # 1,2,3,4 -> checkOut 5 exclusive


def test_ocupacion_general_agrega_la_propiedad_de_test(prop):
    requests.post(f"{API}/reservations/manual", json={
        "propertyId": prop, "nombre": "Test General", "checkIn": "2026-11-01", "checkOut": "2026-11-06",
        "montoTotal": 5000,
    })
    r = requests.get(f"{API}/ocupacion", params={"desde": "2026-11", "hasta": "2026-11"})
    assert r.status_code == 200, r.text
    d = r.json()
    assert len(d["general"]) == 1 and d["general"][0]["mes"] == "2026-11"
    detalle = next(p for p in d["propiedades"] if p["propertyId"] == prop)
    assert detalle["meses"][0]["ocupadas"] == 5
    # el total general debe ser AL MENOS lo que aporta esta propiedad
    assert d["general"][0]["ocupadas"] >= 5
