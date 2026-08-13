"""Backend tests for Alquileres Temporarios (Fase 1) - /api/rentals/*"""
import os
from datetime import date, timedelta

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://real-estate-os-10.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api/rentals"


def _future(days: int) -> str:
    return (date.today() + timedelta(days=days)).isoformat()


@pytest.fixture(scope="module")
def s():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def prop(s):
    """Create a fresh test property for isolation."""
    body = {
        "titulo": "TEST_ Casa de Prueba QA",
        "direccion": "Calle QA 123",
        "localidad": "Costa del Este",
        "descripcion": "Prop para tests",
        "capacidad": 4, "dormitorios": 2, "banos": 1,
        "amenities": ["wifi", "pileta"],
        "moneda": "ARS", "precioNoche": 80000,
        "descSemana": 10, "descQuincena": 15, "descMes": 25,
        "activa": True,
    }
    r = s.post(f"{API}/properties", json=body)
    assert r.status_code == 201, r.text
    p = r.json()
    yield p
    # cleanup
    s.delete(f"{API}/properties/{p['id']}")


# ------------------------------ Propiedades ------------------------------ #
class TestProperties:
    def test_created_persisted(self, s, prop):
        r = s.get(f"{API}/properties/{prop['id']}")
        assert r.status_code == 200
        d = r.json()
        assert d["titulo"] == prop["titulo"]
        assert d["precioNoche"] == 80000
        assert d["slug"].startswith("test-casa-de-prueba-qa")
        assert d["descSemana"] == 10
        assert d["descMes"] == 25

    def test_list_contains(self, s, prop):
        r = s.get(f"{API}/properties")
        assert r.status_code == 200
        assert any(p["id"] == prop["id"] for p in r.json())

    def test_update(self, s, prop):
        body = {
            "titulo": prop["titulo"], "direccion": "Nueva 456",
            "localidad": "Costa del Este", "descripcion": "actualizada",
            "capacidad": 5, "dormitorios": 2, "banos": 1,
            "amenities": [], "moneda": "ARS", "precioNoche": 80000,
            "descSemana": 10, "descQuincena": 15, "descMes": 25, "activa": True,
        }
        r = s.put(f"{API}/properties/{prop['id']}", json=body)
        assert r.status_code == 200
        assert r.json()["direccion"] == "Nueva 456"
        assert r.json()["capacidad"] == 5

    def test_public_list_only_active(self, s, prop):
        r = s.get(f"{API}/public/properties")
        assert r.status_code == 200
        ids = [p["id"] for p in r.json()]
        assert prop["id"] in ids

    def test_public_by_slug(self, s, prop):
        r = s.get(f"{API}/public/properties/{prop['slug']}")
        assert r.status_code == 200
        d = r.json()
        assert "ocupados" in d
        assert "descuentos" in d
        assert d["descuentos"]["semana"] == 10
        assert d["descuentos"]["quincena"] == 15
        assert d["descuentos"]["mes"] == 25


# ------------------------------ Cotización ------------------------------ #
class TestQuote:
    @pytest.mark.parametrize("nights,expected_disc", [
        (6, 0), (7, 10), (14, 10), (15, 15), (29, 15), (30, 25),
    ])
    def test_discount_brackets(self, s, prop, nights, expected_disc):
        ci = _future(200)
        co = _future(200 + nights)
        r = s.get(f"{API}/public/quote", params={"slug": prop["slug"], "checkIn": ci, "checkOut": co})
        assert r.status_code == 200, r.text
        q = r.json()
        assert q["noches"] == nights
        assert q["descuentoPct"] == expected_disc
        expected_total = round(nights * 80000 * (1 - expected_disc / 100))
        assert q["total"] == expected_total

    def test_invalid_range(self, s, prop):
        r = s.get(f"{API}/public/quote", params={"slug": prop["slug"], "checkIn": _future(10), "checkOut": _future(10)})
        assert r.status_code == 400


# ------------------------- Reservas / Overlap ---------------------------- #
class TestReservationsOverlap:
    def test_prereserva_public_occupies(self, s, prop):
        ci, co = _future(50), _future(53)
        body = {"nombre": "TEST_ Juan", "telefono": "1111", "email": "t@t.com",
                "dni": "12345678", "huespedes": 2, "comentario": "x",
                "checkIn": ci, "checkOut": co, "origen": "MercadoLibre"}
        r = s.post(f"{API}/public/properties/{prop['slug']}/prereserva", json=body)
        assert r.status_code == 201, r.text
        assert r.json()["estado"] == "prereserva"

        # Verify ocupados
        r2 = s.get(f"{API}/public/properties/{prop['slug']}")
        assert any(o["checkIn"] == ci and o["checkOut"] == co for o in r2.json()["ocupados"])

    def test_overlap_conflict(self, s, prop):
        body = {"nombre": "TEST_ Overlap", "checkIn": _future(51), "checkOut": _future(54),
                "huespedes": 1, "origen": "Directo"}
        r = s.post(f"{API}/public/properties/{prop['slug']}/prereserva", json=body)
        assert r.status_code == 409

    def test_contiguous_dates_allowed(self, s, prop):
        # checkin = checkout previo (53) => contiguo, debe permitirse
        body = {"nombre": "TEST_ Contig", "checkIn": _future(53), "checkOut": _future(55),
                "huespedes": 1, "origen": "Directo"}
        r = s.post(f"{API}/public/properties/{prop['slug']}/prereserva", json=body)
        assert r.status_code == 201, r.text

    def test_block_prevents(self, s, prop):
        # Bloqueo en rango libre
        r = s.post(f"{API}/rentals/blocks", json={}) if False else s.post(
            f"{API}/blocks",
            json={"propertyId": prop["id"], "checkIn": _future(60), "checkOut": _future(63),
                  "motivo": "Mantenimiento"}
        )
        assert r.status_code == 201, r.text
        # Overlap con bloqueo debe fallar
        r2 = s.post(f"{API}/public/properties/{prop['slug']}/prereserva",
                    json={"nombre": "TEST_ X", "checkIn": _future(61), "checkOut": _future(62), "huespedes": 1})
        assert r2.status_code == 409

    def test_cancel_frees_dates(self, s, prop):
        ci, co = _future(80), _future(82)
        r = s.post(f"{API}/public/properties/{prop['slug']}/prereserva",
                   json={"nombre": "TEST_ Cancel", "checkIn": ci, "checkOut": co, "huespedes": 1})
        assert r.status_code == 201
        rid = r.json()["reservaId"]

        # Verify blocks a new reservation
        r_conf = s.post(f"{API}/public/properties/{prop['slug']}/prereserva",
                        json={"nombre": "TEST_ Y", "checkIn": ci, "checkOut": co, "huespedes": 1})
        assert r_conf.status_code == 409

        # Cancel
        r_pat = s.patch(f"{API}/reservations/{rid}", json={"estado": "cancelada", "motivo": "test"})
        assert r_pat.status_code == 200
        assert r_pat.json()["estado"] == "cancelada"

        # Now allowed
        r_new = s.post(f"{API}/public/properties/{prop['slug']}/prereserva",
                       json={"nombre": "TEST_ Z", "checkIn": ci, "checkOut": co, "huespedes": 1})
        assert r_new.status_code == 201, r_new.text

    def test_reservation_appears_internal_with_origen(self, s, prop):
        ci, co = _future(100), _future(102)
        body = {"nombre": "TEST_ ML Client", "checkIn": ci, "checkOut": co,
                "huespedes": 1, "origen": "MercadoLibre"}
        r = s.post(f"{API}/public/properties/{prop['slug']}/prereserva", json=body)
        assert r.status_code == 201
        rid = r.json()["reservaId"]

        r2 = s.get(f"{API}/reservations", params={"propertyId": prop["id"]})
        assert r2.status_code == 200
        found = [x for x in r2.json() if x["id"] == rid]
        assert len(found) == 1
        assert found[0]["origen"] == "MercadoLibre"
        assert found[0]["estado"] == "prereserva"
        assert found[0]["huesped"]["nombre"] == "TEST_ ML Client"


# ------------------------------ Calendar ------------------------------ #
class TestCalendar:
    def test_calendar_endpoint(self, s, prop):
        r = s.get(f"{API}/properties/{prop['id']}/calendar")
        assert r.status_code == 200
        assert "ocupados" in r.json()
        assert isinstance(r.json()["ocupados"], list)
