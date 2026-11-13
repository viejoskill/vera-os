"""Iteration 88 re-test: backfill no pisa comisiones manuales, delete property cascada,
update_status -> _gen_comision incluye comisionPct."""
import os
import sys
import uuid

import pytest
import requests
from pymongo import MongoClient

sys.path.insert(0, "/app/backend")
import config as appconfig  # noqa: E402

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
CONTA = f"{BASE_URL}/api/contabilidad"
RENT = f"{BASE_URL}/api/rentals"


@pytest.fixture(scope="module")
def db():
    c = MongoClient(appconfig.MONGO_URL)
    yield c[appconfig.DB_NAME]
    c.close()


@pytest.fixture(scope="module")
def created():
    d = {"props": [], "movs": []}
    yield d
    for mid in d["movs"]:
        requests.delete(f"{RENT}/movimientos/{mid}")
    for pid in d["props"]:
        for res in requests.get(f"{RENT}/reservations", params={"propertyId": pid}).json():
            requests.delete(f"{RENT}/reservations/{res['id']}")
        requests.delete(f"{RENT}/properties/{pid}")


def _prop(created, **kw):
    r = requests.post(f"{RENT}/properties", json={"titulo": f"TEST_i88_{uuid.uuid4().hex[:6]}", "tipo": "casa", **kw})
    assert r.status_code == 201, r.text
    created["props"].append(r.json()["id"])
    return r.json()["id"]


def _coms(pid):
    return [m for m in requests.get(f"{RENT}/properties/{pid}/movimientos").json() if m.get("tipo") == "comision"]


# Refactor: prereserva -> confirmada genera comisión CON comisionPct
def test_prereserva_confirm_commission_has_comisionPct(created, db):
    pid = _prop(created, comisionPct=8)
    rid = requests.post(f"{RENT}/reservations", json={
        "propertyId": pid, "nombre": "TEST_i88_pre", "checkIn": "2028-01-10", "checkOut": "2028-01-14", "monto": 40000}).json()["id"]
    assert requests.patch(f"{RENT}/reservations/{rid}", json={"estado": "confirmada"}).status_code == 200
    coms = _coms(pid)
    assert len(coms) == 1 and coms[0]["monto"] == 3200
    raw = db["rental_movimientos"].find_one({"_id": coms[0]["id"]})
    assert raw.get("comisionPct") == 8.0
    assert raw.get("reservaId") == rid


# FIX 1: manual commission without reservaId, fecha == some value, not touched
def test_backfill_keeps_manual_commission_without_reserva(created):
    pid = _prop(created, comisionPct=0)
    m = requests.post(f"{RENT}/movimientos", json={
        "propertyId": pid, "fecha": "2025-04-20", "tipo": "comision", "monto": 1234, "descripcion": "TEST_i88_manual"})
    assert m.status_code == 201
    created["movs"].append(m.json()["id"])
    requests.post(f"{CONTA}/comisiones/backfill")
    after = [x for x in _coms(pid) if x["id"] == m.json()["id"]][0]
    assert after["fecha"] == "2025-04-20"


# FIX 1: manual commission linked to a reserva, fecha != checkIn, not touched
def test_backfill_keeps_manual_commission_with_reserva_other_fecha(created):
    pid = _prop(created, comisionPct=0)
    rid = requests.post(f"{RENT}/reservations/manual", json={
        "propertyId": pid, "nombre": "TEST_i88_link", "checkIn": "2028-02-01", "checkOut": "2028-02-03", "montoTotal": 1000}).json()["id"]
    m = requests.post(f"{RENT}/movimientos", json={
        "propertyId": pid, "fecha": "2025-05-05", "tipo": "comision", "monto": 99, "reservaId": rid})
    assert m.status_code == 201
    requests.post(f"{CONTA}/comisiones/backfill")
    after = [x for x in _coms(pid) if x["id"] == m.json()["id"]][0]
    assert after["fecha"] == "2025-05-05"


# FIX 1 edge (informative): manual commission linked to a reserva with fecha == checkIn IS rewritten
def test_backfill_manual_commission_with_reserva_fecha_eq_checkin(created):
    pid = _prop(created, comisionPct=0)
    rid = requests.post(f"{RENT}/reservations/manual", json={
        "propertyId": pid, "nombre": "TEST_i88_edge", "checkIn": "2028-03-01", "checkOut": "2028-03-03", "montoTotal": 1000}).json()["id"]
    m = requests.post(f"{RENT}/movimientos", json={
        "propertyId": pid, "fecha": "2028-03-01", "tipo": "comision", "monto": 77, "reservaId": rid})
    assert m.status_code == 201
    requests.post(f"{CONTA}/comisiones/backfill")
    after = [x for x in _coms(pid) if x["id"] == m.json()["id"]][0]
    print("EDGE fecha after backfill:", after["fecha"])
    assert after["fecha"] == "2028-03-01", "manual commission with reservaId & fecha==checkIn rewritten"


# FIX 2: property delete cascades all movements (commission + manual)
def test_delete_property_cascades_all_movimientos(db):
    pid = requests.post(f"{RENT}/properties", json={"titulo": "TEST_i88_del", "tipo": "casa", "comisionPct": 10}).json()["id"]
    rid = requests.post(f"{RENT}/reservations/manual", json={
        "propertyId": pid, "nombre": "TEST_i88_del", "checkIn": "2028-04-01", "checkOut": "2028-04-03", "montoTotal": 5000}).json()["id"]
    m = requests.post(f"{RENT}/movimientos", json={"propertyId": pid, "fecha": "2025-01-01", "tipo": "gasto_prop", "monto": 10})
    if m.status_code != 201:
        requests.delete(f"{RENT}/properties/{pid}")
    assert m.status_code == 201, m.text
    assert len(_coms(pid)) == 1
    assert requests.delete(f"{RENT}/properties/{pid}").status_code == 204
    assert requests.get(f"{RENT}/properties/{pid}").status_code == 404
    left = list(db["rental_movimientos"].find({"propertyId": pid}))
    left_res = list(db["rental_reservations"].find({"_id": rid}))
    db["rental_movimientos"].delete_many({"propertyId": pid})
    assert left == []
    assert left_res == []


# Backfill response shape still OK
def test_backfill_response_shape():
    r = requests.post(f"{CONTA}/comisiones/backfill")
    assert r.status_code == 200
    d = r.json()
    for k in ("generadas", "huerfanasEliminadas", "fechasCorregidas"):
        assert isinstance(d[k], int)
