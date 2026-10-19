# Rentals: short-stay 5% surcharge in quote/prereserva + manual monto PATCH
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
SLUG = "casa-de-prueba-costa-del-este-borrar-d79b0a"
API = f"{BASE_URL}/api/rentals"


@pytest.fixture(scope="module")
def prop():
    r = requests.get(f"{API}/public/properties/{SLUG}")
    assert r.status_code == 200, r.text
    return r.json()


def _quote(slug, ci, co):
    return requests.get(f"{API}/public/quote", params={"slug": slug, "checkIn": ci, "checkOut": co})


# Quote: short stay applies +5%
@pytest.mark.parametrize("ci,co,n", [("2026-11-02", "2026-11-03", 1), ("2026-11-02", "2026-11-05", 3), ("2026-11-02", "2026-11-08", 6)])
def test_quote_short_stay(prop, ci, co, n):
    r = _quote(SLUG, ci, co)
    assert r.status_code == 200, r.text
    q = r.json()
    assert q["noches"] == n
    assert q["recargoPct"] == 5.0
    assert q["total"] == round(25000 * n * 1.05)


# Quote: 7+ nights no surcharge
@pytest.mark.parametrize("ci,co,n", [("2026-11-02", "2026-11-09", 7), ("2026-11-02", "2026-11-12", 10)])
def test_quote_long_stay(prop, ci, co, n):
    q = _quote(SLUG, ci, co).json()
    assert q["noches"] == n
    assert q["recargoPct"] == 0.0
    assert q["total"] == 25000 * n


# Prereserva stores surcharge + PATCH monto persists; cleanup
def test_prereserva_and_monto_flow(prop):
    body = {"nombre": "TEST_ShortStay", "telefono": "1100000000", "email": "test_ss@vera.test", "dni": "1",
            "huespedes": 2, "comentario": "TEST", "checkIn": "2026-11-16", "checkOut": "2026-11-19",
            "origen": "Directo", "aceptaCondiciones": True}
    r = requests.post(f"{API}/public/properties/{SLUG}/prereserva", json=body)
    assert r.status_code == 201, r.text
    rid = r.json()["reservaId"]
    try:
        assert r.json()["total"] == 78750
        lst = requests.get(f"{API}/reservations", params={"propertyId": prop["id"]}).json()
        row = next(x for x in lst if x["id"] == rid)
        assert row["montoEstimado"] == 78750
        assert row["estado"] == "prereserva"
        p = requests.patch(f"{API}/reservations/{rid}/monto", json={"monto": 75000})
        assert p.status_code == 200, p.text
        assert p.json()["montoEstimado"] == 75000
        got = requests.get(f"{API}/reservations/{rid}").json()
        assert got["montoEstimado"] == 75000
        # huesped patch must not overwrite monto
        h = requests.patch(f"{API}/reservations/{rid}/huesped", json={"nombre": "TEST_ShortStay2", "huespedes": 2})
        assert h.status_code == 200, h.text
        got = requests.get(f"{API}/reservations/{rid}").json()
        assert got["montoEstimado"] == 75000
        assert got["huesped"]["nombre"] == "TEST_ShortStay2"
    finally:
        requests.delete(f"{API}/reservations/{rid}")
    assert requests.get(f"{API}/reservations/{rid}").status_code == 404


def test_monto_404():
    r = requests.patch(f"{API}/reservations/doesnotexist123/monto", json={"monto": 1})
    assert r.status_code == 404


def test_monto_validation():
    r = requests.patch(f"{API}/reservations/doesnotexist123/monto", json={"monto": "abc"})
    assert r.status_code == 422
