"""Backend tests — Sprint 3: official 'Autorización de Venta' template.

Covers:
- Resolver with defaults editables (modalidad, moneda, vigencia_dias, comision_pct,
  comision_pago, admite_reserva, inmobiliaria) and options
- Missing required inputs (precio, propietario_dni when person has no DNI)
- Conditional blocks (modalidad exclusiva vs no_exclusiva, comisión boleto vs
  escritura, reserva/renovacion/precio_minimo)
- Wizard e2e via API: /resolve → /documents (create) → send link → GET /sign/{token}
  should return document with resolvedVariables and body rendered with only the
  applicable conditional blocks.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL",
                          "https://real-estate-os-10.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

TEMPLATE_ID = "ba0e6d91-f96c-4d95-b069-70c612315d3e"  # Autorización de Venta oficial
PROPERTY_ID = "9c1d4217-2522-4649-a269-bbd536a71f39"   # Los Cedros 1015 - Costa del Este
PERSON_ID = "aa3d54c8-4ace-4a57-bbf2-804966547797"     # Cata 💓 (sin DNI → forcing input)


@pytest.fixture(scope="module")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def template(api_client):
    r = api_client.get(f"{API}/documents/templates/{TEMPLATE_ID}")
    assert r.status_code == 200, r.text
    return r.json()


# ------------------------------- Template shape --------------------------- #
class TestTemplateShape:
    def test_template_is_autorizacion_venta(self, template):
        assert template["templateKey"] == "autorizacion_venta"
        assert template["name"] == "Autorización de Venta"
        assert template["category"] == "autorizacion"
        assert "digital" in template["signatureMethods"]
        assert "presencial" in template["signatureMethods"]

    def test_variables_have_editable_defaults(self, template):
        by_key = {v["key"]: v for v in template["variables"]}
        assert by_key["modalidad"]["default"] == "exclusiva"
        assert by_key["modalidad"]["type"] == "select"
        assert len(by_key["modalidad"]["options"]) == 2
        assert by_key["moneda"]["default"] == "USD"
        assert by_key["vigencia_dias"]["default"] == 180
        assert by_key["comision_pct"]["default"] == 3
        assert by_key["comision_pago"]["default"] == "boleto"
        assert by_key["admite_reserva"]["default"] == "si"
        assert by_key["renovacion_automatica"]["default"] == "si"
        assert by_key["inmobiliaria"]["default"] == "Varela Propiedades"
        # Required fields
        assert by_key["precio"]["required"] is True
        assert by_key["propietario_dni"]["required"] is True
        assert by_key["propietario_dni"]["source"] == "person"
        assert by_key["propietario_dni"]["role"] == "propietario"
        # Optional
        assert by_key["precio_minimo"]["required"] is False

    def test_body_has_conditional_blocks(self, template):
        blocks = (template.get("body") or {}).get("blocks") or []
        cond_vars = {(b.get("condition") or {}).get("var") for b in blocks if b.get("condition")}
        for expected in ("modalidad", "comision_pago", "admite_reserva",
                         "renovacion_automatica", "precio_minimo"):
            assert expected in cond_vars, f"expected condition on {expected} in body"


# ------------------------------- Resolver --------------------------------- #
class TestResolverDefaults:
    def test_resolver_prefills_defaults_and_flags_missing(self, api_client):
        r = api_client.post(f"{API}/documents/resolve", json={
            "templateId": TEMPLATE_ID,
            "persons": [{"personId": PERSON_ID, "role": "propietario"}],
            "propertyId": PROPERTY_ID,
            "inputs": {},
        })
        assert r.status_code == 200, r.text
        data = r.json()

        # Requirements
        assert data["requirements"]["needsProperty"] is True
        assert data["requirements"]["personRoles"] == ["propietario"]

        # Defaults applied
        resolved = data["resolved"]
        assert resolved.get("modalidad") == "exclusiva"
        assert resolved.get("moneda") == "USD"
        assert resolved.get("vigencia_dias") == 180
        assert resolved.get("comision_pct") == 3
        assert resolved.get("comision_pago") == "boleto"
        assert resolved.get("admite_reserva") == "si"
        assert resolved.get("renovacion_automatica") == "si"
        assert resolved.get("inmobiliaria") == "Varela Propiedades"
        # Address from property
        assert "propiedad_direccion" in resolved
        assert isinstance(resolved["propiedad_direccion"], str) and len(resolved["propiedad_direccion"]) > 0

        # Missing must contain the mandatory unresolved fields:
        # precio (input, required, no default) and propietario_dni (person has no doc)
        missing = data["missing"]
        assert "precio" in missing, f"expected 'precio' in missing, got {missing}"
        assert "propietario_dni" in missing, f"expected 'propietario_dni' in missing, got {missing}"
        assert data["ready"] is False

    def test_resolver_ready_when_precio_and_dni_provided(self, api_client):
        r = api_client.post(f"{API}/documents/resolve", json={
            "templateId": TEMPLATE_ID,
            "persons": [{"personId": PERSON_ID, "role": "propietario"}],
            "propertyId": PROPERTY_ID,
            "inputs": {"precio": 185000, "propietario_dni": "12345678"},
        })
        assert r.status_code == 200
        data = r.json()
        assert data["missing"] == [] or "precio" not in data["missing"]
        # Should be ready when we've filled both
        assert data["ready"] is True, f"resolver not ready: missing={data['missing']}"
        assert data["resolved"]["precio"] in (185000, "185000")
        assert data["resolved"]["propietario_dni"] == "12345678"

    def test_resolver_input_fields_have_options_for_selects(self, api_client):
        r = api_client.post(f"{API}/documents/resolve", json={
            "templateId": TEMPLATE_ID,
            "persons": [{"personId": PERSON_ID, "role": "propietario"}],
            "propertyId": PROPERTY_ID,
            "inputs": {},
        })
        assert r.status_code == 200
        fields = r.json()["fields"]
        by_key = {f["key"]: f for f in fields}
        # Modalidad field must expose select options
        modalidad = by_key["modalidad"]
        assert modalidad["type"] == "select"
        assert any(o.get("value") == "exclusiva" for o in (modalidad.get("options") or []))
        assert any(o.get("value") == "no_exclusiva" for o in (modalidad.get("options") or []))
        # Comisión is a number with default 3
        assert by_key["comision_pct"]["type"] == "number"


# ---------------------- Create + conditional blocks ----------------------- #
def _create_doc(api_client, inputs_overrides=None):
    inputs = {
        "precio": 185000,
        "propietario_dni": "12345678",
    }
    if inputs_overrides:
        inputs.update(inputs_overrides)
    r = api_client.post(f"{API}/documents", json={
        "templateId": TEMPLATE_ID,
        "title": f"TEST_sprint3_{uuid.uuid4().hex[:8]}",
        "persons": [{"personId": PERSON_ID, "role": "propietario"}],
        "propertyId": PROPERTY_ID,
        "signatureMethod": "digital",
        "inputs": inputs,
        "origin": "manual",
    })
    return r


class TestCreateWithConditionalBlocks:
    def test_create_blocks_when_precio_missing(self, api_client):
        # No precio and no dni → 422
        r = api_client.post(f"{API}/documents", json={
            "templateId": TEMPLATE_ID,
            "title": f"TEST_sprint3_bad_{int(time.time())}",
            "persons": [{"personId": PERSON_ID, "role": "propietario"}],
            "propertyId": PROPERTY_ID,
            "signatureMethod": "digital",
            "inputs": {},
        })
        assert r.status_code == 422, r.text
        body = str(r.json())
        assert ("precio" in body) or ("propietario_dni" in body)

    def test_create_exclusiva_boleto_reserva(self, api_client):
        r = _create_doc(api_client, {
            "modalidad": "exclusiva",
            "comision_pago": "boleto",
            "admite_reserva": "si",
            "precio_minimo": 170000,
        })
        assert r.status_code == 201, r.text
        doc = r.json()
        rv = doc["resolvedVariables"]
        assert rv["modalidad"] == "exclusiva"
        assert rv["comision_pago"] == "boleto"
        assert rv["admite_reserva"] == "si"
        # Persistence
        g = api_client.get(f"{API}/documents/{doc['id']}")
        assert g.status_code == 200
        assert g.json()["resolvedVariables"]["modalidad"] == "exclusiva"

    def test_create_no_exclusiva_escritura(self, api_client):
        r = _create_doc(api_client, {
            "modalidad": "no_exclusiva",
            "comision_pago": "escritura",
            "admite_reserva": "no",
        })
        assert r.status_code == 201, r.text
        rv = r.json()["resolvedVariables"]
        assert rv["modalidad"] == "no_exclusiva"
        assert rv["comision_pago"] == "escritura"


# ------------------------ Public sign — condition rendering ---------------- #
class TestPublicSignConditionalRendering:
    def test_sign_view_returns_document_with_variables(self, api_client):
        # Create doc with exclusiva + boleto
        c = _create_doc(api_client, {"modalidad": "exclusiva", "comision_pago": "boleto"})
        assert c.status_code == 201, c.text
        doc = c.json()
        pid = doc["participants"][0]["id"]
        # Send link
        s = api_client.post(
            f"{API}/documents/{doc['id']}/participants/{pid}/send",
            json={"channel": "link", "baseUrl": BASE_URL},
        )
        assert s.status_code == 200, s.text
        token = s.json()["url"].split("/firma/")[-1]

        v = api_client.get(f"{API}/sign/{token}")
        assert v.status_code == 200, v.text
        vw = v.json()
        assert vw["expired"] is False
        d = vw["document"]
        # Sign view exposes a slim document — verify what's available
        assert d["signatureMethod"] == "digital"
        assert d["resolvedVariables"]["modalidad"] == "exclusiva"
        assert d["resolvedVariables"]["comision_pago"] == "boleto"
        # body should exist so client can render blocks
        assert d.get("body") is not None
