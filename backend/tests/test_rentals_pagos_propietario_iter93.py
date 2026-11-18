"""Iter93: pagos múltiples al propietario (pagosPropietario lista), caso real 180k = 100k + 80k,
borrado puntual, comprobante borrado, compat legado (pagoPropietario singular), endpoints viejos
eliminados, PDF con lista de pagos y labels capitalizados, pendientes con 'parcial'."""
from __future__ import annotations

import asyncio
import io
import os
import sys

import pytest
import requests
from pypdf import PdfReader

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api/rentals"
sys.path.insert(0, "/app/backend")


def _mongo(rid: str, update: dict):
    import config as appconfig
    from motor.motor_asyncio import AsyncIOMotorClient

    async def _go():
        c = AsyncIOMotorClient(appconfig.MONGO_URL)
        await c[appconfig.DB_NAME]["rental_reservations"].update_one({"_id": rid}, update)
        c.close()
    asyncio.new_event_loop().run_until_complete(_go())


def _pdf_text(content: bytes) -> str:
    return "\n".join(p.extract_text() or "" for p in PdfReader(io.BytesIO(content)).pages)


@pytest.fixture
def res180():
    """Reserva TEST con neto = 180.000 (sin comisión/gastos)."""
    p = requests.post(f"{API}/properties", json={"titulo": "TEST_iter93_pagos", "tipo": "casa", "precioNoche": 1000})
    assert p.status_code == 201, p.text
    pid = p.json()["id"]
    r = requests.post(f"{API}/reservations/manual", json={
        "propertyId": pid, "nombre": "TEST iter93", "checkIn": "2026-11-01", "checkOut": "2026-11-05", "montoTotal": 180000})
    assert r.status_code == 201, r.text
    rid = r.json()["id"]
    _mongo(rid, {"$set": {"pago.estado": "pagado", "pago.pagadoEl": "2026-10-20T10:00:00+00:00"}})
    yield pid, rid
    requests.delete(f"{API}/reservations/{rid}")
    requests.delete(f"{API}/properties/{pid}")


def _liq(rid):
    r = requests.get(f"{API}/reservations/{rid}/liquidacion")
    assert r.status_code == 200, r.text
    return r.json()


# Caso central del bug: 100k parcial + 80k => pagado, ambos en historial
def test_caso_central_180k(res180):
    pid, rid = res180
    liq = _liq(rid)
    neto = liq["netoPropietario"]
    print("neto", neto)
    r1 = requests.post(f"{API}/reservations/{rid}/liquidacion/pagos",
                       data={"montoBruto": "100000", "metodo": "transferencia", "fecha": "2026-11-10", "notas": "TEST transf"})
    assert r1.status_code == 200, r1.text
    liq = _liq(rid)
    assert liq["estadoLiquidacion"] == ("parcial" if neto > 100000 else "pagado")
    assert liq["saldoLiquidacion"] == max(neto - 100000, 0)
    assert len(liq["pagosPropietario"]) == 1
    r2 = requests.post(f"{API}/reservations/{rid}/liquidacion/pagos",
                       data={"montoBruto": str(neto - 100000), "metodo": "efectivo", "notas": "TEST efvo"})
    assert r2.status_code == 200
    assert len(r2.json()["pagosPropietario"]) == 2
    liq = _liq(rid)
    assert liq["estadoLiquidacion"] == "pagado"
    assert liq["saldoLiquidacion"] == 0
    assert liq["totalPagadoPropietario"] == neto
    assert [p["metodo"] for p in liq["pagosPropietario"]] == ["transferencia", "efectivo"]
    assert liq["pagosPropietario"][0]["fecha"] == "2026-11-10"
    assert liq["pagosPropietario"][1]["fecha"]  # default hoy AR
    # liquidables
    L = requests.get(f"{API}/properties/{pid}/liquidables").json()
    it = next(x for x in L if x["id"] == rid)
    assert it["estadoLiquidacion"] == "pagado" and it["saldoLiquidacion"] == 0
    # PDF
    pdf = requests.get(f"{API}/reservations/{rid}/liquidacion/pdf")
    assert pdf.status_code == 200
    txt = _pdf_text(pdf.content)
    assert "Transferencia" in txt and "Efectivo" in txt and "Liquidación completa" in txt
    # sobrepago: se rechaza (la liquidación ya está completa, no se acepta un pago de más)
    over = requests.post(f"{API}/reservations/{rid}/liquidacion/pagos", data={"montoBruto": "5000", "metodo": "cheque"})
    assert over.status_code == 400, over.text
    liq = _liq(rid)
    assert liq["saldoLiquidacion"] == 0 and liq["estadoLiquidacion"] == "pagado"
    assert "Cheque" not in _pdf_text(requests.get(f"{API}/reservations/{rid}/liquidacion/pdf").content)


# Borrado puntual + comprobante 404 después
def test_borrar_pago_con_comprobante(res180):
    _, rid = res180
    a = requests.post(f"{API}/reservations/{rid}/liquidacion/pagos", data={"montoBruto": "50000", "metodo": "otro"},
                      files={"file": ("c.jpg", b"\xff\xd8\xff\xe0TESTJPEG", "image/jpeg")})
    assert a.status_code == 200, a.text
    b = requests.post(f"{API}/reservations/{rid}/liquidacion/pagos", data={"montoBruto": "20000", "metodo": "cheque"})
    pagos = b.json()["pagosPropietario"]
    pa = pagos[0]
    assert pa["comprobanteId"]
    cid = pa["comprobanteId"]
    assert requests.get(f"{API}/reservations/{rid}/comprobantes/{cid}").status_code == 200
    d = requests.delete(f"{API}/reservations/{rid}/liquidacion/pagos/{pa['id']}")
    assert d.status_code == 204
    liq = _liq(rid)
    assert len(liq["pagosPropietario"]) == 1 and liq["pagosPropietario"][0]["id"] == pagos[1]["id"]
    assert liq["totalPagadoPropietario"] == 20000 and liq["estadoLiquidacion"] == "parcial"
    assert requests.get(f"{API}/reservations/{rid}/comprobantes/{cid}").status_code == 404
    pdf = _pdf_text(requests.get(f"{API}/reservations/{rid}/liquidacion/pdf").content)
    assert "Saldo pendiente a pagar" in pdf and "Cheque" in pdf


def test_validaciones(res180):
    _, rid = res180
    assert requests.post(f"{API}/reservations/{rid}/liquidacion/pagos", data={"montoBruto": "100", "metodo": "bitcoin"}).status_code == 400
    assert requests.post(f"{API}/reservations/{rid}/liquidacion/pagos", data={"montoBruto": "0", "metodo": "efectivo"}).status_code == 400
    assert requests.post(f"{API}/reservations/{rid}/liquidacion/pagos", data={"montoBruto": "-5", "metodo": "efectivo"}).status_code == 400
    assert requests.post(f"{API}/reservations/{rid}/liquidacion/pagos", data={"metodo": "efectivo"}).status_code == 422
    assert requests.post(f"{API}/reservations/nope123/liquidacion/pagos", data={"montoBruto": "1", "metodo": "efectivo"}).status_code == 404
    assert _liq(rid)["pagosPropietario"] == []


def test_endpoints_viejos_no_existen(res180):
    _, rid = res180
    for path in ["liquidacion/marcar-pagada", "liquidacion/revertir", "liquidacion/pagar", "liquidacion/pago"]:
        s = requests.post(f"{API}/reservations/{rid}/{path}", data={"montoBruto": "1", "metodo": "efectivo"}).status_code
        assert s in (404, 405), (path, s)
    s = requests.get(f"{API}/reservations/{rid}/liquidacion/comprobante").status_code
    assert s in (404, 405)
    assert _liq(rid)["pagosPropietario"] == []


# Compat con el modelo viejo singular (iter94: se migra lazy a un id real al abrir el detalle)
def test_compat_legado(res180):
    pid, rid = res180
    _mongo(rid, {"$set": {"pagoPropietario": {"estado": "pagado", "monto": 100000, "metodo": "cheque",
                                               "fecha": "2026-10-01", "notas": "TEST legado", "comprobante": None,
                                               "pagadoEl": "2026-10-01T10:00:00+00:00"}}})
    liq = _liq(rid)
    assert len(liq["pagosPropietario"]) == 1 and liq["pagosPropietario"][0]["id"] != "legado"
    assert liq["pagosPropietario"][0]["comprobanteId"] is None
    assert liq["estadoLiquidacion"] == "parcial" and liq["totalPagadoPropietario"] == 100000
    migrated_id = liq["pagosPropietario"][0]["id"]
    requests.post(f"{API}/reservations/{rid}/liquidacion/pagos", data={"montoBruto": "80000", "metodo": "efectivo"})
    liq = _liq(rid)
    assert [p["id"] for p in liq["pagosPropietario"]][0] == migrated_id and len(liq["pagosPropietario"]) == 2
    assert liq["estadoLiquidacion"] == "pagado"
    L = requests.get(f"{API}/properties/{pid}/liquidables").json()
    assert next(x for x in L if x["id"] == rid)["estadoLiquidacion"] == "pagado"
    assert "Cheque" in _pdf_text(requests.get(f"{API}/reservations/{rid}/liquidacion/pdf").content)
    assert requests.delete(f"{API}/reservations/{rid}/liquidacion/pagos/legado").status_code == 404
    assert requests.delete(f"{API}/reservations/{rid}/liquidacion/pagos/{migrated_id}").status_code == 204
    liq = _liq(rid)
    assert len(liq["pagosPropietario"]) == 1
    assert liq["totalPagadoPropietario"] == 80000 and liq["estadoLiquidacion"] == "parcial"


# Recordatorio: parcial sigue apareciendo con saldo
def test_pendientes_incluye_parcial(res180):
    _, rid = res180
    _mongo(rid, {"$set": {"pago.estado": "pagado", "pago.pagadoEl": "2026-01-01T10:00:00+00:00"}})
    requests.post(f"{API}/reservations/{rid}/liquidacion/pagos", data={"montoBruto": "100000", "metodo": "transferencia"})
    items = requests.get(f"{API}/liquidaciones/pendientes", params={"dias": 7}).json()
    print("pendientes keys", items[0].keys() if items else None)
    it = next((x for x in items if x["reservaId"] == rid), None)
    assert it is not None
    neto = _liq(rid)["netoPropietario"]
    assert it["estadoLiquidacion"] == "parcial" and it["saldoLiquidacion"] == neto - 100000
    requests.post(f"{API}/reservations/{rid}/liquidacion/pagos", data={"montoBruto": str(neto - 100000), "metodo": "efectivo"})
    items = requests.get(f"{API}/liquidaciones/pendientes", params={"dias": 7}).json()
    assert rid not in [x["reservaId"] for x in items]


def test_delete_pago_inexistente(res180):
    _, rid = res180
    s = requests.delete(f"{API}/reservations/{rid}/liquidacion/pagos/noexiste").status_code
    print("DELETE pago inexistente ->", s)
    s2 = requests.delete(f"{API}/reservations/noexiste/liquidacion/pagos/noexiste").status_code
    print("DELETE reserva inexistente ->", s2)
    assert s in (204, 404) and s2 in (204, 404)
