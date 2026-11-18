"""Corrección retroactiva de comisión en pagos al propietario cargados ANTES de que la
app calculara sola bruto/comisión (quedaron con descuentaComision=false, monto=neto, sin
montoBruto). Caso real de referencia del pedido: reserva $1.617.000 a 18% de comisión,
seña $808.500, pago ya cargado como neto $662.970 (= 808.500 - 18% de 808.500)."""
from __future__ import annotations

import os
import uuid

import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api/rentals"


def _col():
    return MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]["rental_reservations"]


def _mk_prop(titulo: str, comision_pct: float = 18) -> str:
    r = requests.post(f"{API}/properties", json={"titulo": titulo, "tipo": "casa", "precioNoche": 1000, "comisionPct": comision_pct})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _mk_res_confirmada(pid: str, monto: float) -> str:
    r = requests.post(f"{API}/reservations/manual", json={
        "propertyId": pid, "nombre": "TEST backfill comision", "checkIn": "2026-12-01", "checkOut": "2026-12-06", "montoTotal": monto,
    })
    assert r.status_code == 201, r.text
    rid = r.json()["id"]
    s = requests.patch(f"{API}/reservations/{rid}", json={"estado": "confirmada"})
    assert s.status_code == 200, s.text
    return rid


def _mk_pago_legado(rid: str, neto: float, fecha="2026-10-20") -> str:
    """Simula un pago cargado ANTES del cambio: en la base real estos pagos no tienen
    montoBruto/comisionPct/comisionRetenida/descuentaComision (campos que no existían),
    solo monto (neto), metodo, fecha, notas. Se inserta directo en Mongo para reproducir
    exactamente esa forma vieja (la API de alta siempre completa esos campos, aunque sea
    con comisión en $0, así que no sirve para simular el dato legado real)."""
    pago_id = f"legado-{uuid.uuid4().hex}"
    pago = {"id": pago_id, "monto": round(neto), "metodo": "transferencia", "fecha": fecha, "notas": None, "comprobanteId": None}
    r = _col().update_one({"_id": rid}, {"$push": {"pagosPropietario": pago}})
    assert r.modified_count == 1
    return pago_id


def _cleanup(pid: str, rid: str | None = None):
    if rid:
        requests.delete(f"{API}/reservations/{rid}")
    requests.delete(f"{API}/properties/{pid}")


def test_editar_pago_legado_aplica_comision_retroactiva():
    pid = _mk_prop("TEST_backfill_1617k")
    rid = _mk_res_confirmada(pid, 1617000)
    try:
        pago_id = _mk_pago_legado(rid, 662970)
        liq0 = requests.get(f"{API}/reservations/{rid}/liquidacion").json()
        assert liq0["comisionRetenida"] == 0 and liq0["comisionPendiente"] == 291060  # antes de corregir

        e = requests.put(f"{API}/reservations/{rid}/liquidacion/pagos/{pago_id}", data={"yaTeniaComisionDescontada": "true"})
        assert e.status_code == 200, e.text
        pago = next(p for p in e.json()["pagosPropietario"] if p["id"] == pago_id)
        assert pago["montoBruto"] == 808500
        assert pago["comisionPct"] == 18
        assert pago["comisionRetenida"] == 145530
        assert pago["monto"] == 662970  # el neto pagado NO cambia
        assert pago["descuentaComision"] is True

        liq1 = requests.get(f"{API}/reservations/{rid}/liquidacion").json()
        assert liq1["comisionRetenida"] == 145530 and liq1["comisionPendiente"] == 145530
        assert liq1["totalPagadoPropietario"] == 662970  # pagado/falta no cambian
        assert liq1["saldoLiquidacion"] == 1325940 - 662970
    finally:
        _cleanup(pid, rid)


def test_editar_pago_ya_corregido_no_permite_doble_backfill():
    pid = _mk_prop("TEST_backfill_doble")
    rid = _mk_res_confirmada(pid, 1617000)
    try:
        pago_id = _mk_pago_legado(rid, 662970)
        requests.put(f"{API}/reservations/{rid}/liquidacion/pagos/{pago_id}", data={"yaTeniaComisionDescontada": "true"})
        e2 = requests.put(f"{API}/reservations/{rid}/liquidacion/pagos/{pago_id}", data={"yaTeniaComisionDescontada": "true"})
        assert e2.status_code == 400
    finally:
        _cleanup(pid, rid)


def test_editar_pago_campos_simples_sin_tocar_comision():
    pid = _mk_prop("TEST_backfill_simple")
    rid = _mk_res_confirmada(pid, 1617000)
    try:
        pago_id = _mk_pago_legado(rid, 100000)
        e = requests.put(f"{API}/reservations/{rid}/liquidacion/pagos/{pago_id}", data={
            "fecha": "2026-11-05", "metodo": "cheque", "notas": "corregido manual",
        })
        assert e.status_code == 200, e.text
        pago = next(p for p in e.json()["pagosPropietario"] if p["id"] == pago_id)
        assert pago["fecha"] == "2026-11-05" and pago["metodo"] == "cheque" and pago["notas"] == "corregido manual"
        assert pago["comisionRetenida"] == 0 and pago["descuentaComision"] is False  # no se tocó
    finally:
        _cleanup(pid, rid)


def test_lista_pagos_legado_incluye_el_pago_con_preview():
    pid = _mk_prop("TEST_backfill_lista")
    rid = _mk_res_confirmada(pid, 1617000)
    try:
        pago_id = _mk_pago_legado(rid, 662970)
        lista = requests.get(f"{API}/liquidacion/pagos-legado").json()
        item = next((x for x in lista if x["pagoId"] == pago_id), None)
        assert item is not None, "el pago legado debería aparecer en la lista para revisar"
        assert item["reservaId"] == rid
        assert item["monto"] == 662970
        assert item["montoBrutoEstimado"] == 808500
        assert item["comisionEstimada"] == 145530
        assert item["comisionPctEfectivo"] == 18
        assert item["limitado"] is False
    finally:
        _cleanup(pid, rid)


def test_aplicar_pagos_legado_solo_corrige_los_seleccionados():
    pid1 = _mk_prop("TEST_backfill_bulk_a")
    rid1 = _mk_res_confirmada(pid1, 1617000)
    pid2 = _mk_prop("TEST_backfill_bulk_b")
    rid2 = _mk_res_confirmada(pid2, 1617000)
    try:
        pago1 = _mk_pago_legado(rid1, 662970)
        pago2 = _mk_pago_legado(rid2, 662970)

        aplicar = requests.post(f"{API}/liquidacion/pagos-legado/aplicar", json={"items": [{"reservaId": rid1, "pagoId": pago1}]})
        assert aplicar.status_code == 200, aplicar.text
        assert {"reservaId": rid1, "pagoId": pago1} in aplicar.json()["aplicados"]

        liq1 = requests.get(f"{API}/reservations/{rid1}/liquidacion").json()
        assert liq1["comisionRetenida"] == 145530  # corregido

        liq2 = requests.get(f"{API}/reservations/{rid2}/liquidacion").json()
        assert liq2["comisionRetenida"] == 0  # NO se tocó, no estaba seleccionado

        lista_tras = requests.get(f"{API}/liquidacion/pagos-legado").json()
        pendientes_ids = {x["pagoId"] for x in lista_tras}
        assert pago1 not in pendientes_ids  # ya corregido, desaparece de la lista
        assert pago2 in pendientes_ids  # sigue pendiente de revisión
    finally:
        _cleanup(pid1, rid1)
        _cleanup(pid2, rid2)


def test_editar_pago_respeta_tope_de_comision_total():
    """Si al backfillear un pago su comisión calculada superaría la comisión PENDIENTE de
    la reserva (por otros pagos ya retenidos), se limita y avisa, igual que al crear —
    nunca se retiene más de lo que queda de comisión."""
    pid = _mk_prop("TEST_backfill_tope", comision_pct=18)
    rid = _mk_res_confirmada(pid, 1617000)
    try:
        r1 = requests.post(f"{API}/reservations/{rid}/liquidacion/pagos", data={
            "montoBruto": "1400000", "descuentaComision": "true", "metodo": "transferencia",
        })
        assert r1.status_code == 200, r1.text
        assert r1.json()["pagosPropietario"][0]["comisionRetenida"] == 252000  # 18% de 1.400.000

        pago2 = _mk_pago_legado(rid, 190000, fecha="2026-10-25")
        e = requests.put(f"{API}/reservations/{rid}/liquidacion/pagos/{pago2}", data={"yaTeniaComisionDescontada": "true"})
        assert e.status_code == 200, e.text
        assert e.json().get("comisionWarning")
        pago2_out = next(p for p in e.json()["pagosPropietario"] if p["id"] == pago2)
        assert pago2_out["comisionRetenida"] == 39060  # limitado al saldo pendiente (291.060-252.000)
        assert pago2_out["monto"] == 190000  # el neto no se altera

        liq_final = requests.get(f"{API}/reservations/{rid}/liquidacion").json()
        assert liq_final["comisionRetenida"] == 291060  # nunca supera la comisión total de la reserva
        assert liq_final["comisionPendiente"] == 0
    finally:
        _cleanup(pid, rid)
