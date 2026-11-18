"""Liquidaciones al propietario: retención automática de comisión al cargar un pago a
partir de una seña bruta cobrada al huésped. Ejemplo real de referencia (del pedido del
usuario): alquiler $1.617.000, comisión 18% ($291.060), neto a liquidar $1.325.940.
Seña bruta $808.500 -> comisión 18% = $145.530 -> neto transferido al propietario $662.970."""
from __future__ import annotations

import io
import os

import pytest
import requests
from pypdf import PdfReader

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api/rentals"


def _pdf_text(content: bytes) -> str:
    return "\n".join(p.extract_text() or "" for p in PdfReader(io.BytesIO(content)).pages)


def _mk_prop(titulo: str, comision_pct: float = 18) -> str:
    r = requests.post(f"{API}/properties", json={"titulo": titulo, "tipo": "casa", "precioNoche": 1000, "comisionPct": comision_pct})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _mk_res_confirmada(pid: str, monto: float, ci="2026-12-01", co="2026-12-06") -> str:
    r = requests.post(f"{API}/reservations/manual", json={
        "propertyId": pid, "nombre": "TEST comision retenida", "checkIn": ci, "checkOut": co, "montoTotal": monto,
    })
    assert r.status_code == 201, r.text
    rid = r.json()["id"]
    s = requests.patch(f"{API}/reservations/{rid}", json={"estado": "confirmada"})
    assert s.status_code == 200, s.text
    return rid


def _cleanup(pid: str, rid: str | None = None):
    if rid:
        requests.delete(f"{API}/reservations/{rid}")
    requests.delete(f"{API}/properties/{pid}")


@pytest.fixture
def reserva_1617k():
    """Reserva del ejemplo real del pedido: $1.617.000, comisión 18%."""
    pid = _mk_prop("TEST_comision_1617k", comision_pct=18)
    rid = _mk_res_confirmada(pid, 1617000)
    yield pid, rid
    _cleanup(pid, rid)


def test_comision_total_generada_al_confirmar(reserva_1617k):
    _, rid = reserva_1617k
    liq = requests.get(f"{API}/reservations/{rid}/liquidacion").json()
    assert liq["comision"] == 291060
    assert liq["netoPropietario"] == 1325940
    assert liq["comisionRetenida"] == 0 and liq["comisionPendiente"] == 291060
    assert liq["comisionPctEfectivo"] == 18


def test_pago_con_descuento_de_comision_calcula_neto_correcto(reserva_1617k):
    """Ejemplo exacto del pedido: bruto 808.500 -> retiene 145.530 (18%) -> neto 662.970."""
    _, rid = reserva_1617k
    r = requests.post(f"{API}/reservations/{rid}/liquidacion/pagos", data={
        "montoBruto": "808500", "descuentaComision": "true", "metodo": "transferencia", "fecha": "2026-10-20",
    })
    assert r.status_code == 200, r.text
    pago = r.json()["pagosPropietario"][0]
    assert pago["montoBruto"] == 808500
    assert pago["comisionPct"] == 18
    assert pago["comisionRetenida"] == 145530
    assert pago["monto"] == 662970  # neto
    assert pago["descuentaComision"] is True

    liq = requests.get(f"{API}/reservations/{rid}/liquidacion").json()
    assert liq["totalPagadoPropietario"] == 662970
    assert liq["saldoLiquidacion"] == 1325940 - 662970
    assert liq["comisionRetenida"] == 145530
    assert liq["comisionPendiente"] == 291060 - 145530


def test_pago_sin_descontar_comision_toma_bruto_como_neto(reserva_1617k):
    _, rid = reserva_1617k
    r = requests.post(f"{API}/reservations/{rid}/liquidacion/pagos", data={
        "montoBruto": "100000", "descuentaComision": "false", "metodo": "efectivo",
    })
    assert r.status_code == 200, r.text
    pago = r.json()["pagosPropietario"][0]
    assert pago["comisionRetenida"] == 0
    assert pago["monto"] == 100000
    assert pago["descuentaComision"] is False
    liq = requests.get(f"{API}/reservations/{rid}/liquidacion").json()
    assert liq["comisionRetenida"] == 0 and liq["comisionPendiente"] == 291060


def test_comision_retenida_no_supera_la_comision_total(reserva_1617k):
    """Si el % de comisión de la reserva se negocia a la baja (vía 'Ajustar movimientos')
    DESPUÉS de haber retenido comisión en un primer pago, un segundo pago puede calcular
    una comisión mayor a la que realmente queda pendiente. Debe limitarse al saldo de
    comisión pendiente y avisar con `comisionWarning`, sin que la retención total supere
    nunca la comisión (ya reducida) de la reserva."""
    _, rid = reserva_1617k
    r1 = requests.post(f"{API}/reservations/{rid}/liquidacion/pagos", data={
        "montoBruto": "200000", "descuentaComision": "true", "metodo": "transferencia",
    })
    assert r1.status_code == 200, r1.text
    assert "comisionWarning" not in r1.json()
    liq1 = requests.get(f"{API}/reservations/{rid}/liquidacion").json()
    assert liq1["comisionRetenida"] == 36000  # 18% de 200.000

    # Se negocia una comisión más baja (5%) para el resto de la reserva.
    comision_mid = next(m["id"] for m in liq1["movimientos"] if m["tipo"] == "comision")
    e = requests.put(f"{API}/movimientos/{comision_mid}", json={"comisionPct": 5})
    assert e.status_code == 200, e.text
    liq_mid = requests.get(f"{API}/reservations/{rid}/liquidacion").json()
    assert liq_mid["comision"] == 80850  # 5% de 1.617.000
    pendiente_tras_1 = liq_mid["comisionPendiente"]
    assert pendiente_tras_1 == 80850 - 36000  # 44.850

    r2 = requests.post(f"{API}/reservations/{rid}/liquidacion/pagos", data={
        "montoBruto": "1000000", "descuentaComision": "true", "metodo": "transferencia",
    })
    assert r2.status_code == 200, r2.text
    assert r2.json().get("comisionWarning")  # se avisó que se limitó la retención
    pago2 = r2.json()["pagosPropietario"][1]
    assert pago2["comisionRetenida"] == pendiente_tras_1  # limitado al saldo pendiente, no al 5% de 1.000.000 (50.000)
    assert pago2["monto"] == 1000000 - pendiente_tras_1  # neto

    liq2 = requests.get(f"{API}/reservations/{rid}/liquidacion").json()
    assert liq2["comisionRetenida"] == 80850  # suma total = comisión (ya reducida) de la reserva, nunca más
    assert liq2["comisionPendiente"] == 0


def test_pago_no_puede_superar_el_saldo_pendiente(reserva_1617k):
    """Si el neto de un pago (bruto menos la comisión retenida) supera lo que todavía falta
    liquidarle al propietario, se rechaza con 400 en vez de aceptar un sobrepago silencioso."""
    _, rid = reserva_1617k
    # Neto a liquidar: 1.325.940. Un bruto de 2.000.000 sin descontar comisión da un neto
    # (2.000.000) muy por encima de eso.
    r = requests.post(f"{API}/reservations/{rid}/liquidacion/pagos", data={
        "montoBruto": "2000000", "descuentaComision": "false", "metodo": "transferencia",
    })
    assert r.status_code == 400, r.text
    assert "saldo pendiente" in r.json()["detail"]
    # No debe haber quedado registrado ningún pago.
    liq = requests.get(f"{API}/reservations/{rid}/liquidacion").json()
    assert liq["pagosPropietario"] == []


def test_comision_pendiente_en_cero_si_se_liquida_completo_sin_descontar(reserva_1617k):
    """Si se liquida el NETO completo sin tildar 'descontar comisión' (p.ej. porque la
    comisión ya se cobró aparte), la comisión no debe quedar mostrada como 'pendiente' para
    siempre: la liquidación ya está completa."""
    _, rid = reserva_1617k
    r = requests.post(f"{API}/reservations/{rid}/liquidacion/pagos", data={
        "montoBruto": "1325940", "descuentaComision": "false", "metodo": "transferencia",
    })
    assert r.status_code == 200, r.text
    liq = requests.get(f"{API}/reservations/{rid}/liquidacion").json()
    assert liq["estadoLiquidacion"] == "pagado"
    assert liq["comisionPendiente"] == 0


def test_borrar_pago_revierte_comision_retenida(reserva_1617k):
    _, rid = reserva_1617k
    r = requests.post(f"{API}/reservations/{rid}/liquidacion/pagos", data={
        "montoBruto": "808500", "descuentaComision": "true", "metodo": "transferencia",
    })
    pago_id = r.json()["pagosPropietario"][0]["id"]
    liq1 = requests.get(f"{API}/reservations/{rid}/liquidacion").json()
    assert liq1["comisionRetenida"] == 145530

    d = requests.delete(f"{API}/reservations/{rid}/liquidacion/pagos/{pago_id}")
    assert d.status_code == 204
    liq2 = requests.get(f"{API}/reservations/{rid}/liquidacion").json()
    assert liq2["comisionRetenida"] == 0 and liq2["comisionPendiente"] == 291060
    assert liq2["pagosPropietario"] == []


def test_movimientos_no_incluyen_la_comision_cruda_sin_romper_total(reserva_1617k):
    """El movimiento 'comision' auto-generado sigue existiendo y sumando al total (no se
    toca), el frontend es quien arma la vista desglosada a partir de comisionRetenida."""
    _, rid = reserva_1617k
    liq = requests.get(f"{API}/reservations/{rid}/liquidacion").json()
    comision_movs = [m for m in liq["movimientos"] if m["tipo"] == "comision"]
    assert len(comision_movs) == 1 and comision_movs[0]["monto"] == 291060


def test_pdf_detalla_bruto_comision_y_neto_de_cada_pago(reserva_1617k):
    _, rid = reserva_1617k
    requests.post(f"{API}/reservations/{rid}/liquidacion/pagos", data={
        "montoBruto": "808500", "descuentaComision": "true", "metodo": "transferencia", "fecha": "2026-10-20",
    })
    pdf = _pdf_text(requests.get(f"{API}/reservations/{rid}/liquidacion/pdf").content)
    assert "808.500" in pdf  # bruto
    assert "145.530" in pdf  # comisión retenida (en el pago y en el resumen)
    assert "662.970" in pdf  # neto transferido
    assert "Comisión pendiente de retener" in pdf
    assert "Total pagado al propietario" in pdf and "Saldo pendiente a pagar" in pdf


def test_monto_bruto_invalido_rechazado(reserva_1617k):
    _, rid = reserva_1617k
    assert requests.post(f"{API}/reservations/{rid}/liquidacion/pagos", data={"montoBruto": "0", "metodo": "efectivo"}).status_code == 400
    assert requests.post(f"{API}/reservations/{rid}/liquidacion/pagos", data={"montoBruto": "-100", "metodo": "efectivo"}).status_code == 400
