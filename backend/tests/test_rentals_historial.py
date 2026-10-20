# Rentals: "Historial de cambios" + fresh GET for the "Editar datos" modal (iteration_75)
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
API = f"{BASE_URL}/api/rentals"
PROP_ID = "6744cf8a907f4a239a7504101c66a2df"  # A161
ACTOR = "qa_varela@vera.test"


@pytest.fixture(scope="module")
def s():
    return requests.Session()


def _create(s, ci, co, nombre="TEST_Hist"):
    r = s.post(f"{API}/reservations", json={"propertyId": PROP_ID, "nombre": nombre,
                                             "checkIn": ci, "checkOut": co, "estado": "prereserva"})
    assert r.status_code in (200, 201), r.text
    return r.json()


@pytest.fixture
def res(s):
    data = _create(s, "2027-03-10", "2027-03-13")
    yield data
    s.delete(f"{API}/reservations/{data['id']}")


# GET fresh reservation exposes empty historial for new reservation
def test_new_reservation_historial_empty(s, res):
    g = s.get(f"{API}/reservations/{res['id']}")
    assert g.status_code == 200
    assert g.json()["historial"] == []


# PATCH /monto creates entry with actor, anterior/nuevo
def test_monto_historial(s, res):
    old = res["montoEstimado"]
    r = s.patch(f"{API}/reservations/{res['id']}/monto", json={"monto": 123456, "actorEmail": ACTOR})
    assert r.status_code == 200
    h = r.json()["historial"]
    assert len(h) == 1
    assert h[0]["campo"] == "Importe total" and h[0]["usuario"] == ACTOR
    assert h[0]["anterior"] == old and h[0]["nuevo"] == 123456
    assert isinstance(h[0]["fecha"], str)
    # persisted
    assert s.get(f"{API}/reservations/{res['id']}").json()["montoEstimado"] == 123456


# Same value -> no entry
def test_monto_unchanged_no_entry(s, res):
    r = s.patch(f"{API}/reservations/{res['id']}/monto", json={"monto": res["montoEstimado"], "actorEmail": ACTOR})
    assert r.json()["historial"] == []


# Without actorEmail -> "Sin identificar"
def test_no_actor(s, res):
    r = s.patch(f"{API}/reservations/{res['id']}/deposito", json={"deposito": 7777})
    h = r.json()["historial"]
    assert len(h) == 1 and h[0]["usuario"] == "Sin identificar" and h[0]["campo"] == "Depósito de garantía"


# deposito/limpieza null->null no entry, value change entry
def test_deposito_limpieza(s, res):
    rid = res["id"]
    r = s.patch(f"{API}/reservations/{rid}/deposito", json={"deposito": None, "actorEmail": ACTOR})
    assert r.json()["historial"] == []
    r = s.patch(f"{API}/reservations/{rid}/limpieza", json={"limpieza": 9000, "actorEmail": ACTOR})
    h = r.json()["historial"]
    assert len(h) == 1 and h[0]["campo"] == "Cargo de limpieza" and h[0]["anterior"] is None and h[0]["nuevo"] == 9000
    # same value again (float vs int) -> no new entry
    r = s.patch(f"{API}/reservations/{rid}/limpieza", json={"limpieza": 9000.0, "actorEmail": ACTOR})
    assert len(r.json()["historial"]) == 1


# Huesped: only the changed field (nombre) should be logged
def test_huesped_only_nombre_change(s, res):
    rid = res["id"]
    r = s.patch(f"{API}/reservations/{rid}/huesped", json={"nombre": "TEST_Hist Nuevo", "actorEmail": ACTOR})
    h = r.json()["historial"]
    assert len(h) == 1 and h[0]["campo"] == "Nombre y apellido"
    assert h[0]["anterior"] == "TEST_Hist" and h[0]["nuevo"] == "TEST_Hist Nuevo"


# Huesped as the frontend sends it (full form with '' for empty fields) should log ONLY real changes
def test_huesped_full_form_like_frontend(s, res):
    rid = res["id"]
    h0 = s.get(f"{API}/reservations/{rid}").json()["huesped"]
    form = {"nombre": "TEST_Hist Cambiado", "telefono": h0.get("telefono") or "", "email": h0.get("email") or "",
            "dni": h0.get("dni") or "", "domicilio": h0.get("domicilio") or "", "localidad": h0.get("localidad") or "",
            "huespedes": h0.get("huespedes") or 1, "comentario": h0.get("comentario") or "", "actorEmail": ACTOR}
    r = s.patch(f"{API}/reservations/{rid}/huesped", json=form)
    h = r.json()["historial"]
    campos = [e["campo"] for e in h]
    print("historial entries:", h)
    assert campos == ["Nombre y apellido"], f"Spurious entries logged: {h}"


# 404s
def test_404(s):
    assert s.get(f"{API}/reservations/nonexistent123").status_code == 404
    assert s.patch(f"{API}/reservations/nonexistent123/monto", json={"monto": 10}).status_code == 404
