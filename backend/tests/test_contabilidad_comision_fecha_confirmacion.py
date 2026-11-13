"""Iteration 87: comisión de alquiler fechada a la CONFIRMACIÓN (hoy), no al check-in;
backfill: generadas / huerfanasEliminadas / fechasCorregidas + idempotencia; resumen;
regresión liquidación por reserva."""
import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone

import pytest
import requests
from pymongo import MongoClient

sys.path.insert(0, "/app/backend")
import config as appconfig  # noqa: E402

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
CONTA = f"{BASE_URL}/api/contabilidad"
RENT = f"{BASE_URL}/api/rentals"
TODAY = datetime.now(timezone.utc).date().isoformat()

def run(x):
    return x


@pytest.fixture(scope="module")
def db():
    c = MongoClient(appconfig.MONGO_URL)
    yield c[appconfig.DB_NAME]
    c.close()


@pytest.fixture(scope="module")
def created():
    d = {"props": []}
    yield d
    for pid in d["props"]:
        for res in requests.get(f"{RENT}/reservations", params={"propertyId": pid}).json():
            requests.delete(f"{RENT}/reservations/{res['id']}")
        requests.delete(f"{RENT}/properties/{pid}")


def _prop(created, **kw):
    body = {"titulo": f"TEST_cfc_{uuid.uuid4().hex[:6]}", "tipo": "casa", **kw}
    r = requests.post(f"{RENT}/properties", json=body)
    assert r.status_code == 201, r.text
    pid = r.json()["id"]
    created["props"].append(pid)
    return pid


def _coms(pid):
    return [m for m in requests.get(f"{RENT}/properties/{pid}/movimientos").json() if m.get("tipo") == "comision"]


# --- Comisión al confirmar (reserva manual) ---
def test_manual_reservation_commission_dated_today(created):
    pid = _prop(created, comisionPct=10)
    r = requests.post(f"{RENT}/reservations/manual", json={
        "propertyId": pid, "nombre": "TEST_Manual", "checkIn": "2027-06-01", "checkOut": "2027-06-06", "montoTotal": 100000})
    assert r.status_code == 201, r.text
    coms = _coms(pid)
    assert len(coms) == 1
    assert coms[0]["fecha"] == TODAY
    assert coms[0]["monto"] == 10000


# --- Comisión al confirmar (prereserva -> confirmada) ---
def test_prereserva_to_confirmada_commission_dated_today(created):
    pid = _prop(created, comisionPct=12)
    r = requests.post(f"{RENT}/reservations", json={
        "propertyId": pid, "nombre": "TEST_Pre", "checkIn": "2027-07-10", "checkOut": "2027-07-15", "monto": 50000})
    assert r.status_code == 201, r.text
    rid = r.json()["id"]
    assert _coms(pid) == []
    p = requests.patch(f"{RENT}/reservations/{rid}", json={"estado": "confirmada"})
    assert p.status_code == 200, p.text
    coms = _coms(pid)
    assert len(coms) == 1
    assert coms[0]["fecha"] == TODAY
    assert coms[0]["monto"] == 6000
    # re-confirm (reabrir) no duplica
    requests.patch(f"{RENT}/reservations/{rid}", json={"estado": "finalizada"})
    requests.patch(f"{RENT}/reservations/{rid}", json={"estado": "confirmada"})
    assert len(_coms(pid)) == 1


# --- comisionMinima ---
def test_comision_minima_dated_today(created):
    pid = _prop(created, comisionPct=1, comisionMinima=7777)
    requests.post(f"{RENT}/reservations/manual", json={
        "propertyId": pid, "nombre": "TEST_Min", "checkIn": "2027-08-01", "checkOut": "2027-08-03", "montoTotal": 1000})
    coms = _coms(pid)
    assert len(coms) == 1 and coms[0]["monto"] == 7777 and coms[0]["fecha"] == TODAY


# --- Resumen: comisión aparece en hoy, no en 2027 ---
def test_resumen_includes_commission_today_not_2027(created):
    pid = _prop(created, comisionPct=10)
    requests.post(f"{RENT}/reservations/manual", json={
        "propertyId": pid, "nombre": "TEST_Resumen", "checkIn": "2027-09-01", "checkOut": "2027-09-05", "montoTotal": 123450})
    com_id = _coms(pid)[0]["id"]
    hoy = requests.get(f"{CONTA}/resumen", params={"desde": TODAY, "hasta": TODAY}).json()
    assert com_id in [d["id"] for d in hoy["movimientos"]]
    fut = requests.get(f"{CONTA}/resumen", params={"desde": "2027-01-01", "hasta": "2027-12-31"}).json()
    assert com_id not in [d["id"] for d in fut["movimientos"]]


# --- Backfill: generadas para reservas confirmadas sin comisión ---
def test_backfill_generates_missing_commission(created):
    pid = _prop(created)  # sin comisión
    rid = requests.post(f"{RENT}/reservations/manual", json={
        "propertyId": pid, "nombre": "TEST_BF", "checkIn": "2027-10-01", "checkOut": "2027-10-04", "montoTotal": 200000}).json()["id"]
    assert _coms(pid) == []
    p = requests.get(f"{RENT}/properties/{pid}").json()
    p["comisionPct"] = 15
    u = requests.put(f"{RENT}/properties/{pid}", json=p)
    assert u.status_code == 200, u.text
    r = requests.post(f"{CONTA}/comisiones/backfill").json()
    assert r["generadas"] >= 1
    coms = _coms(pid)
    assert len(coms) == 1 and coms[0]["monto"] == 30000 and coms[0]["fecha"] == TODAY and coms[0]["reservaId"] == rid
    r2 = requests.post(f"{CONTA}/comisiones/backfill").json()
    assert len(_coms(pid)) == 1
    assert r2["generadas"] == 0


# --- Backfill: corrige fecha vieja + huérfana + idempotencia ---
def test_backfill_migrates_fecha_and_orphan_idempotent(db, created):
    pid = _prop(created, comisionPct=10)
    requests.post(f"{RENT}/reservations/manual", json={
        "propertyId": pid, "nombre": "TEST_Old", "checkIn": "2027-11-01", "checkOut": "2027-11-05", "montoTotal": 100000})
    com = _coms(pid)[0]
    created_at = run(db["rental_movimientos"].find_one({"_id": com["id"]}))["createdAt"]
    # simulate old logic: fecha = checkIn
    run(db["rental_movimientos"].update_one({"_id": com["id"]}, {"$set": {"fecha": "2027-11-01"}}))
    orphan_id = f"TEST_ORPH_{uuid.uuid4().hex[:8]}"
    run(db["rental_movimientos"].insert_one({
        "_id": orphan_id, "propertyId": pid, "reservaId": f"TEST_NOEXISTE_{orphan_id}", "fecha": "2026-01-01",
        "tipo": "comision", "monto": 1, "createdAt": "2026-01-01T00:00:00+00:00"}))
    r1 = requests.post(f"{CONTA}/comisiones/backfill").json()
    assert r1["fechasCorregidas"] >= 1 and r1["huerfanasEliminadas"] >= 1
    assert run(db["rental_movimientos"].find_one({"_id": com["id"]}))["fecha"] == created_at[:10]
    assert run(db["rental_movimientos"].find_one({"_id": orphan_id})) is None
    r2 = requests.post(f"{CONTA}/comisiones/backfill").json()
    assert r2["fechasCorregidas"] == 0 and r2["huerfanasEliminadas"] == 0 and r2["generadas"] == 0


# --- Regresión: liquidación por reserva ---
def test_liquidacion_por_reserva_includes_commission(created):
    pid = _prop(created, comisionPct=10)
    rid = requests.post(f"{RENT}/reservations/manual", json={
        "propertyId": pid, "nombre": "TEST_Liq", "checkIn": "2027-12-01", "checkOut": "2027-12-05", "montoTotal": 100000}).json()["id"]
    liq = requests.get(f"{RENT}/reservations/{rid}/liquidacion")
    assert liq.status_code == 200, liq.text
    d = liq.json()
    assert d["comision"] == 10000
    assert d["alquiler"] == 100000
    assert d["netoPropietario"] == 90000
    assert any(m["tipo"] == "comision" for m in d["movimientos"])


# --- Edge: backfill no debería pisar fecha de comisiones manuales cargadas por el usuario ---
def test_backfill_does_not_override_manual_commission_fecha(created):
    pid = _prop(created, comisionPct=0)
    m = requests.post(f"{RENT}/movimientos", json={
        "propertyId": pid, "fecha": "2025-03-15", "tipo": "comision", "monto": 5000, "descripcion": "TEST_manual_comision"})
    assert m.status_code == 201, m.text
    mid = m.json()["id"]
    try:
        requests.post(f"{CONTA}/comisiones/backfill")
        after = [x for x in _coms(pid) if x["id"] == mid][0]
    finally:
        requests.delete(f"{RENT}/movimientos/{mid}")
    assert after["fecha"] == "2025-03-15", f"backfill overwrote manual commission fecha -> {after['fecha']}"


# --- Edge: borrar PROPIEDAD con reservas confirmadas no debería dejar comisiones huérfanas ---
def test_delete_property_cascades_commissions(db):
    pid = requests.post(f"{RENT}/properties", json={"titulo": "TEST_cfc_delprop", "tipo": "casa", "comisionPct": 10}).json()["id"]
    rid = requests.post(f"{RENT}/reservations/manual", json={
        "propertyId": pid, "nombre": "TEST_Del", "checkIn": "2027-05-01", "checkOut": "2027-05-03", "montoTotal": 1000}).json()["id"]
    assert len(_coms(pid)) == 1
    assert requests.delete(f"{RENT}/properties/{pid}").status_code == 204
    left = list(db["rental_movimientos"].find({"reservaId": rid}))
    db["rental_movimientos"].delete_many({"reservaId": rid, "propertyId": pid})
    assert left == [], f"property delete left {len(left)} orphan commission(s)"
