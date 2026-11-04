# Tasación: valor del lote = superficie TOTAL del terreno × precio zona (fix iteration_85)
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
CALC = f"{BASE_URL}/api/tasacion/calcular"
JPG = f"{BASE_URL}/api/tasacion/jpg"

BASE = {"calidad": "economica", "estado": "bueno", "antiguedad": "hasta10"}


def _calc(body):
    r = requests.post(CALC, json=body, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


def _find(d, key):
    if isinstance(d, dict):
        if key in d:
            return d[key]
        for v in d.values():
            x = _find(v, key)
            if x is not None:
                return x
    return None


class TestLoteTotal:
    def test_casa_centro_user_case(self):
        d = _calc({**BASE, "tipo": "casa", "zona": "centro", "cubiertos": 70, "semicubiertos": 20, "lote": 200})
        assert _find(d, "valorLote") == pytest.approx(17400)
        assert _find(d, "valorSemicub") == pytest.approx(8500)
        assert _find(d, "pm2Constr") == pytest.approx(850)
        bd = _find(d, "breakdown")
        line = [b for b in bd if b["paso"].startswith("lote (200m² × 87")]
        assert line and line[0]["valor"] == pytest.approx(17400)
        assert sum(b["valor"] for b in bd) == pytest.approx(85400)
        print("casa centro:", {k: _find(d, k) for k in ["precioBase", "valorLote", "valorSemicub"]})

    def test_duplex_av2(self):
        d = _calc({**BASE, "tipo": "duplex", "zona": "av2", "cubiertos": 70, "semicubiertos": 20, "lote": 190})
        assert _find(d, "valorLote") == pytest.approx(38950)
        bd = _find(d, "breakdown")
        assert sum(b["valor"] for b in bd) == pytest.approx(106950)

    def test_lote_larger_than_built_not_subtracted(self):
        # lote smaller than built area: old formula would give 0
        d = _calc({**BASE, "tipo": "casa", "zona": "centro", "cubiertos": 150, "semicubiertos": 50, "lote": 100})
        assert _find(d, "valorLote") == pytest.approx(8700)

    def test_lote_puro(self):
        d = _calc({"tipo": "lote", "zona": "centro", "lote": 200})
        bd = _find(d, "breakdown")
        assert bd[0]["valor"] == pytest.approx(17400)

    def test_depto_unaffected(self):
        d = _calc({"tipo": "depto", "zona": "centro", "cubiertos": 50, "ambientes": "2", "vista": "frente", "antDepto": "reciente"})
        assert not _find(d, "valorLote")

    def test_jpg_casa_centro(self):
        r = requests.post(JPG, json={**BASE, "tipo": "casa", "zona": "centro", "cubiertos": 70, "semicubiertos": 20, "lote": 200}, timeout=60)
        assert r.status_code == 200, r.text[:300]
        raw = r.content
        if "image" not in r.headers.get("content-type", ""):
            import base64
            j = r.json()
            b = j.get("image") or j.get("jpg") or j.get("base64") or j.get("data") or ""
            if "," in b[:100]:
                b = b.split(",", 1)[1]
            raw = base64.b64decode(b)
        assert raw[:3] == b"\xff\xd8\xff"
        with open("/app/test_reports/tas_lote_total.jpg", "wb") as f:
            f.write(raw)
