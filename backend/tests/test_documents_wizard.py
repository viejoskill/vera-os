"""Backend tests — Sprint 2: Document Creation Wizard.

Covers POST /api/documents/resolve and POST /api/documents (create) with:
- Person-role variable resolution (source=person, role=vendedor)
- Missing/ready flip
- Input override (origin=input) even without a person
- Create-blocking when required variable is missing
- Persisted resolvedVariables + created relationship + created event
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://real-estate-os-10.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

# Real template with a person-role variable (from review_request)
AUTH_TEMPLATE_ID = "7a9a0897-5c27-4ce3-a2d7-7c5ae7d8dc0d"


@pytest.fixture(scope="module")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def a_person_id(api_client):
    r = api_client.get(f"{API}/people")
    assert r.status_code == 200, r.text
    people = r.json()
    assert isinstance(people, list) and len(people) >= 1, "Need at least 1 real person"
    return people[0]["id"]


@pytest.fixture(scope="module")
def template(api_client):
    r = api_client.get(f"{API}/documents/templates/{AUTH_TEMPLATE_ID}")
    assert r.status_code == 200, r.text
    t = r.json()
    # Sanity — must be the person/vendedor template
    assert any(v.get("source") == "person" and v.get("role") == "vendedor" and v.get("required")
               for v in t["variables"]), "Template missing person-role vendedor required variable"
    return t


# ------------------------------- /resolve --------------------------------- #
class TestResolveEndpoint:
    def test_resolve_missing_when_no_person(self, api_client, template):
        r = api_client.post(f"{API}/documents/resolve", json={
            "templateId": template["id"],
            "persons": [],
            "inputs": {},
        })
        assert r.status_code == 200, r.text
        data = r.json()

        # Shape assertions
        assert "requirements" in data
        assert "resolved" in data
        assert "missing" in data
        assert "warnings" in data
        assert "fields" in data
        assert "ready" in data

        # requirements should be camelCase and reflect the template
        req = data["requirements"]
        assert req["needsProperty"] is False
        assert req["personRoles"] == ["vendedor"]
        assert isinstance(req["inputFields"], list)

        # Without a person → seller_name missing, not ready
        assert "seller_name" in data["missing"]
        assert data["ready"] is False
        assert "seller_name" not in data["resolved"]

        # Field for seller_name has status=missing
        seller = next(f for f in data["fields"] if f["key"] == "seller_name")
        assert seller["status"] == "missing"
        assert seller["required"] is True
        assert seller["source"] == "person"
        assert seller["role"] == "vendedor"

    def test_resolve_ready_when_person_assigned(self, api_client, template, a_person_id):
        r = api_client.post(f"{API}/documents/resolve", json={
            "templateId": template["id"],
            "persons": [{"personId": a_person_id, "role": "vendedor"}],
            "inputs": {},
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["ready"] is True
        assert data["missing"] == []
        assert "seller_name" in data["resolved"]
        assert isinstance(data["resolved"]["seller_name"], str)
        assert len(data["resolved"]["seller_name"]) > 0

        seller = next(f for f in data["fields"] if f["key"] == "seller_name")
        assert seller["status"] == "resolved"
        assert seller["origin"] == "person"

    def test_resolve_input_override_without_person(self, api_client, template):
        r = api_client.post(f"{API}/documents/resolve", json={
            "templateId": template["id"],
            "persons": [],
            "inputs": {"seller_name": "OVERRIDE Doe"},
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["ready"] is True
        assert data["missing"] == []
        assert data["resolved"]["seller_name"] == "OVERRIDE Doe"

        seller = next(f for f in data["fields"] if f["key"] == "seller_name")
        assert seller["status"] == "resolved"
        assert seller["origin"] == "input"

    def test_resolve_template_not_found(self, api_client):
        r = api_client.post(f"{API}/documents/resolve", json={
            "templateId": "00000000-0000-0000-0000-000000000000",
            "persons": [],
            "inputs": {},
        })
        assert r.status_code == 404


# ---------------------- POST /api/documents (create) ---------------------- #
class TestCreateDocument:
    def test_create_blocks_when_required_missing(self, api_client, template, a_person_id):
        # Provide a person with a DIFFERENT role so there IS at least one
        # relationship, but the required vendedor variable still cannot be resolved.
        r = api_client.post(f"{API}/documents", json={
            "templateId": template["id"],
            "persons": [{"personId": a_person_id, "role": "comprador"}],
            "inputs": {},
        })
        assert r.status_code == 422, r.text
        detail = r.json().get("detail")
        body_str = str(detail)
        # Detail must clearly identify the missing required variable
        assert "seller_name" in body_str, body_str

    def test_create_with_person_persists_resolved_and_relationship(self, api_client, template, a_person_id):
        title = f"TEST_wizard_{int(time.time())}"
        r = api_client.post(f"{API}/documents", json={
            "templateId": template["id"],
            "title": title,
            "persons": [{"personId": a_person_id, "role": "vendedor"}],
            "inputs": {},
            "origin": "manual",
        })
        assert r.status_code == 201, r.text
        doc = r.json()

        # Contract camelCase
        assert doc["title"] == title
        assert doc["templateId"] == template["id"]
        assert doc["templateKey"] == template["templateKey"]
        assert doc["templateVersion"] == template["version"]
        assert doc["category"] == template["category"]
        assert doc["status"] == "draft"
        assert doc["pdfStatus"] == "none"

        # resolvedVariables populated
        assert "resolvedVariables" in doc
        assert doc["resolvedVariables"], "resolvedVariables should be populated"
        assert "seller_name" in doc["resolvedVariables"]
        assert isinstance(doc["resolvedVariables"]["seller_name"], str)

        # Relationships include the person
        rels = doc.get("relationships") or []
        assert any(r.get("entityType") == "person" and r.get("entityId") == a_person_id
                   and r.get("role") == "vendedor" for r in rels), f"Expected person rel, got: {rels}"

        doc_id = doc["id"]

        # GET verifies persistence
        g = api_client.get(f"{API}/documents/{doc_id}")
        assert g.status_code == 200
        fetched = g.json()
        assert fetched["id"] == doc_id
        assert "seller_name" in (fetched.get("resolvedVariables") or {})

        # History has created event
        h = api_client.get(f"{API}/documents/{doc_id}/history")
        assert h.status_code == 200
        events = h.json()
        assert isinstance(events, list) and len(events) >= 1
        kinds = [e.get("type") or e.get("kind") or e.get("event") for e in events]
        # At least one event was recorded (creation) — accept different keys
        assert any(k for k in kinds), f"No event kinds found: {events}"

    def test_create_appears_in_list(self, api_client, template, a_person_id):
        title = f"TEST_wizard_list_{int(time.time())}"
        r = api_client.post(f"{API}/documents", json={
            "templateId": template["id"],
            "title": title,
            "persons": [{"personId": a_person_id, "role": "vendedor"}],
        })
        assert r.status_code == 201
        new_id = r.json()["id"]

        g = api_client.get(f"{API}/documents")
        assert g.status_code == 200
        ids = [d["id"] for d in g.json()]
        assert new_id in ids
