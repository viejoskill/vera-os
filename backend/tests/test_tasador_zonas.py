"""Tests for the 22-zone Tasador overhaul (public estimator + config)."""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://real-estate-os-10.preview.emergentagent.com").rstrip("/")

EXPECTED_ZONES = [
    "comercial_ruta",
    "pensamientos_sur", "pensamientos_centro", "pensamientos_norte",
    "cristo_sur", "cristo_centro", "cristo_norte",
    "centro_sur", "centro", "centro_norte",
    "reserva_residencial", "reserva_comercial",
    "premium", "premium_norte",
    "playa", "playa_norte",
    "av_costanera", "av2", "av_interbalnearia",
    "camelias", "los_pensamientos", "los_alelies",
]

ZONE_NAMES = {
    "premium_norte": "Zona Premium Norte",
    "av2": "Av. 2",
    "los_alelies": "Los Alelies",
    "reserva_comercial": "La Reserva Comercial",
    "playa": "Zona Playa",
    "cristo_centro": "Zona Cristo Centro",
    "comercial_ruta": "Zona Comercial Ruta",
    "centro": "Zona Centro",
}


class TestTasadorConfig:
    def test_config_has_all_22_lote_zones(self):
        r = requests.get(f"{BASE_URL}/api/tasacion/config", timeout=15)
        assert r.status_code == 200
        payload = r.json()
        values = payload.get("values", payload)
        missing = [z for z in EXPECTED_ZONES if f"precio_lote_{z}" not in values]
        assert not missing, f"Missing precio_lote_ keys: {missing}"

    def test_config_preserves_av2_calibrated_value(self):
        r = requests.get(f"{BASE_URL}/api/tasacion/config", timeout=15)
        values = r.json().get("values", r.json())
        assert values.get("precio_lote_av2") == 205, "precio_lote_av2 must be 205 (preserved calibrated value)"

    def test_config_no_old_zone_names_still_active(self):
        """Old keys 'alelies' and 'reserva_multif' should be migrated (not exposed as separate keys)."""
        r = requests.get(f"{BASE_URL}/api/tasacion/config", timeout=15)
        values = r.json().get("values", r.json())
        # If they exist, they should at least be 0 (migrated away). Report if they're non-zero.
        for old_key in ("precio_lote_alelies", "precio_lote_reserva_multif"):
            if old_key in values:
                assert values[old_key] == 0, f"Legacy key {old_key} still has value {values[old_key]}"


class TestEstimadorZonaNames:
    @pytest.mark.parametrize("zona,expected", list(ZONE_NAMES.items()))
    def test_estimar_returns_correct_zona_nombre(self, zona, expected):
        r = requests.post(
            f"{BASE_URL}/api/public/tasacion/estimar",
            json={"tipo": "lote", "zona": zona, "lote": 500, "nombre": "TEST_qa", "telefono": "1234567"},
            timeout=20,
        )
        assert r.status_code == 200, f"zona={zona} -> {r.status_code}: {r.text[:200]}"
        data = r.json()
        assert data.get("zonaNombre") == expected, f"zona={zona}: got {data.get('zonaNombre')!r}, expected {expected!r}"
        assert isinstance(data.get("base"), (int, float))
        assert data["base"] > 0, f"base price for {zona} should be > 0"

    def test_estimar_all_22_zonas_accepted(self):
        failing = []
        for z in EXPECTED_ZONES:
            r = requests.post(
                f"{BASE_URL}/api/public/tasacion/estimar",
                json={"tipo": "lote", "zona": z, "lote": 400, "nombre": "TEST_qa", "telefono": "12345"},
                timeout=20,
            )
            if r.status_code != 200:
                failing.append((z, r.status_code, r.text[:120]))
                continue
            j = r.json()
            if not j.get("zonaNombre"):
                failing.append((z, "no zonaNombre", ""))
        assert not failing, f"Failing zones: {failing}"
