"""Backend regression for Sprint 'Cerrar App Propiedades'.

Covers:
- GET/POST /api/properties/{id}/visits round-trip
- Property `code` field format VAR-XXXXXX
- Persistence (visit still returned on subsequent GET)
- Cleanup: created visit row is removed via service_role at teardown.
"""
from __future__ import annotations

import os
import re
import time
from typing import Optional

import pytest
import requests
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

CODE_RE = re.compile(r"^VAR-\d{6}$")


@pytest.fixture(scope="module")
def api() -> requests.Session:
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def sb() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


@pytest.fixture(scope="module")
def real_property_id(api: requests.Session) -> str:
    """Pick the first property from the list to attach test visits to."""
    r = api.get(f"{BASE_URL}/api/properties", timeout=20)
    assert r.status_code == 200, r.text
    rows = r.json()
    assert isinstance(rows, list) and rows, "expected at least one property in seed"
    return rows[0]["id"]


@pytest.fixture(scope="module")
def created_visit_ids() -> list[str]:
    return []


@pytest.fixture(scope="module", autouse=True)
def cleanup_visits(sb: Client, created_visit_ids: list[str]):
    yield
    for vid in created_visit_ids:
        try:
            sb.table("property_visits").delete().eq("id", vid).execute()
        except Exception as e:
            print(f"cleanup visit {vid} failed: {e}")


# --- Property code (VAR-XXXXXX) --------------------------------------------
class TestPropertyCode:
    def test_list_returns_var_code(self, api: requests.Session):
        r = api.get(f"{BASE_URL}/api/properties", timeout=20)
        assert r.status_code == 200
        rows = r.json()
        assert rows, "no properties returned"
        for row in rows:
            assert "code" in row, f"missing code in property {row.get('id')}"
            assert CODE_RE.match(row["code"]), f"bad code format: {row['code']}"

    def test_detail_returns_var_code(self, api: requests.Session, real_property_id: str):
        r = api.get(f"{BASE_URL}/api/properties/{real_property_id}", timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert CODE_RE.match(data.get("code", "")), f"bad code format: {data.get('code')}"


# --- Visits round-trip ------------------------------------------------------
class TestVisitsRoundTrip:
    def test_list_visits_endpoint_ok(self, api: requests.Session, real_property_id: str):
        r = api.get(f"{BASE_URL}/api/properties/{real_property_id}/visits", timeout=20)
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)

    def test_create_visit_persists(
        self,
        api: requests.Session,
        real_property_id: str,
        created_visit_ids: list[str],
    ):
        payload = {
            "date": "2026-01-15",
            "time": "10:30",
            "interested": "TEST_Juan García",
            "agent": "TEST_Sofía Martín",
            "comment": "TEST_verificación E2E",
            "notifyOwner": True,
        }
        r = api.post(
            f"{BASE_URL}/api/properties/{real_property_id}/visits",
            json=payload,
            timeout=20,
        )
        assert r.status_code == 201, f"{r.status_code}: {r.text}"
        body = r.json()
        assert body["id"]
        created_visit_ids.append(body["id"])

        # Response data assertions (camelCase on wire).
        assert body["propertyId"] == real_property_id
        assert body["date"] == "2026-01-15"
        assert body["time"] == "10:30"
        assert body["interested"] == "TEST_Juan García"
        assert body["agent"] == "TEST_Sofía Martín"
        assert body["comment"] == "TEST_verificación E2E"
        assert body["notifyOwner"] is True
        assert body["createdAt"], "missing createdAt"

        # GET returns the created visit.
        time.sleep(0.4)
        r2 = api.get(f"{BASE_URL}/api/properties/{real_property_id}/visits", timeout=20)
        assert r2.status_code == 200
        ids = [v["id"] for v in r2.json()]
        assert body["id"] in ids, "created visit missing from list"

    def test_create_visit_minimal_payload(
        self,
        api: requests.Session,
        real_property_id: str,
        created_visit_ids: list[str],
    ):
        """Even with empty strings, the create must succeed (no 'Error' policy)."""
        payload = {
            "date": "2026-01-14",
            "time": "",
            "interested": "TEST_anon",
            "agent": "",
            "comment": "",
            "notifyOwner": False,
        }
        r = api.post(
            f"{BASE_URL}/api/properties/{real_property_id}/visits",
            json=payload,
            timeout=20,
        )
        assert r.status_code == 201, r.text
        body = r.json()
        created_visit_ids.append(body["id"])
        assert body["notifyOwner"] is False


# --- Regression on removed / kept routes -----------------------------------
class TestPropertiesRegression:
    def test_list_ok(self, api: requests.Session):
        r = api.get(f"{BASE_URL}/api/properties", timeout=20)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_detail_404_for_bogus(self, api: requests.Session):
        r = api.get(
            f"{BASE_URL}/api/properties/00000000-0000-0000-0000-000000000000",
            timeout=20,
        )
        assert r.status_code == 404
