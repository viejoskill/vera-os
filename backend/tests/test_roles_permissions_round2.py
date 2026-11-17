# Round-2 regression tests for VERA OS roles/permissions fixes (public guest endpoints,
# backend mustChangePassword enforcement, deactivated-session /auth/me, role slug unicode).
import os
import uuid

import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
SB_URL = os.environ.get("REACT_APP_SUPABASE_URL").rstrip("/")
SB_ANON = os.environ.get("REACT_APP_SUPABASE_ANON_KEY")

ADMIN = ("qa_admin_roles@vera.test", "QaRoles!2026Admin")
SECRE_EMAIL = "qa.secretaria.roles@vera-qa.com"
SECRE_PW = os.environ.get("QA_SECRE_PW", "vL5OHJ9Ez323")


def sb_login(email, password):
    return requests.post(
        f"{SB_URL}/auth/v1/token?grant_type=password",
        headers={"apikey": SB_ANON, "Content-Type": "application/json"},
        json={"email": email, "password": password}, timeout=30,
    )


def tok(email, pw):
    r = sb_login(email, pw)
    if r.status_code != 200:
        pytest.skip(f"login failed {email}: {r.text[:150]}")
    return r.json()["access_token"]


def H(t):
    return {"Authorization": f"Bearer {t}"}


@pytest.fixture(scope="module")
def admin_tok():
    return tok(*ADMIN)


@pytest.fixture(scope="module")
def reservation_id(admin_tok):
    r = requests.get(f"{BASE_URL}/api/rentals/reservations", headers=H(admin_tok), timeout=30)
    assert r.status_code == 200
    data = r.json()
    items = data if isinstance(data, list) else (data.get("items") or data.get("reservations") or [])
    if not items:
        pytest.skip("no reservations")
    return items[0].get("id") or items[0].get("_id")


# ---- public endpoints ----
def test_rentals_settings_get_public():
    r = requests.get(f"{BASE_URL}/api/rentals/settings", timeout=30)
    assert r.status_code == 200, r.text
    assert isinstance(r.json(), dict)


def test_rentals_settings_put_protected():
    r = requests.put(f"{BASE_URL}/api/rentals/settings", json={}, timeout=30)
    assert r.status_code == 401, r.text


def test_property_share_public_random_id():
    r = requests.get(f"{BASE_URL}/api/properties/nonexistent-{uuid.uuid4().hex[:6]}/share", timeout=30)
    assert r.status_code in (200, 404), r.status_code


@pytest.mark.parametrize("suffix", ["documento/reserva", "documento/contrato", "recibo-sena", "comprobante"])
def test_guest_docs_public_fake_id(suffix):
    r = requests.get(f"{BASE_URL}/api/rentals/reservations/fake-{uuid.uuid4().hex[:6]}/{suffix}", timeout=30)
    assert r.status_code != 401, r.text
    assert r.status_code in (404, 422, 400, 200), r.status_code


@pytest.mark.parametrize("suffix", ["documento/reserva", "documento/contrato", "recibo-sena", "comprobante"])
def test_guest_docs_public_real_id(reservation_id, suffix):
    r = requests.get(f"{BASE_URL}/api/rentals/reservations/{reservation_id}/{suffix}", timeout=30)
    print(suffix, r.status_code, r.headers.get("content-type"))
    assert r.status_code != 401, r.text


def test_reservations_list_still_protected():
    r = requests.get(f"{BASE_URL}/api/rentals/reservations", timeout=30)
    assert r.status_code == 401


def test_comprobante_post_still_protected(reservation_id):
    r = requests.post(f"{BASE_URL}/api/rentals/reservations/{reservation_id}/comprobantes", timeout=30)
    assert r.status_code == 401


# ---- role slug unicode ----
def test_role_unicode_name_create_delete(admin_tok):
    name = f"TEST_Atención al Cliente {uuid.uuid4().hex[:4]}"
    r = requests.post(f"{BASE_URL}/api/roles", headers=H(admin_tok),
                      json={"name": name, "permissions": {"propiedades": ["ver"]}}, timeout=30)
    assert r.status_code == 201, r.text
    role = r.json()
    rid = role.get("id") or role.get("_id")
    try:
        assert rid and rid.isascii(), rid
        assert role["name"] == name
        lst = requests.get(f"{BASE_URL}/api/roles", headers=H(admin_tok), timeout=30).json()
        roles = lst if isinstance(lst, list) else lst.get("roles", [])
        assert any((x.get("id") or x.get("_id")) == rid for x in roles)
    finally:
        d = requests.delete(f"{BASE_URL}/api/roles/{rid}", headers=H(admin_tok), timeout=30)
        assert d.status_code in (200, 204), d.text


def test_role_with_equipo_module(admin_tok):
    """'equipo' should not be assignable to non-admin roles (UI removed it); report backend behavior."""
    name = f"TEST_equipo_{uuid.uuid4().hex[:4]}"
    r = requests.post(f"{BASE_URL}/api/roles", headers=H(admin_tok),
                      json={"name": name, "permissions": {"equipo": ["ver"]}}, timeout=30)
    print("create role with equipo ->", r.status_code, r.text[:200])
    if r.status_code == 201:
        rid = r.json().get("id") or r.json().get("_id")
        requests.delete(f"{BASE_URL}/api/roles/{rid}", headers=H(admin_tok), timeout=30)


# ---- mustChangePassword backend enforcement + deactivation (full flow) ----
def test_must_change_password_and_deactivation_flow(admin_tok):
    # reset temp password
    r = requests.post(f"{BASE_URL}/api/users/{SECRE_EMAIL}/reset-password", headers=H(admin_tok),
                      json={"method": "temporary"}, timeout=60)
    assert r.status_code == 200, r.text
    temp = r.json()["temporaryPassword"]
    with open("/tmp/secre_pw.txt", "w") as f:
        f.write(temp)
    st = tok(SECRE_EMAIL, temp)
    me = requests.get(f"{BASE_URL}/api/auth/me", headers=H(st), timeout=30)
    assert me.status_code == 200 and me.json()["mustChangePassword"] is True
    blocked = requests.get(f"{BASE_URL}/api/rentals/reservations", headers=H(st), timeout=30)
    assert blocked.status_code == 403, blocked.text
    assert "contraseña" in blocked.json().get("detail", "").lower()
    ml = requests.post(f"{BASE_URL}/api/auth/mark-login", headers=H(st), timeout=30)
    print("mark-login while mustChange ->", ml.status_code)
    # change password in supabase + mark done
    new_pw = SECRE_PW
    up = requests.put(f"{SB_URL}/auth/v1/user", headers={"apikey": SB_ANON, **H(st)},
                      json={"password": new_pw}, timeout=30)
    assert up.status_code == 200, up.text
    done = requests.post(f"{BASE_URL}/api/auth/change-password-done", headers=H(st), timeout=30)
    assert done.status_code == 200 and done.json()["mustChangePassword"] is False
    ok = requests.get(f"{BASE_URL}/api/rentals/reservations", headers=H(st), timeout=30)
    assert ok.status_code == 200
    with open("/tmp/secre_pw.txt", "w") as f:
        f.write(new_pw)
    # deactivate while session open
    d = requests.post(f"{BASE_URL}/api/users/{SECRE_EMAIL}/deactivate", headers=H(admin_tok), timeout=60)
    assert d.status_code == 200
    try:
        r401 = requests.get(f"{BASE_URL}/api/rentals/reservations", headers=H(st), timeout=30)
        assert r401.status_code == 401
        me2 = requests.get(f"{BASE_URL}/api/auth/me", headers=H(st), timeout=30)
        assert me2.status_code == 200, me2.text
        assert me2.json()["active"] is False
    finally:
        ra = requests.post(f"{BASE_URL}/api/users/{SECRE_EMAIL}/reactivate", headers=H(admin_tok), timeout=60)
        assert ra.status_code == 200 and ra.json()["active"] is True
    assert sb_login(SECRE_EMAIL, new_pw).status_code == 200
