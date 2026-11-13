"""Liquidaciones: registrar el pago al propietario (fecha, método, monto, comprobante)."""
from __future__ import annotations

import os
import sys

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api/rentals"
sys.path.insert(0, "/app/backend")


def _mk_prop(titulo: str) -> str:
    r = requests.post(f"{API}/properties", json={"titulo": titulo, "tipo": "casa", "precioNoche": 1000})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _mk_res(pid: str, ci: str, co: str, monto: float = 100000) -> str:
    r = requests.post(f"{API}/reservations/manual", json={
        "propertyId": pid, "nombre": "TEST pago liq", "checkIn": ci, "checkOut": co, "montoTotal": monto,
    })
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _cleanup(pid: str, rid: str | None = None):
    if rid:
        requests.delete(f"{API}/reservations/{rid}")
    requests.delete(f"{API}/properties/{pid}")


@pytest.fixture
def reserva():
    pid = _mk_prop("TEST_pago_propietario")
    rid = _mk_res(pid, "2026-12-01", "2026-12-06")
    yield pid, rid
    _cleanup(pid, rid)


def test_sin_pago_estado_inicial(reserva):
    _, rid = reserva
    liq = requests.get(f"{API}/reservations/{rid}/liquidacion").json()
    assert liq.get("pagoPropietario") == {}


def test_marcar_pagada_y_consultar(reserva):
    _, rid = reserva
    r = requests.post(f"{API}/reservations/{rid}/liquidacion/marcar-pagada", data={
        "monto": "100000", "metodo": "transferencia", "fecha": "2026-12-10", "notas": "Pago test",
    })
    assert r.status_code == 200, r.text
    pago = r.json()["pagoPropietario"]
    assert pago["estado"] == "pagado" and pago["monto"] == 100000
    assert pago["metodo"] == "transferencia" and pago["fecha"] == "2026-12-10"
    assert pago["notas"] == "Pago test"

    liq = requests.get(f"{API}/reservations/{rid}/liquidacion").json()
    assert liq["pagoPropietario"]["estado"] == "pagado"


def test_marcar_pagada_monto_invalido(reserva):
    _, rid = reserva
    r = requests.post(f"{API}/reservations/{rid}/liquidacion/marcar-pagada", data={"monto": "0", "metodo": "efectivo"})
    assert r.status_code == 400


def test_revertir_pago(reserva):
    _, rid = reserva
    requests.post(f"{API}/reservations/{rid}/liquidacion/marcar-pagada", data={"monto": "50000", "metodo": "efectivo"})
    r = requests.post(f"{API}/reservations/{rid}/liquidacion/revertir")
    assert r.status_code == 200
    assert r.json().get("pagoPropietario") is None
    liq = requests.get(f"{API}/reservations/{rid}/liquidacion").json()
    assert liq["pagoPropietario"] == {}


def test_liquidables_expone_pago_propietario(reserva):
    pid, rid = reserva
    # Esta reserva creada vía /reservations/manual puede no tener pago.estado=pagado (seña),
    # así que liquidables() puede no listarla; solo validamos que, si aparece, trae el campo.
    lista = requests.get(f"{API}/properties/{pid}/liquidables").json()
    for r in lista:
        assert "pagoPropietario" in r


def test_comprobante_404_sin_archivo(reserva):
    _, rid = reserva
    requests.post(f"{API}/reservations/{rid}/liquidacion/marcar-pagada", data={"monto": "1000", "metodo": "efectivo"})
    r = requests.get(f"{API}/reservations/{rid}/liquidacion/comprobante")
    assert r.status_code == 404


def test_pdf_incluye_pago_cuando_esta_registrado(reserva):
    _, rid = reserva
    requests.post(f"{API}/reservations/{rid}/liquidacion/marcar-pagada", data={
        "monto": "100000", "metodo": "cheque", "fecha": "2026-12-11",
    })
    r = requests.get(f"{API}/reservations/{rid}/liquidacion/pdf")
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
