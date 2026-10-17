# Team section permissions: POST /api/auth/team/set-sections contract
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
ADMIN = "varelavendecde@gmail.com"
QA = "qa_varela@vera.test"


def _member(email):
    r = requests.get(f"{BASE_URL}/api/auth/team", params={"actorEmail": ADMIN})
    assert r.status_code == 200
    return next((m for m in r.json()["members"] if m["email"] == email), None)


def test_team_rows_have_sections_field():
    r = requests.get(f"{BASE_URL}/api/auth/team", params={"actorEmail": ADMIN})
    assert r.status_code == 200
    for m in r.json()["members"]:
        assert "sections" in m


def test_non_admin_actor_forbidden():
    r = requests.post(f"{BASE_URL}/api/auth/team/set-sections",
                      json={"email": QA, "actorEmail": "inmovarelacde@gmail.com", "sections": ["hoy"]})
    assert r.status_code == 403


def test_inmovarela_prod_record_intact():
    m = _member("inmovarelacde@gmail.com")
    assert m["approved"] is True and m["isAdmin"] is False and m["sections"] == ["liquidaciones"]


def test_set_list_empty_null_roundtrip():
    for secs in (["liquidaciones", "studio"], [], None):
        r = requests.post(f"{BASE_URL}/api/auth/team/set-sections",
                          json={"email": QA, "actorEmail": ADMIN, "sections": secs})
        assert r.status_code == 200
        assert _member(QA)["sections"] == secs
        a = requests.post(f"{BASE_URL}/api/auth/approval", json={"email": QA}).json()
        assert a["sections"] == secs
