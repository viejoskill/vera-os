"""Iter101: edge cases for legacy owner-payment commission backfill (PUT pago, pagos-legado list/apply)
and the new overpayment guard on POST liquidacion/pagos."""
from __future__ import annotations

import os
import uuid

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api/rentals"


def _col():
    return MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]["rental_reservations"]


def _mk(titulo, monto=1617000, pct=18):
    p = requests.post(f"{API}/properties", json={"titulo": titulo, "tipo": "casa", "precioNoche": 1000, "comisionPct": pct})
    assert p.status_code == 201, p.text
    pid = p.json()["id"]
    r = requests.post(f"{API}/reservations/manual", json={"propertyId": pid, "nombre": "TEST_iter101",
                      "checkIn": "2027-05-01", "checkOut": "2027-05-06", "montoTotal": monto})
    assert r.status_code == 201, r.text
    rid = r.json()["id"]
    assert requests.patch(f"{API}/reservations/{rid}", json={"estado": "confirmada"}).status_code == 200
    return pid, rid


def _legado(rid, neto, fecha="2026-10-20", notas=None):
    pid = f"legado-{uuid.uuid4().hex}"
    _col().update_one({"_id": rid}, {"$push": {"pagosPropietario": {"id": pid, "monto": round(neto), "metodo": "transferencia",
                                                                       "fecha": fecha, "notas": notas, "comprobanteId": None}}})
    return pid


@pytest.fixture
def ctx():
    made = []
    yield made
    for pid, rid in made:
        requests.delete(f"{API}/reservations/{rid}")
        requests.delete(f"{API}/properties/{pid}")


# --- fully paid via legacy payment: pendiente=0 but backfill must still compute full commission
def test_fully_paid_legacy_backfill(ctx):
    pid, rid = _mk("TEST_iter101_full"); ctx.append((pid, rid))
    pago = _legado(rid, 1325940)
    liq = requests.get(f"{API}/reservations/{rid}/liquidacion").json()
    assert liq["estadoLiquidacion"] == "pagado"
    assert liq["comisionPendiente"] == 0
    lista = requests.get(f"{API}/liquidacion/pagos-legado").json()
    item = next(x for x in lista if x["pagoId"] == pago)
    assert item["montoBrutoEstimado"] == 1617000 and item["comisionEstimada"] == 291060 and item["limitado"] is False
    e = requests.put(f"{API}/reservations/{rid}/liquidacion/pagos/{pago}", data={"yaTeniaComisionDescontada": "true"})
    assert e.status_code == 200, e.text
    p = next(x for x in e.json()["pagosPropietario"] if x["id"] == pago)
    assert p["montoBruto"] == 1617000 and p["comisionRetenida"] == 291060 and "comisionWarning" not in e.json()
    liq2 = requests.get(f"{API}/reservations/{rid}/liquidacion").json()
    assert liq2["comisionRetenida"] == 291060 and liq2["comisionPendiente"] == 0 and liq2["saldoLiquidacion"] == 0


# --- overpayment guard
def test_overpayment_rejected(ctx):
    pid, rid = _mk("TEST_iter101_over"); ctx.append((pid, rid))
    r = requests.post(f"{API}/reservations/{rid}/liquidacion/pagos", data={"montoBruto": "1400000", "descuentaComision": "false", "metodo": "transferencia"})
    assert r.status_code == 400 and "supera el saldo" in r.json()["detail"]
    ok = requests.post(f"{API}/reservations/{rid}/liquidacion/pagos", data={"montoBruto": "1617000", "descuentaComision": "true", "metodo": "transferencia"})
    assert ok.status_code == 200, ok.text
    liq = requests.get(f"{API}/reservations/{rid}/liquidacion").json()
    assert liq["saldoLiquidacion"] == 0 and liq["estadoLiquidacion"] == "pagado"
    again = requests.post(f"{API}/reservations/{rid}/liquidacion/pagos", data={"montoBruto": "100", "descuentaComision": "false", "metodo": "transferencia"})
    assert again.status_code == 400


# --- PUT errors
def test_put_errors(ctx):
    pid, rid = _mk("TEST_iter101_err"); ctx.append((pid, rid))
    pago = _legado(rid, 100000)
    assert requests.put(f"{API}/reservations/{rid}/liquidacion/pagos/nope", data={"notas": "x"}).status_code == 404
    assert requests.put(f"{API}/reservations/nope/liquidacion/pagos/{pago}", data={"notas": "x"}).status_code == 404
    assert requests.put(f"{API}/reservations/{rid}/liquidacion/pagos/{pago}", data={"metodo": "bitcoin"}).status_code == 400
    assert requests.put(f"{API}/reservations/{rid}/liquidacion/pagos/{pago}", data={}).status_code == 400


# --- clearing notes with empty string
def test_put_clear_notes(ctx):
    pid, rid = _mk("TEST_iter101_notes"); ctx.append((pid, rid))
    pago = _legado(rid, 100000, notas="nota vieja")
    e = requests.put(f"{API}/reservations/{rid}/liquidacion/pagos/{pago}", data={"clearNotas": "true", "metodo": "efectivo"})
    assert e.status_code == 200, e.text
    p = next(x for x in e.json()["pagosPropietario"] if x["id"] == pago)
    assert p["metodo"] == "efectivo"
    assert not p.get("notas"), f"notas not cleared: {p.get('notas')!r}"


# --- apply: invalid / already-corrected items are skipped; no 500
def test_apply_skips_invalid(ctx):
    pid, rid = _mk("TEST_iter101_apply"); ctx.append((pid, rid))
    pago = _legado(rid, 662970)
    r = requests.post(f"{API}/liquidacion/pagos-legado/aplicar", json={"items": [
        {"reservaId": "nope", "pagoId": "x"}, {"reservaId": rid}, {"reservaId": rid, "pagoId": "nope"},
        {"reservaId": rid, "pagoId": pago}, {"reservaId": rid, "pagoId": pago}]})
    assert r.status_code == 200, r.text
    assert r.json()["aplicados"] == [{"reservaId": rid, "pagoId": pago}]
    liq = requests.get(f"{API}/reservations/{rid}/liquidacion").json()
    assert liq["comisionRetenida"] == 145530
    assert requests.post(f"{API}/liquidacion/pagos-legado/aplicar", json={}).status_code == 422


# --- zero-commission reservation is excluded from the legacy list (nothing to correct)
def test_zero_pct_reservation_listed(ctx):
    pid, rid = _mk("TEST_iter101_zero", pct=0); ctx.append((pid, rid))
    pago = _legado(rid, 50000)
    lista = requests.get(f"{API}/liquidacion/pagos-legado").json()
    item = next((x for x in lista if x["pagoId"] == pago), None)
    assert item is None


# --- auth required
def test_requires_auth():
    s = requests.Session()
    r = s.get(f"{API}/liquidacion/pagos-legado", headers={"Authorization": "Bearer invalid"})
    assert r.status_code in (401, 403)
