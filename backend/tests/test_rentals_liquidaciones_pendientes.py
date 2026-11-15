"""Liquidaciones: recordatorio de reservas con seña cobrada hace >N días sin liquidar."""
from __future__ import annotations

import asyncio
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


def _mk_res(pid: str, ci: str, co: str) -> str:
    r = requests.post(f"{API}/reservations/manual", json={
        "propertyId": pid, "nombre": "TEST recordatorio", "checkIn": ci, "checkOut": co, "montoTotal": 100000,
    })
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _set_pagado_el(rid: str, pagado_el: str):
    import config as appconfig
    from motor.motor_asyncio import AsyncIOMotorClient

    async def _go():
        c = AsyncIOMotorClient(appconfig.MONGO_URL)
        await c[appconfig.DB_NAME]["rental_reservations"].update_one(
            {"_id": rid}, {"$set": {"pago.estado": "pagado", "pago.pagadoEl": pagado_el}})
        c.close()
    asyncio.new_event_loop().run_until_complete(_go())


def _cleanup(pid: str, rid: str):
    requests.delete(f"{API}/reservations/{rid}")
    requests.delete(f"{API}/properties/{pid}")


@pytest.fixture
def vencida():
    """Reserva con seña cobrada hace 12 días, sin liquidar."""
    pid = _mk_prop("TEST_recordatorio_vencida")
    rid = _mk_res(pid, "2026-12-01", "2026-12-06")
    _set_pagado_el(rid, "2026-11-01T10:00:00+00:00")
    yield pid, rid
    _cleanup(pid, rid)


@pytest.fixture
def reciente():
    """Reserva con seña cobrada hoy mismo, sin liquidar (no debe aparecer como vencida a 7 días)."""
    pid = _mk_prop("TEST_recordatorio_reciente")
    rid = _mk_res(pid, "2026-12-10", "2026-12-15")
    yield pid, rid
    _cleanup(pid, rid)


def test_aparece_si_pasaron_mas_de_7_dias(vencida):
    pid, rid = vencida
    r = requests.get(f"{API}/liquidaciones/pendientes", params={"dias": 7})
    assert r.status_code == 200
    ids = [x["reservaId"] for x in r.json()]
    assert rid in ids
    item = next(x for x in r.json() if x["reservaId"] == rid)
    assert item["propertyId"] == pid
    assert item["diasSinLiquidar"] >= 7


def test_no_aparece_si_es_reciente(reciente):
    _, rid = reciente
    r = requests.get(f"{API}/liquidaciones/pendientes", params={"dias": 7})
    ids = [x["reservaId"] for x in r.json()]
    assert rid not in ids


def test_desaparece_al_marcar_pagada(vencida):
    pid, rid = vencida
    r = requests.get(f"{API}/liquidaciones/pendientes", params={"dias": 7})
    assert rid in [x["reservaId"] for x in r.json()]
    neto = requests.get(f"{API}/reservations/{rid}/liquidacion").json()["netoPropietario"]
    requests.post(f"{API}/reservations/{rid}/liquidacion/pagos", data={"monto": str(neto), "metodo": "efectivo"})
    r2 = requests.get(f"{API}/liquidaciones/pendientes", params={"dias": 7})
    assert rid not in [x["reservaId"] for x in r2.json()]


def test_dias_parametro_mas_estricto_la_excluye(vencida):
    _, rid = vencida
    # con un umbral de 60 días, una reserva vencida hace ~12 días no debería contar
    r = requests.get(f"{API}/liquidaciones/pendientes", params={"dias": 60})
    assert rid not in [x["reservaId"] for x in r.json()]
