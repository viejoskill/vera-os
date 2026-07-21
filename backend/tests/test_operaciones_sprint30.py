"""Sprint Operaciones + Completar Proyecciones — regression tests for iteration_30.

Scope (per review_request):
  1) GET /api/core/kpis returns full shape with coherent numbers.
  2) GET /api/core/activity?limit=40 returns Spanish labels, desc order.
  3) POST /api/events (PropertyInquiry) → GET /api/people?query=<name>
     must project lastContact != null and conversationsCount >= 1.
  4) PATCH /api/core/tasks/{id} status=hecha removes the task from
     GET /api/core/tasks?status=pendiente.

The full projection matrix is already green (iteration_29) — do not re-run.
"""
from __future__ import annotations

import os
import time
import uuid

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _phone() -> str:
    """Unique +549299xxxxxxx test phone."""
    return f"+549299{uuid.uuid4().int % 10_000_000:07d}"


def _post_event(api_client, body: dict) -> dict:
    r = api_client.post(f"{API}/events", json=body)
    assert r.status_code in (200, 201), f"POST /api/events failed: {r.status_code} {r.text}"
    return r.json()


# --- 1) KPIs -------------------------------------------------------------- #
class TestKpis:
    """GET /api/core/kpis — shape + coherence."""

    def test_kpis_shape_and_coherence(self, api_client):
        r = api_client.get(f"{API}/core/kpis")
        assert r.status_code == 200
        data = r.json()
        for k in ("personas", "leadsActivos", "oportunidadesAbiertas",
                  "tareasPendientes", "conversacionesHoy"):
            assert k in data, f"Missing key: {k}"
            assert isinstance(data[k], int), f"{k} must be int, got {type(data[k])}"
            assert data[k] >= 0, f"{k} must be >=0"

        # Cross-check kpis.personas against GET /api/people
        people = api_client.get(f"{API}/people").json()
        assert data["personas"] == len(people), (
            f"kpis.personas={data['personas']} != len(/api/people)={len(people)}"
        )

        # leadsActivos <= total leads returned by /api/core/leads
        leads = api_client.get(f"{API}/core/leads").json()["leads"]
        active_leads = [l for l in leads if l["status"] not in ("convertido", "perdido")]
        assert data["leadsActivos"] == len(active_leads)

        # tareasPendientes matches list with filter
        pending = api_client.get(f"{API}/core/tasks?status=pendiente").json()["tasks"]
        assert data["tareasPendientes"] == len(pending)


# --- 2) Activity ---------------------------------------------------------- #
class TestActivity:
    """GET /api/core/activity — spanish labels, desc order."""

    _EXPECTED_LABELS = {
        "PersonCreated": "Persona creada",
        "ConversationStarted": "Conversación iniciada",
        "MessageReceived": "Mensaje recibido",
        "PropertyInquiry": "Consulta de propiedad",
        "VisitScheduled": "Visita agendada",
        "PropertyVisited": "Propiedad visitada",
        "OpportunityCreated": "Oportunidad creada",
        "OfferSent": "Oferta enviada",
        "PropertyReserved": "Propiedad reservada",
        "PropertySold": "Venta cerrada",
    }

    def test_activity_shape_and_order(self, api_client):
        r = api_client.get(f"{API}/core/activity?limit=40")
        assert r.status_code == 200
        data = r.json()
        assert "activity" in data
        acts = data["activity"]
        assert isinstance(acts, list)
        assert len(acts) <= 40

        # Shape of each activity item
        for a in acts:
            for k in ("id", "at", "type", "label", "personId", "personName", "source"):
                assert k in a, f"Missing key {k} in activity item"
            # Spanish label mapping when available
            if a["type"] in self._EXPECTED_LABELS:
                assert a["label"] == self._EXPECTED_LABELS[a["type"]], (
                    f"Label mismatch for {a['type']}: got {a['label']!r}"
                )

        # Ordered by `at` DESC (nulls allowed at end)
        times = [a["at"] or "" for a in acts]
        assert times == sorted(times, reverse=True), "activity not sorted desc by 'at'"


# --- 3) Person projection: lastContact + conversationsCount --------------- #
class TestPersonProjection:
    """POST PropertyInquiry event → Person appears with lastContact + conversationsCount>=1."""

    def test_seed_from_review_request_and_verify(self, api_client):
        # Exact seed body from the review request, with a UNIQUE phone/idempKey/convId
        phone = _phone()
        idem = f"qa-seed-{uuid.uuid4().hex[:12]}"
        conv_id = f"qa-c-{uuid.uuid4().hex[:8]}"
        name = f"QA Uno {uuid.uuid4().hex[:6]}"
        body = {
            "type": "PropertyInquiry",
            "source": "whatsapp",
            "contact": {"phone": phone, "name": name},
            "subject": {"propertyId": "qa-p1", "propertyCode": "QA-P1"},
            "payload": {"conversationId": conv_id},
            "idempotencyKey": idem,
        }
        ingest = _post_event(api_client, body)
        assert ingest.get("deduped") is not True
        assert ingest.get("personId"), f"Ingest did not return personId: {ingest}"

        # Give async projection a beat (defensively — ingest is synchronous by design)
        time.sleep(0.5)

        # Query people by name (search on fullName)
        r = api_client.get(f"{API}/people", params={"query": name})
        assert r.status_code == 200
        people = r.json()
        assert isinstance(people, list) and len(people) >= 1, (
            f"Person '{name}' not found in /api/people: {people}"
        )
        # Find the exact match
        target = next((p for p in people if p["fullName"] == name), None)
        assert target is not None, f"Exact match for {name!r} not found"

        # KEY ASSERTIONS
        assert target.get("lastContact") is not None, (
            f"lastContact is None for freshly-projected person: {target}"
        )
        assert isinstance(target["lastContact"], str) and target["lastContact"], (
            f"lastContact should be non-empty ISO string, got {target.get('lastContact')!r}"
        )
        assert target.get("conversationsCount", 0) >= 1, (
            f"conversationsCount should be >=1, got {target.get('conversationsCount')}"
        )

    def test_second_event_bumps_conversations(self, api_client):
        """A second event with a DIFFERENT conversationId should bump conversationsCount."""
        phone = _phone()
        name = f"QA Dos {uuid.uuid4().hex[:6]}"

        # First conversation
        _post_event(api_client, {
            "type": "PropertyInquiry",
            "source": "whatsapp",
            "contact": {"phone": phone, "name": name},
            "subject": {"propertyId": "qa-p2", "propertyCode": "QA-P2"},
            "payload": {"conversationId": f"qa-c-a-{uuid.uuid4().hex[:6]}"},
            "idempotencyKey": f"qa-seed-{uuid.uuid4().hex[:12]}",
        })

        # Second conversation (different conversationId)
        _post_event(api_client, {
            "type": "MessageReceived",
            "source": "whatsapp",
            "contact": {"phone": phone, "name": name},
            "subject": {"propertyId": "qa-p2", "propertyCode": "QA-P2"},
            "payload": {"conversationId": f"qa-c-b-{uuid.uuid4().hex[:6]}"},
            "idempotencyKey": f"qa-seed-{uuid.uuid4().hex[:12]}",
        })
        time.sleep(0.5)

        r = api_client.get(f"{API}/people", params={"query": name})
        assert r.status_code == 200
        target = next((p for p in r.json() if p["fullName"] == name), None)
        assert target is not None
        # Two distinct conversationIds → should be >= 2
        assert target["conversationsCount"] >= 2, (
            f"Expected conversationsCount>=2, got {target['conversationsCount']}"
        )
        assert target["lastContact"] is not None


# --- 4) Task lifecycle from the ops board --------------------------------- #
class TestTaskLifecycle:
    """PATCH /api/core/tasks/{id} status=hecha removes it from pending list."""

    def test_complete_task_removes_from_pending(self, api_client):
        # Seed a MessageReceived event → creates a "responder" pending task
        phone = _phone()
        name = f"QA Task {uuid.uuid4().hex[:6]}"
        ingest = _post_event(api_client, {
            "type": "MessageReceived",
            "source": "whatsapp",
            "contact": {"phone": phone, "name": name},
            "subject": {"propertyId": "qa-task-1", "propertyCode": "QA-TASK-1"},
            "payload": {"conversationId": f"qa-c-{uuid.uuid4().hex[:6]}"},
            "idempotencyKey": f"qa-task-{uuid.uuid4().hex[:12]}",
        })
        person_id = ingest["personId"]
        time.sleep(0.4)

        # Find our pending task via list
        tasks = api_client.get(f"{API}/core/tasks?status=pendiente").json()["tasks"]
        mine = [t for t in tasks if t.get("personId") == person_id]
        assert mine, f"No pending task created for person {person_id}"
        task_id = mine[0]["id"]

        # Snapshot kpis
        kpis_before = api_client.get(f"{API}/core/kpis").json()

        # PATCH → hecha
        r = api_client.patch(f"{API}/core/tasks/{task_id}", json={"status": "hecha"})
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        updated = r.json()
        assert updated["status"] == "hecha"
        assert updated["id"] == task_id

        # Task should NOT appear in pending anymore
        tasks_after = api_client.get(f"{API}/core/tasks?status=pendiente").json()["tasks"]
        assert not any(t["id"] == task_id for t in tasks_after), (
            "Completed task still listed as pending"
        )

        # KPI tareasPendientes should have decreased by at least 1
        kpis_after = api_client.get(f"{API}/core/kpis").json()
        assert kpis_after["tareasPendientes"] <= kpis_before["tareasPendientes"] - 1, (
            f"tareasPendientes did not decrease: before={kpis_before['tareasPendientes']} "
            f"after={kpis_after['tareasPendientes']}"
        )

    def test_patch_task_invalid_id_404(self, api_client):
        # Use a valid ObjectId format that just does not exist in Mongo.
        # NOTE: passing a non-ObjectId string like "does-not-exist" currently returns 500
        # (bson.InvalidId not caught in store.update_task_status) — reported as minor bug.
        r = api_client.patch(
            f"{API}/core/tasks/{'a' * 24}",
            json={"status": "hecha"},
        )
        assert r.status_code == 404, f"Expected 404 for missing task, got {r.status_code}: {r.text}"

    def test_patch_task_non_objectid_should_not_500(self, api_client):
        """Non-ObjectId format on PATCH /api/core/tasks/{id} MUST NOT return 500.
        Expected behaviour: 404 (Task no encontrada) or 422 (formato inválido)."""
        r = api_client.patch(
            f"{API}/core/tasks/does-not-exist-abcd",
            json={"status": "hecha"},
        )
        assert r.status_code in (404, 422), (
            f"Backend leaks 500 on invalid ObjectId string: got {r.status_code}: {r.text}"
        )

    def test_patch_task_invalid_status_422(self, api_client):
        # First get an actual task id
        tasks = api_client.get(f"{API}/core/tasks?status=pendiente").json()["tasks"]
        if not tasks:
            # Seed one
            phone = _phone()
            ingest = _post_event(api_client, {
                "type": "MessageReceived",
                "source": "whatsapp",
                "contact": {"phone": phone, "name": f"QA422 {uuid.uuid4().hex[:6]}"},
                "subject": {"propertyId": "qa-422", "propertyCode": "QA-422"},
                "payload": {"conversationId": f"qa-c-{uuid.uuid4().hex[:6]}"},
                "idempotencyKey": f"qa-422-{uuid.uuid4().hex[:12]}",
            })
            time.sleep(0.3)
            tasks = api_client.get(f"{API}/core/tasks?status=pendiente").json()["tasks"]
            tasks = [t for t in tasks if t.get("personId") == ingest["personId"]]

        assert tasks, "Could not seed a pending task"
        r = api_client.patch(
            f"{API}/core/tasks/{tasks[0]['id']}",
            json={"status": "INVALIDO"},
        )
        assert r.status_code == 422


# --- 5) Opportunity funnel seeding (for frontend Ops column tests) -------- #
class TestOpportunitySeed:
    """Sanity: seeding VisitScheduled with subject.propertyId creates an opportunity
    that appears in the funnel — so the frontend Ops column has data to render."""

    def test_seed_opportunity_via_visit_scheduled(self, api_client):
        phone = _phone()
        name = f"QA Opp {uuid.uuid4().hex[:6]}"
        prop_id = f"qa-opp-{uuid.uuid4().hex[:8]}"
        ingest = _post_event(api_client, {
            "type": "VisitScheduled",
            "source": "whatsapp",
            "contact": {"phone": phone, "name": name},
            "subject": {"propertyId": prop_id, "propertyCode": prop_id.upper()},
            "payload": {"conversationId": f"qa-c-{uuid.uuid4().hex[:6]}"},
            "idempotencyKey": f"qa-opp-{uuid.uuid4().hex[:12]}",
        })
        person_id = ingest["personId"]
        time.sleep(0.4)

        opps = api_client.get(f"{API}/core/opportunities").json()["opportunities"]
        mine = [o for o in opps if o.get("personId") == person_id and o.get("propertyId") == prop_id]
        assert mine, f"No opportunity created for person {person_id} property {prop_id}"
        opp = mine[0]
        assert opp["stage"] in ("interes", "visita_agendada"), f"Unexpected stage {opp['stage']}"
        # This propertyId is used by the frontend to enable "Abrir Propiedad" button
        assert opp["propertyId"] == prop_id
