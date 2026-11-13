"""Liquidaciones - pago al propietario: tests extra (PDF texto, comprobante, edge cases)."""
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


@pytest.fixture
def reserva():
    p = requests.post(f"{API}/properties", json={"titulo": "TEST_pago_prop_extra", "tipo": "casa", "precioNoche": 1000})
    assert p.status_code == 201, p.text
    pid = p.json()["id"]
    r = requests.post(f"{API}/reservations/manual", json={
        "propertyId": pid, "nombre": "TEST extra", "checkIn": "2026-12-01", "checkOut": "2026-12-04", "montoTotal": 90000})
    assert r.status_code == 201, r.text
    rid = r.json()["id"]
    yield pid, rid
    requests.delete(f"{API}/reservations/{rid}")
    requests.delete(f"{API}/properties/{pid}")


# PDF: pendiente vs pagado (texto real)
def test_pdf_pendiente_y_pagado(reserva):
    _, rid = reserva
    t = _pdf_text(requests.get(f"{API}/reservations/{rid}/liquidacion/pdf").content)
    assert "Pago al propietario" in t and "Pendiente de registrar" in t
    requests.post(f"{API}/reservations/{rid}/liquidacion/marcar-pagada",
                  data={"monto": "123456", "metodo": "efectivo", "fecha": "2026-12-10", "notas": "Nota QA"})
    t = _pdf_text(requests.get(f"{API}/reservations/{rid}/liquidacion/pdf").content)
    assert "Pagado el" in t and "10/12/2026" in t and "Efectivo" in t and "123.456" in t and "Nota QA" in t


# PDF con notas que contienen caracteres especiales (&, <)
def test_pdf_notas_caracteres_especiales(reserva):
    _, rid = reserva
    requests.post(f"{API}/reservations/{rid}/liquidacion/marcar-pagada",
                  data={"monto": "1000", "metodo": "otro", "notas": "Transf. Banco Galicia & Cía <ref 12>"})
    r = requests.get(f"{API}/reservations/{rid}/liquidacion/pdf")
    assert r.status_code == 200, f"PDF falla con notas especiales: {r.status_code} {r.text[:200]}"


# default fecha = hoy, monto negativo, reserva inexistente
def test_fecha_default_y_validaciones(reserva):
    from datetime import date
    _, rid = reserva
    r = requests.post(f"{API}/reservations/{rid}/liquidacion/marcar-pagada", data={"monto": "500", "metodo": "cheque"})
    assert r.status_code == 200
    assert r.json()["pagoPropietario"]["fecha"] == date.today().isoformat()
    assert requests.post(f"{API}/reservations/{rid}/liquidacion/marcar-pagada", data={"monto": "-5"}).status_code == 400
    assert requests.post(f"{API}/reservations/nope123/liquidacion/marcar-pagada", data={"monto": "5"}).status_code == 404
    assert requests.post(f"{API}/reservations/nope123/liquidacion/revertir").status_code == 404
    assert requests.get(f"{API}/reservations/nope123/liquidacion/comprobante").status_code == 404


# metodo invalido debería rechazarse (spec: transferencia|efectivo|cheque|otro)
def test_metodo_invalido(reserva):
    _, rid = reserva
    r = requests.post(f"{API}/reservations/{rid}/liquidacion/marcar-pagada", data={"monto": "500", "metodo": "bitcoin"})
    assert r.status_code in (400, 422), f"metodo invalido aceptado: {r.status_code}"


# comprobante con archivo: upload + download
def test_comprobante_upload_download(reserva):
    _, rid = reserva
    png = b"\x89PNG\r\n\x1a\n" + b"0" * 100
    r = requests.post(f"{API}/reservations/{rid}/liquidacion/marcar-pagada",
                      data={"monto": "1000", "metodo": "transferencia"},
                      files={"file": ("TEST_comp.png", png, "image/png")})
    assert r.status_code == 200, r.text
    comp = r.json()["pagoPropietario"]["comprobante"]
    assert comp and comp["contentType"] == "image/png"
    d = requests.get(f"{API}/reservations/{rid}/liquidacion/comprobante")
    assert d.status_code == 200 and d.content == png
    # re-marcar sin archivo no debería perder silenciosamente? (documenta comportamiento)
    rv = requests.post(f"{API}/reservations/{rid}/liquidacion/revertir")
    assert rv.json().get("pagoPropietario") is None


# A161: liquidables expone pagoPropietario; marcar+revertir y dejar como estaba
def test_a161_liquidables_roundtrip():
    lst = requests.get(f"{API}/properties/{A161}/liquidables")
    assert lst.status_code == 200
    items = lst.json()
    assert len(items) > 0
    assert all("pagoPropietario" in x for x in items)
    target = next((x for x in items if not x.get("pagoPropietario")), None)
    if not target:
        pytest.skip("todas pagadas")
    rid = target["id"]
    try:
        r = requests.post(f"{API}/reservations/{rid}/liquidacion/marcar-pagada",
                          data={"monto": "777", "metodo": "transferencia", "notas": "TEST_qa"})
        assert r.status_code == 200
        items2 = requests.get(f"{API}/properties/{A161}/liquidables").json()
        t2 = next(x for x in items2 if x["id"] == rid)
        assert t2["pagoPropietario"]["estado"] == "pagado" and t2["pagoPropietario"]["monto"] == 777
    finally:
        requests.post(f"{API}/reservations/{rid}/liquidacion/revertir")
    items3 = requests.get(f"{API}/properties/{A161}/liquidables").json()
    assert not next(x for x in items3 if x["id"] == rid).get("pagoPropietario")
