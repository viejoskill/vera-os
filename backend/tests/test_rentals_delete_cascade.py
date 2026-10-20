# Rentals: DELETE reservation also deletes its rental_movimientos (commission) - iteration_74
import os
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
API = f"{BASE_URL}/api/rentals"
PID = "6744cf8a907f4a239a7504101c66a2df"


def _movs():
    r = requests.get(f"{API}/properties/{PID}/movimientos")
    assert r.status_code == 200, r.text
    return r.json()


def test_delete_reservation_removes_movimientos():
    body = {"propertyId": PID, "nombre": "TEST_Cascade", "telefono": "1100000000",
            "checkIn": "2026-11-23", "checkOut": "2026-11-26", "montoTotal": 90000, "senaTenedor": "ninguno"}
    r = requests.post(f"{API}/reservations/manual", json=body)
    assert r.status_code == 201, r.text
    rid = r.json()["id"]
    try:
        assert r.json()["estado"] == "confirmada"
        mine = [m for m in _movs() if m.get("reservaId") == rid]
        assert len(mine) >= 1, "expected commission movimiento for confirmed manual reservation"
    finally:
        d = requests.delete(f"{API}/reservations/{rid}")
        assert d.status_code == 204
    assert requests.get(f"{API}/reservations/{rid}").status_code == 404
    assert [m for m in _movs() if m.get("reservaId") == rid] == []


def test_delete_nonexistent_is_204():
    assert requests.delete(f"{API}/reservations/doesnotexist_cascade").status_code == 204
