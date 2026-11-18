"""Iter 100 — edge cases for: owner payment with gross amount + automatic commission
retention (montoBruto / descuentaComision), and the PDF of 'Liquidación al propietario'
no longer exposing the guest's phone/DNI (only the name)."""
from __future__ import annotations

import io
import os

import pytest
import requests
from pypdf import PdfReader

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api/rentals"
PHONE = "2257-998877"
DNI = "31987654"


def _pdf_text(content: bytes) -> str:
    return "\n".join(p.extract_text() or "" for p in PdfReader(io.BytesIO(content)).pages)


def _mk_prop(titulo: str, comision_pct: float = 18) -> str:
    r = requests.post(f"{API}/properties", json={"titulo": titulo, "tipo": "casa", "precioNoche": 1000, "comisionPct": comision_pct})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _mk_res(pid: str, monto, ci="2027-01-10", co="2027-01-15", confirmar=True) -> str:
    body = {"propertyId": pid, "nombre": "TEST_Huesped PII", "telefono": PHONE, "dni": DNI,
            "checkIn": ci, "checkOut": co}
    if monto is not None:
        body["montoTotal"] = monto
    r = requests.post(f"{API}/reservations/manual", json=body)
    assert r.status_code == 201, r.text
    rid = r.json()["id"]
    if confirmar:
        s = requests.patch(f"{API}/reservations/{rid}", json={"estado": "confirmada"})
        assert s.status_code == 200, s.text
    return rid


@pytest.fixture
def res_pii():
    pid = _mk_prop("TEST_iter100_pii", 18)
    rid = _mk_res(pid, 500000)
    yield pid, rid
    requests.delete(f"{API}/reservations/{rid}")
    requests.delete(f"{API}/properties/{pid}")


# --- PDF: guest phone/DNI removed ---
def test_reserva_pdf_sin_telefono_ni_dni(res_pii):
    _, rid = res_pii
    r = requests.get(f"{API}/reservations/{rid}/liquidacion/pdf")
    assert r.status_code == 200 and r.headers["content-type"].startswith("application/pdf")
    txt = _pdf_text(r.content)
    assert "TEST_Huesped PII" in txt
    assert PHONE not in txt and DNI not in txt and "DNI" not in txt


def test_periodo_pdf_sin_telefono_ni_dni(res_pii):
    pid, _ = res_pii
    r = requests.get(f"{API}/liquidacion/pdf", params={"propertyId": pid, "desde": "2027-01-01", "hasta": "2027-01-31"})
    assert r.status_code == 200, r.text
    txt = _pdf_text(r.content)
    assert PHONE not in txt and DNI not in txt


def test_liquidacion_json_aun_trae_huesped_completo(res_pii):
    """The JSON detail still has the guest data (only the PDF hides it)."""
    _, rid = res_pii
    liq = requests.get(f"{API}/reservations/{rid}/liquidacion").json()
    assert liq["huesped"]["nombre"] == "TEST_Huesped PII"


# --- commission retention edge cases ---
def test_descuenta_comision_default_true(res_pii):
    _, rid = res_pii
    r = requests.post(f"{API}/reservations/{rid}/liquidacion/pagos", data={"montoBruto": "100000", "metodo": "efectivo"})
    assert r.status_code == 200, r.text
    p = r.json()["pagosPropietario"][0]
    assert p["descuentaComision"] is True and p["comisionRetenida"] == 18000 and p["monto"] == 82000


def test_pago_completo_marca_pagado_y_pdf_completo(res_pii):
    _, rid = res_pii
    r = requests.post(f"{API}/reservations/{rid}/liquidacion/pagos",
                      data={"montoBruto": "500000", "descuentaComision": "true", "metodo": "transferencia"})
    assert r.status_code == 200
    liq = requests.get(f"{API}/reservations/{rid}/liquidacion").json()
    assert liq["netoPropietario"] == 410000
    assert liq["totalPagadoPropietario"] == 410000 and liq["saldoLiquidacion"] == 0
    assert liq["estadoLiquidacion"] == "pagado" and liq["comisionPendiente"] == 0
    txt = _pdf_text(requests.get(f"{API}/reservations/{rid}/liquidacion/pdf").content)
    assert "Liquidación completa" in txt and "410.000" in txt


def test_sobrepago_aceptado_reporta(res_pii):
    """Records what happens on overpayment (gross > rent). Saldo clamps to 0."""
    _, rid = res_pii
    r = requests.post(f"{API}/reservations/{rid}/liquidacion/pagos",
                      data={"montoBruto": "900000", "descuentaComision": "true", "metodo": "transferencia"})
    assert r.status_code in (200, 400)
    if r.status_code == 200:
        liq = requests.get(f"{API}/reservations/{rid}/liquidacion").json()
        assert liq["comisionRetenida"] <= liq["comision"]
        assert liq["saldoLiquidacion"] == 0


def test_metodo_invalido_400(res_pii):
    _, rid = res_pii
    r = requests.post(f"{API}/reservations/{rid}/liquidacion/pagos", data={"montoBruto": "1000", "metodo": "bitcoin"})
    assert r.status_code == 400


def test_reserva_inexistente_404():
    r = requests.post(f"{API}/reservations/nonexistent_iter100/liquidacion/pagos", data={"montoBruto": "1000", "metodo": "efectivo"})
    assert r.status_code == 404


def test_sin_token_401(res_pii):
    _, rid = res_pii
    s = requests.Session()
    # explicit empty bearer overrides the conftest injected header
    r = s.post(f"{API}/reservations/{rid}/liquidacion/pagos", data={"montoBruto": "1000", "metodo": "efectivo"},
               headers={"Authorization": "Bearer invalid"})
    assert r.status_code == 401


def test_pct_decimal_redondeo():
    pid = _mk_prop("TEST_iter100_pct", 12.5)
    rid = _mk_res(pid, 333333)
    try:
        liq = requests.get(f"{API}/reservations/{rid}/liquidacion").json()
        assert liq["comisionPctEfectivo"] == 12.5
        r = requests.post(f"{API}/reservations/{rid}/liquidacion/pagos",
                          data={"montoBruto": "100001", "descuentaComision": "true", "metodo": "efectivo"})
        p = r.json()["pagosPropietario"][0]
        assert p["comisionRetenida"] == round(100001 * 0.125)
        assert p["monto"] + p["comisionRetenida"] == 100001
    finally:
        requests.delete(f"{API}/reservations/{rid}")
        requests.delete(f"{API}/properties/{pid}")


def test_alquiler_cero_no_rompe():
    pid = _mk_prop("TEST_iter100_zero", 18)
    rid = _mk_res(pid, 0)
    try:
        liq = requests.get(f"{API}/reservations/{rid}/liquidacion")
        assert liq.status_code == 200, liq.text
        assert liq.json()["comisionPctEfectivo"] == 0
        r = requests.post(f"{API}/reservations/{rid}/liquidacion/pagos",
                          data={"montoBruto": "5000", "descuentaComision": "true", "metodo": "efectivo"})
        assert r.status_code == 200, r.text
        assert r.json()["pagosPropietario"][0]["comisionRetenida"] == 0
        assert requests.get(f"{API}/reservations/{rid}/liquidacion/pdf").status_code == 200
    finally:
        requests.delete(f"{API}/reservations/{rid}")
        requests.delete(f"{API}/properties/{pid}")
