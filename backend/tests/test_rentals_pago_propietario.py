"""Liquidaciones: registrar pagos al propietario (fecha, método, monto, comprobante).
Una reserva puede tener VARIOS pagos (a veces se liquida en partes): se acumulan en una
lista, no se sobreescriben. Estado: pendiente (sin pagos) / parcial (pagos < neto) /
pagado (pagos >= neto)."""
from __future__ import annotations

import io
import os

import pytest
import requests
from pypdf import PdfReader

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api/rentals"
A161 = "6744cf8a907f4a239a7504101c66a2df"


def _pdf_text(content: bytes) -> str:
    return "\n".join(p.extract_text() or "" for p in PdfReader(io.BytesIO(content)).pages)


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
    rid = _mk_res(pid, "2026-12-01", "2026-12-06", monto=100000)
    yield pid, rid
    _cleanup(pid, rid)


def test_sin_pago_estado_inicial(reserva):
    _, rid = reserva
    liq = requests.get(f"{API}/reservations/{rid}/liquidacion").json()
    assert liq["pagosPropietario"] == [] and liq["estadoLiquidacion"] == "pendiente"
    assert liq["totalPagadoPropietario"] == 0 and liq["saldoLiquidacion"] == liq["netoPropietario"]


def test_un_pago_parcial_queda_en_parcial(reserva):
    _, rid = reserva
    liq0 = requests.get(f"{API}/reservations/{rid}/liquidacion").json()
    neto = liq0["netoPropietario"]
    mitad = round(neto / 2)
    r = requests.post(f"{API}/reservations/{rid}/liquidacion/pagos", data={
        "monto": str(mitad), "metodo": "transferencia", "fecha": "2026-12-10", "notas": "Primer pago",
    })
    assert r.status_code == 200, r.text
    liq = requests.get(f"{API}/reservations/{rid}/liquidacion").json()
    assert liq["estadoLiquidacion"] == "parcial"
    assert liq["totalPagadoPropietario"] == mitad
    assert liq["saldoLiquidacion"] == neto - mitad
    assert len(liq["pagosPropietario"]) == 1
    assert liq["pagosPropietario"][0]["notas"] == "Primer pago"


def test_dos_pagos_completan_la_liquidacion(reserva):
    _, rid = reserva
    neto = requests.get(f"{API}/reservations/{rid}/liquidacion").json()["netoPropietario"]
    mitad = round(neto / 2)
    requests.post(f"{API}/reservations/{rid}/liquidacion/pagos", data={"monto": str(mitad), "metodo": "transferencia"})
    requests.post(f"{API}/reservations/{rid}/liquidacion/pagos", data={"monto": str(neto - mitad), "metodo": "efectivo"})
    liq = requests.get(f"{API}/reservations/{rid}/liquidacion").json()
    assert liq["estadoLiquidacion"] == "pagado"
    assert liq["totalPagadoPropietario"] == neto and liq["saldoLiquidacion"] == 0
    assert len(liq["pagosPropietario"]) == 2


def test_borrar_un_pago_no_afecta_los_demas(reserva):
    _, rid = reserva
    requests.post(f"{API}/reservations/{rid}/liquidacion/pagos", data={"monto": "40000", "metodo": "transferencia"})
    requests.post(f"{API}/reservations/{rid}/liquidacion/pagos", data={"monto": "30000", "metodo": "efectivo"})
    liq = requests.get(f"{API}/reservations/{rid}/liquidacion").json()
    assert len(liq["pagosPropietario"]) == 2
    primero = liq["pagosPropietario"][0]["id"]
    d = requests.delete(f"{API}/reservations/{rid}/liquidacion/pagos/{primero}")
    assert d.status_code == 204
    liq2 = requests.get(f"{API}/reservations/{rid}/liquidacion").json()
    assert len(liq2["pagosPropietario"]) == 1
    assert liq2["totalPagadoPropietario"] == 30000


def test_monto_invalido_rechazado(reserva):
    _, rid = reserva
    assert requests.post(f"{API}/reservations/{rid}/liquidacion/pagos", data={"monto": "0", "metodo": "efectivo"}).status_code == 400
    assert requests.post(f"{API}/reservations/{rid}/liquidacion/pagos", data={"monto": "-5", "metodo": "efectivo"}).status_code == 400


def test_metodo_invalido_rechazado(reserva):
    _, rid = reserva
    r = requests.post(f"{API}/reservations/{rid}/liquidacion/pagos", data={"monto": "500", "metodo": "bitcoin"})
    assert r.status_code == 400


def test_reserva_inexistente_404():
    assert requests.post(f"{API}/reservations/nope123/liquidacion/pagos", data={"monto": "5", "metodo": "efectivo"}).status_code == 404


def test_comprobante_upload_y_descarga(reserva):
    _, rid = reserva
    png = b"\x89PNG\r\n\x1a\n" + b"0" * 100
    r = requests.post(f"{API}/reservations/{rid}/liquidacion/pagos",
                       data={"monto": "1000", "metodo": "transferencia"},
                       files={"file": ("TEST_comp.png", png, "image/png")})
    assert r.status_code == 200, r.text
    liq = requests.get(f"{API}/reservations/{rid}/liquidacion").json()
    cid = liq["pagosPropietario"][0]["comprobanteId"]
    assert cid
    d = requests.get(f"{API}/reservations/{rid}/comprobantes/{cid}")
    assert d.status_code == 200 and d.content == png
    # borrar el pago también borra su comprobante del array compartido
    requests.delete(f"{API}/reservations/{rid}/liquidacion/pagos/{liq['pagosPropietario'][0]['id']}")
    assert requests.get(f"{API}/reservations/{rid}/comprobantes/{cid}").status_code == 404


def test_pdf_pendiente_y_pagado(reserva):
    _, rid = reserva
    t = _pdf_text(requests.get(f"{API}/reservations/{rid}/liquidacion/pdf").content)
    assert "Pago al propietario" in t and "Pendiente de registrar" in t
    neto = requests.get(f"{API}/reservations/{rid}/liquidacion").json()["netoPropietario"]
    requests.post(f"{API}/reservations/{rid}/liquidacion/pagos",
                  data={"monto": str(neto), "metodo": "cheque", "fecha": "2026-12-11", "notas": "Nota QA"})
    r = requests.get(f"{API}/reservations/{rid}/liquidacion/pdf")
    assert r.status_code == 200 and r.headers["content-type"] == "application/pdf"
    t2 = _pdf_text(r.content)
    assert "Pagado el" in t2 and "11/12/2026" in t2 and "Cheque" in t2 and "Nota QA" in t2
    assert "Liquidación completa" in t2


def test_liquidables_expone_estado_liquidacion(reserva):
    pid, _ = reserva
    lista = requests.get(f"{API}/properties/{pid}/liquidables").json()
    for r in lista:
        assert "estadoLiquidacion" in r and "totalPagadoPropietario" in r and "saldoLiquidacion" in r


def test_a161_liquidables_roundtrip():
    """Fixture reutilizable A161: carga 2 pagos parciales en una reserva sin liquidar,
    confirma estado 'parcial', y los borra dejando todo como estaba."""
    lst = requests.get(f"{API}/properties/{A161}/liquidables")
    assert lst.status_code == 200
    items = lst.json()
    assert len(items) > 0
    target = next((x for x in items if x.get("estadoLiquidacion") == "pendiente"), None)
    if not target:
        pytest.skip("no hay ninguna reserva sin liquidar en A161 ahora mismo")
    rid = target["id"]
    ids_creados = []
    try:
        r1 = requests.post(f"{API}/reservations/{rid}/liquidacion/pagos",
                            data={"monto": "777", "metodo": "transferencia", "notas": "TEST_qa"})
        assert r1.status_code == 200
        liq = requests.get(f"{API}/reservations/{rid}/liquidacion").json()
        assert liq["estadoLiquidacion"] == "parcial"
        ids_creados = [p["id"] for p in liq["pagosPropietario"]]
    finally:
        for pago_id in ids_creados:
            requests.delete(f"{API}/reservations/{rid}/liquidacion/pagos/{pago_id}")
    liq_final = requests.get(f"{API}/reservations/{rid}/liquidacion").json()
    assert liq_final["pagosPropietario"] == [] and liq_final["estadoLiquidacion"] == "pendiente"
