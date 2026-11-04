# Tasaciones: semicubiertos al 50% del m² cubierto + lote libre = terreno - cub - semicub (iteration 84)
import base64
import io
import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api/tasacion"
PUB = f"{BASE_URL}/api/public/tasacion"
TAG = f"TEST_semi_{uuid.uuid4().hex[:6]}"

BODY = {"tipo": "duplex", "zona": "av2", "cubiertos": 70, "semicubiertos": 20, "lote": 190,
        "calidad": "economica", "estado": "bueno", "antiguedad": "hasta10"}


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    yield sess
    # cleanup only manuales created by this module (unique TAG in direccion)
    items = sess.get(f"{API}/manuales", params={"limit": 500}).json().get("items", [])
    for it in items:
        if TAG in str(it.get("direccion") or ""):
            sess.delete(f"{API}/manuales/{it['id']}")


def _steps(r):
    return {b["paso"]: b["valor"] for b in r["breakdown"]}


# Core: user's reported case
def test_calcular_duplex_with_semicubiertos(s):
    r = s.post(f"{API}/calcular", json=BODY)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["pm2Constr"] == 850
    assert d["valorSemicub"] == 8500
    assert d["valorLote"] == 20500
    st = _steps(d)
    assert st.get("construcción cubierta (70m² × 850.0)") == 59500
    assert st.get("construcción semicubierta (20m² × 425, 50%)") == 8500
    assert st.get("lote libre (100m² × 205.0)") == 20500
    assert d["precioBase"] == 88500
    assert d["pubMin"] == 84500 and d["pubMax"] == 92500
    assert d["cierreMin"] == 70500 and d["cierreMax"] == 76500


# Regression: without semicubiertos identical to old formula
@pytest.mark.parametrize("semi", [0, None])
def test_calcular_without_semicubiertos_regression(s, semi):
    b = dict(BODY)
    if semi is None:
        b.pop("semicubiertos")
    else:
        b["semicubiertos"] = semi
    d = s.post(f"{API}/calcular", json=b).json()
    assert d["valorSemicub"] == 0
    assert len(d["breakdown"]) == 2
    assert d["valorLote"] == 120 * 205
    assert d["precioBase"] == 70 * 850 + 120 * 205  # 84100


def test_semicub_exceeding_lote_clamps_lote_libre(s):
    b = dict(BODY, cubiertos=150, semicubiertos=60, lote=190)
    d = s.post(f"{API}/calcular", json=b).json()
    assert d["valorLote"] == 0
    assert d["precioBase"] == 150 * 850 + 60 * 425


def test_semicub_other_calidad_and_multipliers(s):
    b = dict(BODY, calidad="estandar", estado="excelente", antiguedad="estrenar")
    d = s.post(f"{API}/calcular", json=b).json()
    assert d["pm2Constr"] == 1150
    assert d["valorSemicub"] == 20 * 575
    expected = (70 * 1150 + 20 * 575 + 100 * 205) * 1.12 * 1.12
    assert abs(d["precioBase"] - expected) <= 1


def test_depto_and_lote_unaffected_by_semicub(s):
    d = s.post(f"{API}/calcular", json={"tipo": "lote", "zona": "av2", "lote": 190, "semicubiertos": 20}).json()
    assert d["precioBase"] == 190 * 205
    d2 = s.post(f"{API}/calcular", json={"tipo": "depto", "zona": "av2", "cubiertos": 50,
                                         "ambientes": "2", "semicubiertos": 20}).json()
    assert d2["valorSemicub"] == 0


def _jpg(s, body):
    r = s.post(f"{API}/jpg", json=body)
    assert r.status_code == 200, r.text[:300]
    return r


def _decode(r):
    ct = r.headers.get("content-type", "")
    if "image" in ct:
        return r.content
    j = r.json()
    raw = j.get("image") or j.get("jpg") or j.get("base64") or j.get("data") or ""
    if "," in raw[:50]:
        raw = raw.split(",", 1)[1]
    return base64.b64decode(raw)


@pytest.mark.parametrize("semi,name", [(20, "with_semi"), (0, "no_semi")])
def test_jpg_generation(s, semi, name):
    body = dict(BODY, semicubiertos=semi, direccion=f"{TAG} calle {name}", propietario="TEST_Owner")
    raw = _decode(_jpg(s, body))
    assert raw[:3] == b"\xff\xd8\xff"
    with open(f"/app/test_reports/tas_semi_{name}.jpg", "wb") as f:
        f.write(raw)


def test_public_simular_casa_with_semicub_no_500(s):
    b = {"tipo": "casa", "zona": "av2", "cubiertos": 70, "semicubiertos": 20, "lote": 190,
         "calidad": "economica", "estado": "bueno", "antiguedad": "hasta10"}
    r = s.post(f"{PUB}/simular", json=b)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d.get("estMin", 0) > 0


def test_public_estimar_applies_semicub(s):
    """Public tasador should reflect semicubiertos (50%) — compare with/without."""
    b = {"tipo": "casa", "zona": "av2", "cubiertos": 70, "lote": 190,
         "calidad": "economica", "estado": "bueno", "antiguedad": "hasta10"}
    r0 = s.post(f"{PUB}/estimar", json=b)
    r1 = s.post(f"{PUB}/estimar", json=dict(b, semicubiertos=20))
    assert r0.status_code == 200 and r1.status_code == 200
    assert r1.json()["estMax"] != r0.json()["estMax"], "public estimar ignores semicubiertos"
