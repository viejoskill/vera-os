# Rentals: PATCH /reservations/{rid}/fechas (reprogramar) + contrato cláusula CUARTA sin frase condicional (iteration_86)
import io
import os
import pytest
import requests
from pypdf import PdfReader

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
API = f"{BASE_URL}/api/rentals"
PROP_ID = "6744cf8a907f4a239a7504101c66a2df"  # A161
ACTOR = "qa_varela@vera.test"


@pytest.fixture(scope="module")
def s():
    return requests.Session()


@pytest.fixture(scope="module")
def created(s):
    ids = []
    yield ids
    for rid in ids:
        s.delete(f"{API}/reservations/{rid}")


def _create(s, created, ci, co, nombre="TEST_Fechas"):
    r = s.post(f"{API}/reservations", json={"propertyId": PROP_ID, "nombre": nombre,
                                             "checkIn": ci, "checkOut": co, "estado": "prereserva"})
    assert r.status_code in (200, 201), r.text
    created.append(r.json()["id"])
    return r.json()


def _block(s, created, ci, co):
    r = s.post(f"{API}/blocks", json={"propertyId": PROP_ID, "checkIn": ci, "checkOut": co, "motivo": "TEST_block"})
    assert r.status_code in (200, 201), r.text
    created.append(r.json()["id"])
    return r.json()


# Move to free range -> nights recalculated, persisted, historial logged
def test_move_to_free_dates(s, created):
    r = _create(s, created, "2028-04-10", "2028-04-13")
    resp = s.patch(f"{API}/reservations/{r['id']}/fechas",
                   json={"checkIn": "2028-04-20", "checkOut": "2028-04-25", "actorEmail": ACTOR})
    assert resp.status_code == 200, resp.text
    d = resp.json()
    assert d["checkIn"] == "2028-04-20" and d["checkOut"] == "2028-04-25" and d["noches"] == 5
    g = s.get(f"{API}/reservations/{r['id']}").json()
    assert g["checkIn"] == "2028-04-20" and g["noches"] == 5
    campos = {h["campo"]: h for h in g["historial"]}
    assert campos["Check-in"]["anterior"] == "2028-04-10" and campos["Check-in"]["nuevo"] == "2028-04-20"
    assert campos["Check-out"]["anterior"] == "2028-04-13" and campos["Check-out"]["nuevo"] == "2028-04-25"
    assert campos["Check-in"]["usuario"] == ACTOR
    # calendar reflects
    cal = s.get(f"{API}/properties/{PROP_ID}/calendar").json()["ocupados"]
    assert any(o["checkIn"] == "2028-04-20" and o["checkOut"] == "2028-04-25" for o in cal)
    assert not any(o["checkIn"] == "2028-04-10" and o["checkOut"] == "2028-04-13" for o in cal)


# Overlap with own dates allowed (self-excluded); same dates -> no new historial entries
def test_self_overlap_and_same_dates(s, created):
    r = _create(s, created, "2028-05-10", "2028-05-15")
    resp = s.patch(f"{API}/reservations/{r['id']}/fechas", json={"checkIn": "2028-05-12", "checkOut": "2028-05-17", "actorEmail": ACTOR})
    assert resp.status_code == 200, resp.text
    assert resp.json()["noches"] == 5
    n_hist = len(resp.json()["historial"])
    resp2 = s.patch(f"{API}/reservations/{r['id']}/fechas", json={"checkIn": "2028-05-12", "checkOut": "2028-05-17", "actorEmail": ACTOR})
    assert resp2.status_code == 200
    assert len(resp2.json()["historial"]) == n_hist


# Clash with another reservation -> 409, not modified
def test_clash_other_reservation(s, created):
    a = _create(s, created, "2028-06-01", "2028-06-05")
    b = _create(s, created, "2028-06-10", "2028-06-14")
    resp = s.patch(f"{API}/reservations/{b['id']}/fechas", json={"checkIn": "2028-06-03", "checkOut": "2028-06-08"})
    assert resp.status_code == 409
    assert "no están disponibles" in resp.json()["detail"]
    g = s.get(f"{API}/reservations/{b['id']}").json()
    assert g["checkIn"] == "2028-06-10" and g["checkOut"] == "2028-06-14" and g["historial"] == []
    # Adjacent (checkOut == other checkIn) allowed
    resp = s.patch(f"{API}/reservations/{b['id']}/fechas", json={"checkIn": "2028-06-05", "checkOut": "2028-06-09"})
    assert resp.status_code == 200, resp.text


# Clash with a block -> 409
def test_clash_block(s, created):
    _block(s, created, "2028-07-01", "2028-07-05")
    r = _create(s, created, "2028-07-10", "2028-07-12")
    resp = s.patch(f"{API}/reservations/{r['id']}/fechas", json={"checkIn": "2028-07-04", "checkOut": "2028-07-06"})
    assert resp.status_code == 409


# checkOut <= checkIn -> 400
def test_invalid_range(s, created):
    r = _create(s, created, "2028-08-10", "2028-08-12")
    for ci, co in (("2028-08-15", "2028-08-15"), ("2028-08-15", "2028-08-13")):
        resp = s.patch(f"{API}/reservations/{r['id']}/fechas", json={"checkIn": ci, "checkOut": co})
        assert resp.status_code == 400, resp.text


# Malformed date -> should not be 500
def test_malformed_date(s, created):
    r = _create(s, created, "2028-09-10", "2028-09-12")
    resp = s.patch(f"{API}/reservations/{r['id']}/fechas", json={"checkIn": "foo", "checkOut": "2028-09-12"})
    assert resp.status_code in (400, 422), f"got {resp.status_code}"


# Not found -> 404
def test_not_found(s):
    resp = s.patch(f"{API}/reservations/doesnotexist123/fechas", json={"checkIn": "2028-01-01", "checkOut": "2028-01-03"})
    assert resp.status_code == 404


# Contract PDF CUARTA: 'por la limpieza.' and no conditional phrase
def test_contrato_cuarta(s, created):
    r = _create(s, created, "2028-10-10", "2028-10-14", nombre="TEST_Contrato")
    resp = s.get(f"{API}/reservations/{r['id']}/documento/contrato")
    assert resp.status_code == 200, resp.text[:300]
    assert resp.content[:4] == b"%PDF"
    text = " ".join(p.extract_text() or "" for p in PdfReader(io.BytesIO(resp.content)).pages)
    flat = " ".join(text.split())
    assert "CUARTA" in flat
    assert "por la limpieza." in flat
    assert "perfecto estado" in flat  # first sentence still there
    assert "si no se encontrara en perfecto estado" not in flat.lower()
    assert "no se encontrara" not in flat.lower()
