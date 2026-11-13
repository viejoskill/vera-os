"""Contabilidad: comisiones huérfanas + fecha de reconocimiento (iteration 87-88).

1) Al borrar una reserva ANTES de que existiera el borrado en cascada, el movimiento
   `rental_movimientos` tipo="comision" quedaba huérfano (reservaId apuntando a una
   reserva ya inexistente), inflando el total de Contabilidad. POST
   /api/contabilidad/comisiones/backfill ahora también detecta y borra esos huérfanos,
   sin tocar comisiones de reservas que sí existen.
2) La comisión se cuenta en Contabilidad al CONFIRMAR la reserva (seña pagada), no al
   check-in futuro de la estadía. Las comisiones ya generadas antes de este cambio se
   migran una vez (vía el mismo endpoint de backfill) a la fecha real de su creación.
"""
from __future__ import annotations

import os
import sys
import uuid

import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient

sys.path.insert(0, "/app/backend")
import config as appconfig  # noqa: E402

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api/contabilidad"
RENTALS_API = f"{BASE_URL}/api/rentals"


@pytest.fixture(scope="module")
def mongo():
    client = AsyncIOMotorClient(appconfig.MONGO_URL)
    yield client[appconfig.DB_NAME]
    client.close()


def _insert_orphan(mongo, mov_id: str) -> None:
    import asyncio
    asyncio.get_event_loop().run_until_complete(
        mongo["rental_movimientos"].insert_one({
            "_id": mov_id, "propertyId": "TEST_PROP_X", "reservaId": f"RESERVA_INEXISTENTE_{mov_id}",
            "fecha": "2026-09-21", "tipo": "comision", "monto": 86400, "comisionPct": 12,
            "descripcion": "Comisión 12.0% · TEST huérfana", "createdAt": "2026-09-21T00:00:00+00:00",
        })
    )


def _exists(mongo, mov_id: str) -> bool:
    import asyncio
    doc = asyncio.get_event_loop().run_until_complete(mongo["rental_movimientos"].find_one({"_id": mov_id}))
    return doc is not None


def test_backfill_deletes_orphan_commission(mongo):
    mov_id = f"TEST_ORPHAN_{uuid.uuid4().hex[:8]}"
    _insert_orphan(mongo, mov_id)
    assert _exists(mongo, mov_id)

    r = requests.post(f"{API}/comisiones/backfill")
    assert r.status_code == 200, r.text
    assert r.json()["huerfanasEliminadas"] >= 1

    assert not _exists(mongo, mov_id)


def test_backfill_does_not_touch_commission_of_existing_reservation():
    """Comisión ligada a una reserva que SIGUE existiendo no debe tocarse."""
    pid = requests.post(f"{RENTALS_API}/properties", json={
        "titulo": "TEST_comision_viva", "tipo": "casa", "comisionPct": 10,
    }).json()["id"]
    try:
        rid = requests.post(f"{RENTALS_API}/reservations/manual", json={
            "propertyId": pid, "nombre": "Test Vivo", "checkIn": "2026-12-01", "checkOut": "2026-12-05",
            "montoTotal": 1000,
        }).json()["id"]
        requests.patch(f"{RENTALS_API}/reservations/{rid}", json={"estado": "confirmada"})
        before = requests.get(f"{RENTALS_API}/properties/{pid}/movimientos").json()
        com_before = [m for m in before if m.get("tipo") == "comision"]
        assert len(com_before) == 1

        r = requests.post(f"{API}/comisiones/backfill")
        assert r.status_code == 200

        after = requests.get(f"{RENTALS_API}/properties/{pid}/movimientos").json()
        com_after = [m for m in after if m.get("tipo") == "comision"]
        assert len(com_after) == 1
        assert com_after[0]["id"] == com_before[0]["id"]
    finally:
        for res in requests.get(f"{RENTALS_API}/reservations", params={"propertyId": pid}).json():
            requests.delete(f"{RENTALS_API}/reservations/{res['id']}")
        requests.delete(f"{RENTALS_API}/properties/{pid}")


def test_backfill_is_idempotent(mongo):
    mov_id = f"TEST_ORPHAN_{uuid.uuid4().hex[:8]}"
    _insert_orphan(mongo, mov_id)
    requests.post(f"{API}/comisiones/backfill")
    r2 = requests.post(f"{API}/comisiones/backfill")
    assert r2.json()["huerfanasEliminadas"] == 0


def test_new_commission_is_dated_at_confirmation_not_checkin():
    """La comisión se cuenta al confirmar la reserva (seña pagada), no al check-in futuro
    de la estadía: su `fecha` debe ser HOY, aunque el check-in sea meses después."""
    from datetime import date
    pid = requests.post(f"{RENTALS_API}/properties", json={
        "titulo": "TEST_comision_confirmacion", "tipo": "casa", "comisionPct": 10,
    }).json()["id"]
    try:
        rid = requests.post(f"{RENTALS_API}/reservations/manual", json={
            "propertyId": pid, "nombre": "Test Confirmacion", "checkIn": "2027-02-15", "checkOut": "2027-02-20",
            "montoTotal": 10000,
        }).json()["id"]
        movs = requests.get(f"{RENTALS_API}/properties/{pid}/movimientos").json()
        com = [m for m in movs if m.get("tipo") == "comision"][0]
        assert com["fecha"] == date.today().isoformat()
        assert com["fecha"] != "2027-02-15"
    finally:
        for res in requests.get(f"{RENTALS_API}/reservations", params={"propertyId": pid}).json():
            requests.delete(f"{RENTALS_API}/reservations/{res['id']}")
        requests.delete(f"{RENTALS_API}/properties/{pid}")


def test_backfill_corrects_old_commission_fecha_to_createdat(mongo):
    """Migra comisiones viejas (generadas antes del fix, con fecha=checkIn) a la fecha
    real en que se crearon (createdAt), sin tocar las que ya están correctas."""
    import asyncio
    mov_id = f"TEST_OLDFECHA_{uuid.uuid4().hex[:8]}"
    res_id = f"TEST_RESERVA_VALIDA_{uuid.uuid4().hex[:8]}"
    asyncio.get_event_loop().run_until_complete(mongo["rental_reservations"].insert_one({
        "_id": res_id, "propertyId": "TEST_PROP_OLDFECHA", "estado": "confirmada",
        "checkIn": "2027-02-15", "checkOut": "2027-02-20", "montoEstimado": 500000, "moneda": "ARS",
        "huesped": {"nombre": "Test OldFecha"}, "createdAt": "2026-08-01T12:00:00+00:00",
    }))
    asyncio.get_event_loop().run_until_complete(mongo["rental_movimientos"].insert_one({
        "_id": mov_id, "propertyId": "TEST_PROP_OLDFECHA", "reservaId": res_id,
        "fecha": "2027-02-15", "tipo": "comision", "monto": 50000, "comisionPct": 10,
        "descripcion": "Comisión vieja (TEST)", "createdAt": "2026-08-01T12:00:00+00:00",
    }))
    try:
        r = requests.post(f"{API}/comisiones/backfill")
        assert r.json()["fechasCorregidas"] >= 1
        doc = asyncio.get_event_loop().run_until_complete(mongo["rental_movimientos"].find_one({"_id": mov_id}))
        assert doc["fecha"] == "2026-08-01"
    finally:
        asyncio.get_event_loop().run_until_complete(mongo["rental_movimientos"].delete_one({"_id": mov_id}))
        asyncio.get_event_loop().run_until_complete(mongo["rental_reservations"].delete_one({"_id": res_id}))
