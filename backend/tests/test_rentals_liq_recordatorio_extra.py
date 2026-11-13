"""Iter92: extra checks for /liquidaciones/pendientes (recordatorio) + interacción con marcar-pagada."""
import os
import sys

import pytest
import requests

sys.path.insert(0, os.path.dirname(__file__))
from test_rentals_liquidaciones_pendientes import _mk_prop, _mk_res, _set_pagado_el, _cleanup, API  # noqa

A161 = "6744cf8a907f4a239a7504101c66a2df"


def _ids(dias=7):
    r = requests.get(f"{API}/liquidaciones/pendientes", params={"dias": dias})
    assert r.status_code == 200, r.text
    return r.json()


# Validation of dias param
def test_dias_cero_rechazado():
    assert requests.get(f"{API}/liquidaciones/pendientes", params={"dias": 0}).status_code == 422


# Default dias=7 returns the 4 A161 fixtures with full shape
def test_default_incluye_a161():
    r = requests.get(f"{API}/liquidaciones/pendientes")
    assert r.status_code == 200
    a161 = [x for x in r.json() if x["propertyId"] == A161]
    assert len(a161) >= 4
    keys = {"reservaId", "propertyId", "propertyCodigo", "propertyTitulo", "huesped",
            "checkIn", "checkOut", "pagadoEl", "diasSinLiquidar"}
    for x in a161:
        assert keys <= set(x)
        assert x["propertyCodigo"] == "A161"
        assert isinstance(x["diasSinLiquidar"], int) and x["diasSinLiquidar"] > 7


# Robustness: pagadoEl naive / date-only should not crash endpoint
@pytest.mark.parametrize("pagado_el", ["2026-01-02T10:00:00", "2026-01-02", "2026-01-02T10:00:00Z"])
def test_formatos_pagadoel_no_rompen(pagado_el):
    pid = _mk_prop("TEST_recordatorio_fmt")
    rid = _mk_res(pid, "2026-12-20", "2026-12-22")
    try:
        _set_pagado_el(rid, pagado_el)
        r = requests.get(f"{API}/liquidaciones/pendientes")
        assert r.status_code == 200, f"{pagado_el}: {r.status_code} {r.text[:200]}"
        assert rid in [x["reservaId"] for x in r.json()]
    finally:
        _cleanup(pid, rid)
