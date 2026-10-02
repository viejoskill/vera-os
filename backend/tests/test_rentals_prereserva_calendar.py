"""E2E tests for rental pre-reserva + calendar color flow (iteration 62).

Covers: public POST /prereserva creates estado='prereserva', calendar endpoint
exposes it, double-booking is blocked (409), PATCH confirmada moves it to
estado='confirmada', PATCH cancelada frees the dates, bloqueo stays as 'bloqueo'.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://real-estate-os-10.preview.emergentagent.com").rstrip("/")
SLUG = "casa-de-prueba-costa-del-este-borrar-d79b0a"

# Far-future dates to avoid existing seeded ranges
D1_IN = "2027-05-10"
D1_OUT = "2027-05-15"
D2_IN = "2027-06-10"
D2_OUT = "2027-06-14"
BLOCK_IN = "2027-07-01"
BLOCK_OUT = "2027-07-05"


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def property_id(api):
    r = api.get(f"{BASE_URL}/api/rentals/public/properties/{SLUG}")
    assert r.status_code == 200, r.text
    return r.json()["id"]


@pytest.fixture(scope="module")
def created_ids():
    """Track created ids for cleanup."""
    ids = {"reservas": [], "bloqueos": []}
    yield ids
    # cleanup via internal endpoints (no auth required on backend currently)
    s = requests.Session()
    for rid in ids["reservas"]:
        try:
            s.delete(f"{BASE_URL}/api/rentals/reservations/{rid}", timeout=10)
        except Exception:
            pass
    for bid in ids["bloqueos"]:
        try:
            s.delete(f"{BASE_URL}/api/rentals/blocks/{bid}", timeout=10)
        except Exception:
            pass


def _calendar(api, pid):
    r = api.get(f"{BASE_URL}/api/rentals/properties/{pid}/calendar")
    assert r.status_code == 200, r.text
    return r.json()["ocupados"]


# --- 1. Public prereserva creation -----------------------------------------
def test_public_prereserva_creates_with_estado_prereserva(api, property_id, created_ids):
    tag = uuid.uuid4().hex[:6]
    payload = {
        "nombre": f"TEST_QA_{tag}", "telefono": "+5491100000000",
        "email": f"qa_{tag}@test.local", "dni": "99999999", "huespedes": 2,
        "comentario": "iteration 62 e2e",
        "checkIn": D1_IN, "checkOut": D1_OUT,
        "origen": "Directo", "aceptaCondiciones": True,
    }
    r = api.post(f"{BASE_URL}/api/rentals/public/properties/{SLUG}/prereserva", json=payload)
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["estado"] == "prereserva"
    assert data["ok"] is True
    assert "reservaId" in data
    created_ids["reservas"].append(data["reservaId"])

    # calendar now exposes it as prereserva
    ocupados = _calendar(api, property_id)
    match = [o for o in ocupados if o["checkIn"] == D1_IN and o["checkOut"] == D1_OUT]
    assert len(match) == 1
    assert match[0]["estado"] == "prereserva"


# --- 2. Double-booking during pending state is blocked ----------------------
def test_double_booking_pending_is_blocked(api, created_ids):
    """Overlapping prereserva on SAME dates must be rejected (409)."""
    payload = {
        "nombre": "TEST_QA_overlap", "telefono": "+5491100000001",
        "huespedes": 1, "checkIn": D1_IN, "checkOut": D1_OUT,
        "aceptaCondiciones": True,
    }
    r = api.post(f"{BASE_URL}/api/rentals/public/properties/{SLUG}/prereserva", json=payload)
    assert r.status_code == 409, f"expected 409, got {r.status_code}: {r.text}"

    # partial overlap also blocked
    payload["checkIn"] = "2027-05-12"
    payload["checkOut"] = "2027-05-20"
    r2 = api.post(f"{BASE_URL}/api/rentals/public/properties/{SLUG}/prereserva", json=payload)
    assert r2.status_code == 409


# --- 3. Accept prereserva -> estado confirmada ------------------------------
def test_accept_prereserva_moves_to_confirmada(api, property_id, created_ids):
    assert created_ids["reservas"], "needs reserva from test 1"
    rid = created_ids["reservas"][0]
    r = api.patch(f"{BASE_URL}/api/rentals/reservations/{rid}", json={"estado": "confirmada"})
    assert r.status_code == 200, r.text
    assert r.json()["estado"] == "confirmada"

    ocupados = _calendar(api, property_id)
    match = [o for o in ocupados if o["checkIn"] == D1_IN and o["checkOut"] == D1_OUT]
    assert len(match) == 1
    assert match[0]["estado"] == "confirmada"


# --- 4. Reject prereserva frees calendar ------------------------------------
def test_reject_prereserva_frees_dates(api, property_id, created_ids):
    # create second prereserva
    payload = {
        "nombre": "TEST_QA_reject", "telefono": "+5491100000002",
        "huespedes": 1, "checkIn": D2_IN, "checkOut": D2_OUT,
        "aceptaCondiciones": True,
    }
    r = api.post(f"{BASE_URL}/api/rentals/public/properties/{SLUG}/prereserva", json=payload)
    assert r.status_code == 201
    rid = r.json()["reservaId"]
    created_ids["reservas"].append(rid)

    # was in ocupados as prereserva
    oc = _calendar(api, property_id)
    assert any(o["checkIn"] == D2_IN and o["estado"] == "prereserva" for o in oc)

    # reject -> cancelada
    r2 = api.patch(f"{BASE_URL}/api/rentals/reservations/{rid}", json={"estado": "cancelada"})
    assert r2.status_code == 200
    assert r2.json()["estado"] == "cancelada"

    # dates must be freed
    oc2 = _calendar(api, property_id)
    assert not any(o["checkIn"] == D2_IN and o["checkOut"] == D2_OUT for o in oc2), (
        f"cancelled reservation still occupies calendar: {oc2}"
    )


# --- 5. Manual block stays as 'bloqueo' -------------------------------------
def test_manual_block_shows_as_bloqueo(api, property_id, created_ids):
    r = api.post(f"{BASE_URL}/api/rentals/blocks", json={
        "propertyId": property_id, "checkIn": BLOCK_IN, "checkOut": BLOCK_OUT,
        "motivo": "TEST_QA block",
    })
    assert r.status_code in (200, 201), r.text
    bid = r.json().get("id") or r.json().get("_id")
    if bid:
        created_ids["bloqueos"].append(bid)

    oc = _calendar(api, property_id)
    match = [o for o in oc if o["checkIn"] == BLOCK_IN and o["checkOut"] == BLOCK_OUT]
    assert len(match) == 1
    assert match[0]["estado"] == "bloqueo"
