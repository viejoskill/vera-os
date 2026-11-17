# E2E tests (real Supabase JWT) for VERA OS users/roles/permissions feature
import os
import time
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
SECRE = ("qa.secretaria.roles@vera-qa.com", "NuevaClaveSecretaria10")


def sb_login(email, password):
    r = requests.post(
        f"{SB_URL}/auth/v1/token?grant_type=password",
        headers={"apikey": SB_ANON, "Content-Type": "application/json"},
        json={"email": email, "password": password},
        timeout=30,
    )
    return r


def token_for(email, password):
    r = sb_login(email, password)
    if r.status_code != 200:
        pytest.skip(f"Supabase login failed for {email}: {r.status_code} {r.text[:200]}")
    return r.json()["access_token"]


def _cleanup_user(email):
    """No hay endpoint de borrado (por diseño): limpiar el usuario de prueba por email exacto."""
    from pymongo import MongoClient
    from supabase import create_client
    db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    db["app_access"].delete_one({"_id": email})
    db["login_attempts"].delete_one({"_id": email})
    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    res = sb.auth.admin.list_users()
    for u in getattr(res, "users", res) or []:
        if (u.email or "").lower() == email:
            sb.auth.admin.delete_user(u.id)


def H(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def admin_tok():
    return token_for(*ADMIN)


@pytest.fixture(scope="module")
def sec_tok():
    return token_for(*SECRE)


# ---------- 401 without token ----------
@pytest.mark.parametrize("path", ["/api/properties", "/api/rentals/reservations", "/api/users", "/api/roles", "/api/people", "/api/auth/me"])
def test_no_token_401(path):
    r = requests.get(f"{BASE_URL}{path}", timeout=30)
    assert r.status_code == 401, r.text


def test_garbage_token_401():
    r = requests.get(f"{BASE_URL}/api/properties", headers=H("abc.def.ghi"), timeout=30)
    assert r.status_code == 401


# ---------- public regression ----------
@pytest.mark.parametrize("path", ["/api/rentals/public/properties", "/api/public/listings", "/api/sitemap.xml", "/api/health"])
def test_public_endpoints(path):
    r = requests.get(f"{BASE_URL}{path}", timeout=30)
    assert r.status_code == 200, f"{path}: {r.status_code} {r.text[:200]}"


def test_sign_token_public():
    r = requests.get(f"{BASE_URL}/api/sign/invalid-token-xyz", timeout=30)
    assert r.status_code != 401 and r.status_code != 403, r.status_code


def test_public_listing_detail_and_rental_detail():
    lst = requests.get(f"{BASE_URL}/api/public/listings", timeout=30).json()
    items = lst if isinstance(lst, list) else (lst.get("items") or lst.get("listings") or [])
    if items:
        pid = items[0].get("id")
        r = requests.get(f"{BASE_URL}/api/public/listings/{pid}", timeout=30)
        assert r.status_code == 200
    rp = requests.get(f"{BASE_URL}/api/rentals/public/properties", timeout=30).json()
    ritems = rp if isinstance(rp, list) else (rp.get("items") or rp.get("properties") or [])
    if ritems:
        slug = ritems[0].get("slug") or ritems[0].get("id")
        r = requests.get(f"{BASE_URL}/api/rentals/public/properties/{slug}", timeout=30)
        assert r.status_code == 200, r.text[:200]


# ---------- /auth/me ----------
def test_me_secretaria(sec_tok):
    r = requests.get(f"{BASE_URL}/api/auth/me", headers=H(sec_tok), timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert d["isAdmin"] is False
    assert d["active"] is True
    assert set(d["permissions"].keys()) == {"alquileres", "liquidaciones", "studio"}
    assert sorted(d["permissions"]["alquileres"]) == ["crear", "editar", "ver"]
    assert sorted(d["permissions"]["studio"]) == ["editar", "ver"]


def test_me_admin(admin_tok):
    r = requests.get(f"{BASE_URL}/api/auth/me", headers=H(admin_tok), timeout=30)
    assert r.status_code == 200 and r.json()["isAdmin"] is True


# ---------- Secretaria module access ----------
@pytest.mark.parametrize("path,expected", [
    ("/api/rentals/reservations", 200),
    ("/api/rentals/liquidaciones/pendientes", 200),
    ("/api/properties", 403),
    ("/api/people", 403),
    ("/api/users", 403),
    ("/api/roles", 403),
    ("/api/core/kpis", 403),
])
def test_secretaria_get_access(sec_tok, path, expected):
    r = requests.get(f"{BASE_URL}{path}", headers=H(sec_tok), timeout=30)
    assert r.status_code == expected, f"{path}: {r.status_code} {r.text[:200]}"


def test_secretaria_studio_access(sec_tok):
    # find any studio GET route
    r = requests.get(f"{BASE_URL}/api/studio/state", headers=H(sec_tok), timeout=30)
    assert r.status_code not in (401, 403), f"{r.status_code} {r.text[:200]}"


def test_secretaria_deletes_forbidden(sec_tok):
    for path in ["/api/rentals/movimientos/nonexistent", "/api/rentals/reservations/nonexistent",
                 "/api/rentals/properties/nonexistent",
                 "/api/rentals/reservations/x/liquidacion/pagos/y"]:
        r = requests.delete(f"{BASE_URL}{path}", headers=H(sec_tok), timeout=30)
        assert r.status_code == 403, f"DELETE {path}: {r.status_code}"


def test_secretaria_export_forbidden(sec_tok):
    props = requests.get(f"{BASE_URL}/api/rentals/properties", headers=H(sec_tok), timeout=30)
    assert props.status_code == 200
    data = props.json()
    items = data if isinstance(data, list) else data.get("items", [])
    pid = items[0]["id"] if items else "x"
    r = requests.get(f"{BASE_URL}/api/rentals/properties/{pid}/export/photos.zip", headers=H(sec_tok), timeout=30)
    assert r.status_code == 403
    r = requests.post(f"{BASE_URL}/api/rentals/properties/{pid}/export-to-ventas", headers=H(sec_tok), timeout=30)
    assert r.status_code == 403


# ---------- Admin full access ----------
@pytest.mark.parametrize("path", ["/api/properties", "/api/people", "/api/core/kpis", "/api/users", "/api/roles", "/api/rentals/reservations"])
def test_admin_full_access(admin_tok, path):
    r = requests.get(f"{BASE_URL}{path}", headers=H(admin_tok), timeout=60)
    assert r.status_code == 200, f"{path}: {r.status_code} {r.text[:200]}"


# ---------- Roles CRUD + union without relogin ----------
def test_role_crud_and_union(admin_tok, sec_tok):
    name = f"TEST QA Rol {uuid.uuid4().hex[:6]}"
    r = requests.post(f"{BASE_URL}/api/roles", headers=H(admin_tok),
                      json={"name": name, "permissions": {"propiedades": ["ver"]}}, timeout=30)
    assert r.status_code == 201, r.text
    role = r.json()
    rid = role["id"]
    try:
        assert role["userCount"] == 0 and role["isSystem"] is False
        # system role protected
        assert requests.put(f"{BASE_URL}/api/roles/administrador", headers=H(admin_tok),
                            json={"name": "X", "permissions": {}}, timeout=30).status_code == 400
        assert requests.delete(f"{BASE_URL}/api/roles/administrador", headers=H(admin_tok), timeout=30).status_code == 400
        # invalid module
        assert requests.post(f"{BASE_URL}/api/roles", headers=H(admin_tok),
                             json={"name": "TEST bad", "permissions": {"nope": ["ver"]}}, timeout=30).status_code == 400
        # union: add role to secretaria
        assert requests.get(f"{BASE_URL}/api/properties", headers=H(sec_tok), timeout=30).status_code == 403
        u = requests.patch(f"{BASE_URL}/api/users/{SECRE[0]}", headers=H(admin_tok),
                           json={"roleIds": ["secretaria", rid]}, timeout=30)
        assert u.status_code == 200, u.text
        assert requests.get(f"{BASE_URL}/api/properties", headers=H(sec_tok), timeout=60).status_code == 200
        # cannot delete role with users
        d = requests.delete(f"{BASE_URL}/api/roles/{rid}", headers=H(admin_tok), timeout=30)
        assert d.status_code == 400
    finally:
        requests.patch(f"{BASE_URL}/api/users/{SECRE[0]}", headers=H(admin_tok),
                       json={"roleIds": ["secretaria"]}, timeout=30)
        assert requests.get(f"{BASE_URL}/api/properties", headers=H(sec_tok), timeout=30).status_code == 403
        d = requests.delete(f"{BASE_URL}/api/roles/{rid}", headers=H(admin_tok), timeout=30)
        assert d.status_code == 200, d.text
    lst = requests.get(f"{BASE_URL}/api/roles", headers=H(admin_tok), timeout=30).json()["roles"]
    assert rid not in [x["id"] for x in lst]


def test_duplicate_role(admin_tok):
    r = requests.post(f"{BASE_URL}/api/roles/secretaria/duplicate", headers=H(admin_tok), timeout=30)
    assert r.status_code == 201
    d = r.json()
    try:
        assert d["permissions"]["alquileres"] == ["ver", "crear", "editar"] or sorted(d["permissions"]["alquileres"]) == ["crear", "editar", "ver"]
        assert d["userCount"] == 0
    finally:
        assert requests.delete(f"{BASE_URL}/api/roles/{d['id']}", headers=H(admin_tok), timeout=30).status_code == 200


# ---------- Admin self-protection ----------
def test_admin_self_protection(admin_tok):
    r = requests.post(f"{BASE_URL}/api/users/{ADMIN[0]}/deactivate", headers=H(admin_tok), timeout=30)
    assert r.status_code == 400 and "propia" in r.json()["detail"]
    r = requests.patch(f"{BASE_URL}/api/users/{ADMIN[0]}", headers=H(admin_tok), json={"roleIds": ["secretaria"]}, timeout=30)
    assert r.status_code == 400 and "propio rol" in r.json()["detail"]
    r = requests.patch(f"{BASE_URL}/api/users/{ADMIN[0]}", headers=H(admin_tok), json={"roleIds": []}, timeout=30)
    assert r.status_code == 400


# ---------- User lifecycle ----------
def test_user_lifecycle(admin_tok):
    email = f"test_user_{uuid.uuid4().hex[:6]}@vera-qa.com"
    r = requests.post(f"{BASE_URL}/api/users", headers=H(admin_tok),
                      json={"name": "TEST User", "email": email, "roleIds": ["secretaria"]}, timeout=60)
    assert r.status_code == 201, r.text
    d = r.json()
    try:
        temp = d["temporaryPassword"]
        assert len(temp) >= 10 and d["mustChangePassword"] is True
        # list doesn't leak temp password
        lst = requests.get(f"{BASE_URL}/api/users", headers=H(admin_tok), timeout=30).json()["users"]
        row = [u for u in lst if u["email"] == email][0]
        assert "temporaryPassword" not in row
        # duplicate
        assert requests.post(f"{BASE_URL}/api/users", headers=H(admin_tok),
                             json={"name": "x", "email": email, "roleIds": ["secretaria"]}, timeout=30).status_code == 409
        # login works
        lr = sb_login(email, temp)
        assert lr.status_code == 200
        tok = lr.json()["access_token"]
        me = requests.get(f"{BASE_URL}/api/auth/me", headers=H(tok), timeout=30).json()
        assert me["mustChangePassword"] is True
        # deactivate -> old JWT rejected
        dr = requests.post(f"{BASE_URL}/api/users/{email}/deactivate", headers=H(admin_tok), timeout=60)
        assert dr.status_code == 200 and dr.json()["active"] is False
        assert requests.get(f"{BASE_URL}/api/rentals/reservations", headers=H(tok), timeout=30).status_code == 401
        assert sb_login(email, temp).status_code != 200  # banned in supabase
        # reactivate
        rr = requests.post(f"{BASE_URL}/api/users/{email}/reactivate", headers=H(admin_tok), timeout=60)
        assert rr.status_code == 200 and rr.json()["active"] is True
        assert sb_login(email, temp).status_code == 200
        # reset password temporary
        rp = requests.post(f"{BASE_URL}/api/users/{email}/reset-password", headers=H(admin_tok), json={"method": "temporary"}, timeout=60)
        assert rp.status_code == 200
        new = rp.json()["temporaryPassword"]
        assert new != temp
        assert sb_login(email, new).status_code == 200
        assert sb_login(email, temp).status_code != 200
        # bad method
        assert requests.post(f"{BASE_URL}/api/users/{email}/reset-password", headers=H(admin_tok), json={"method": "x"}, timeout=30).status_code == 400
        # secretaria-like user cannot manage users
        tok2 = sb_login(email, new).json()["access_token"]
        assert requests.get(f"{BASE_URL}/api/users", headers=H(tok2), timeout=30).status_code == 403
    finally:
        _cleanup_user(email)


def test_create_user_invalid_role(admin_tok):
    r = requests.post(f"{BASE_URL}/api/users", headers=H(admin_tok),
                      json={"name": "x", "email": f"test_x_{uuid.uuid4().hex[:4]}@vera-qa.com", "roleIds": ["nope"]}, timeout=30)
    assert r.status_code == 400


# ---------- Rate limit ----------
def test_login_rate_limit():
    email = f"test_rl_{uuid.uuid4().hex[:6]}@vera-qa.com"
    for _ in range(5):
        assert requests.post(f"{BASE_URL}/api/auth/login-failed", json={"email": email}, timeout=30).status_code == 200
    r = requests.post(f"{BASE_URL}/api/auth/login-check", json={"email": email}, timeout=30).json()
    _cleanup_user(email)
    assert r["locked"] is True and r["retryAfterSeconds"] > 800


# ---------- Download links used via <a>/<iframe>/window.open (no Bearer possible) ----------
def test_recibo_sena_public_for_guest_links(admin_tok):
    res = requests.get(f"{BASE_URL}/api/rentals/reservations", headers=H(admin_tok), timeout=60).json()
    items = res if isinstance(res, list) else res.get("items", [])
    if not items:
        pytest.skip("no reservations")
    rid = items[0]["id"]
    r = requests.get(f"{BASE_URL}/api/rentals/reservations/{rid}/recibo-sena", timeout=30)
    # Frontend opens this in iframe + shares it by WhatsApp to the guest -> cannot carry Bearer
    assert r.status_code != 401, "recibo-sena requires Bearer but is opened via iframe/WhatsApp link"


# ---------- Secretaria can create/edit in liquidaciones (cleanup by admin) ----------
def test_secretaria_create_edit_movimiento(sec_tok, admin_tok):
    props = requests.get(f"{BASE_URL}/api/rentals/properties", headers=H(sec_tok), timeout=30).json()
    items = props if isinstance(props, list) else props.get("items", [])
    test_props = [p for p in items if "TEST" in (p.get("titulo") or "")] or items
    if not test_props:
        pytest.skip("no rental properties")
    pid = test_props[0]["id"]
    r = requests.post(f"{BASE_URL}/api/rentals/movimientos", headers=H(sec_tok),
                      json={"propertyId": pid, "fecha": "2026-01-10", "tipo": "gasto_nuestro", "monto": 1, "descripcion": "TEST_sec_mov"}, timeout=30)
    assert r.status_code in (200, 201), r.text
    mid = r.json()["id"]
    try:
        e = requests.put(f"{BASE_URL}/api/rentals/movimientos/{mid}", headers=H(sec_tok), json={"monto": 2}, timeout=30)
        assert e.status_code == 200, e.text
        assert requests.delete(f"{BASE_URL}/api/rentals/movimientos/{mid}", headers=H(sec_tok), timeout=30).status_code == 403
    finally:
        assert requests.delete(f"{BASE_URL}/api/rentals/movimientos/{mid}", headers=H(admin_tok), timeout=30).status_code in (200, 204)


# ---------- Public regressions: endpoints consumed by anonymous visitors / crawlers ----------
def test_rentals_settings_public_for_reservar_page():
    # ReservarPropiedad.tsx (public pre-reserva page) loads condiciones generales from here
    r = requests.get(f"{BASE_URL}/api/rentals/settings", timeout=30)
    assert r.status_code == 200, f"GET /api/rentals/settings anonymous -> {r.status_code}"


def test_property_share_page_public():
    # PublicPropertyDetail.tsx shares /api/properties/{id}/share (OG tags for WhatsApp crawlers)
    lst = requests.get(f"{BASE_URL}/api/public/listings", timeout=30).json()
    items = lst if isinstance(lst, list) else (lst.get("items") or lst.get("listings") or [])
    if not items:
        pytest.skip("no public listings")
    r = requests.get(f"{BASE_URL}/api/properties/{items[0]['id']}/share", timeout=30, allow_redirects=False)
    assert r.status_code == 200, f"share page anonymous -> {r.status_code}"
