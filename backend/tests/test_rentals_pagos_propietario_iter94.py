"""Iter94: fixes post-iter93 — PDF con notas/fecha/método, migración lazy del pago legado
(con/sin comprobante, coexistencia legado+nuevos, idempotencia ante GETs concurrentes),
DELETE 404s, pendientes con totalPagadoPropietario."""
from __future__ import annotations

import io
import os
from concurrent.futures import ThreadPoolExecutor

import pytest
import requests
from pymongo import MongoClient
from pypdf import PdfReader

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api/rentals"


def _col():
    return MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]["rental_reservations"]


def _pdf_text(content: bytes) -> str:
    return "\n".join(p.extract_text() or "" for p in PdfReader(io.BytesIO(content)).pages)


def _liq(rid):
    r = requests.get(f"{API}/reservations/{rid}/liquidacion")
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture
def res():
    p = requests.post(f"{API}/properties", json={"titulo": "TEST_iter94_pagos", "tipo": "casa", "precioNoche": 1000})
    assert p.status_code == 201, p.text
    pid = p.json()["id"]
    r = requests.post(f"{API}/reservations/manual", json={
        "propertyId": pid, "nombre": "TEST iter94", "checkIn": "2026-12-01", "checkOut": "2026-12-05", "montoTotal": 180000})
    assert r.status_code == 201, r.text
    rid = r.json()["id"]
    _col().update_one({"_id": rid}, {"$set": {"pago.estado": "pagado", "pago.pagadoEl": "2026-10-20T10:00:00+00:00"}})
    yield pid, rid
    requests.delete(f"{API}/reservations/{rid}")
    requests.delete(f"{API}/properties/{pid}")


# PDF: método capitalizado, notas, fecha dd/mm/yyyy
def test_pdf_muestra_notas_fecha_metodo(res):
    _, rid = res
    r = requests.post(f"{API}/reservations/{rid}/liquidacion/pagos",
                      data={"monto": "60000", "metodo": "cheque", "fecha": "2026-12-11", "notas": "Nota QA"})
    assert r.status_code == 200, r.text
    txt = _pdf_text(requests.get(f"{API}/reservations/{rid}/liquidacion/pdf").content)
    assert "Cheque" in txt and "Nota QA" in txt and "Pagado el 11/12/2026" in txt
    assert "Saldo pendiente de pago" in txt


# Migración lazy con comprobante embebido + no duplica en lecturas concurrentes
def test_migracion_concurrente_no_duplica(res):
    _, rid = res
    _col().update_one({"_id": rid}, {"$set": {"pagoPropietario": {
        "estado": "pagado", "monto": 30000, "metodo": "efectivo", "fecha": "2026-10-05", "notas": "TEST legado conc",
        "comprobante": {"bucket": "test-bucket", "object_path": "rentals/test/legado94.jpg", "contentType": "image/jpeg"},
        "pagadoEl": "2026-10-05T10:00:00+00:00"}}})
    with ThreadPoolExecutor(max_workers=6) as ex:
        list(ex.map(lambda _: requests.get(f"{API}/reservations/{rid}/liquidacion"), range(6)))
    doc = _col().find_one({"_id": rid})
    n_pagos = len(doc.get("pagosPropietario") or [])
    n_comp = len([c for c in (doc.get("comprobantes") or []) if c.get("object_path") == "rentals/test/legado94.jpg"])
    print("pagos tras GETs concurrentes:", n_pagos, "comprobantes:", n_comp)
    assert "pagoPropietario" not in doc
    assert n_pagos == 1, f"Migración duplicada por concurrencia: {n_pagos} pagos"
    assert n_comp == 1
    liq = _liq(rid)
    assert liq["totalPagadoPropietario"] == 30000


# Legado + pagos nuevos coexistiendo (cargados con iter93 antes del fix): no debe perderse el legado
def test_legado_coexistiendo_con_pagos_nuevos(res):
    pid, rid = res
    _col().update_one({"_id": rid}, {"$set": {
        "pagoPropietario": {"estado": "pagado", "monto": 100000, "metodo": "cheque", "fecha": "2026-10-01",
                            "notas": "TEST legado coex", "comprobante": None},
        "pagosPropietario": [{"id": "TESTnuevo94", "monto": 50000, "metodo": "efectivo", "fecha": "2026-11-01",
                              "notas": None, "comprobanteId": None}]}})
    liq = _liq(rid)
    ids = [p["id"] for p in liq["pagosPropietario"]]
    total_listado = sum(p["monto"] for p in liq["pagosPropietario"])
    print("ids:", ids, "total:", liq["totalPagadoPropietario"], "suma listado:", total_listado)
    # el total y la lista deben ser coherentes (lo que se suma, se ve y se puede borrar)
    assert total_listado == liq["totalPagadoPropietario"], (
        f"Inconsistencia: lista suma {total_listado} pero total={liq['totalPagadoPropietario']}")


def test_delete_404s(res):
    _, rid = res
    assert requests.delete(f"{API}/reservations/{rid}/liquidacion/pagos/no-existe").status_code == 404
    assert requests.delete(f"{API}/reservations/{rid}/liquidacion/pagos/legado").status_code == 404
    assert requests.delete(f"{API}/reservations/nope94/liquidacion/pagos/x").status_code == 404


def test_pendientes_total_pagado(res):
    _, rid = res
    requests.post(f"{API}/reservations/{rid}/liquidacion/pagos", data={"monto": "40000", "metodo": "transferencia"})
    items = requests.get(f"{API}/liquidaciones/pendientes", params={"dias": 7}).json()
    it = next((x for x in items if x["reservaId"] == rid), None)
    assert it is not None
    assert it["totalPagadoPropietario"] == 40000 and it["estadoLiquidacion"] == "parcial"
    assert it["saldoLiquidacion"] == _liq(rid)["saldoLiquidacion"]
