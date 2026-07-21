"""Backend tests for VERA Core projection handlers (Iteration 29).

Covers: POST /api/events ingestion → Lead/Opportunity/Task projections,
stage progression + no regression, lead status progression, MessageReceived
dedupe for 'responder' tasks, task lifecycle, idempotency, validation errors,
manual PATCH endpoints, rebuild endpoint, anonymous & PersonCreated events,
provider-agnostic sources, and GET /api/events/contract.
"""
from __future__ import annotations

import os
import random
import time
import uuid

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"


# ---------------- Helpers ---------------- #
def _unique_phone() -> str:
    """Unique AR-like phone per test person (avoid colliding with existing rows)."""
    return f"+549{random.randint(10_000_000_00, 99_999_999_99)}{int(time.time()*1000) % 1000:03d}"


def _post_event(**kwargs) -> requests.Response:
    return requests.post(f"{API}/events", json=kwargs, timeout=15)


def _find_lead(person_id: str) -> dict | None:
    r = requests.get(f"{API}/core/leads", timeout=15)
    r.raise_for_status()
    for lead in r.json().get("leads", []):
        if lead.get("personId") == person_id:
            return lead
    return None


def _find_opp(person_id: str, property_id: str) -> dict | None:
    r = requests.get(f"{API}/core/opportunities", timeout=15)
    r.raise_for_status()
    for opp in r.json().get("opportunities", []):
        if opp.get("personId") == person_id and opp.get("propertyId") == property_id:
            return opp
    return None


def _find_tasks(person_id: str, property_id: str | None = None, task_type: str | None = None,
                status: str | None = None) -> list[dict]:
    r = requests.get(f"{API}/core/tasks", timeout=15)
    r.raise_for_status()
    out = []
    for t in r.json().get("tasks", []):
        if t.get("personId") != person_id:
            continue
        if property_id is not None and t.get("propertyId") != property_id:
            continue
        if task_type is not None and t.get("type") != task_type:
            continue
        if status is not None and t.get("status") != status:
            continue
        out.append(t)
    return out


def _base_event(etype: str, phone: str, prop_id: str = "", source: str = "arturito",
                idem: str | None = None, extra_payload: dict | None = None) -> dict:
    env: dict = {
        "type": etype,
        "source": source,
        "contact": {"phone": phone, "name": f"TEST User {phone[-6:]}"},
        "subject": ({"propertyId": prop_id, "propertyCode": f"PROP-{prop_id[-4:]}"} if prop_id else {}),
        "payload": extra_payload or {},
    }
    if idem:
        env["idempotencyKey"] = idem
    return env


# ---------------- Health / Contract ---------------- #
class TestContract:
    def test_health(self):
        r = requests.get(f"{API}/health", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data.get("status") == "ok"

    def test_event_contract(self):
        r = requests.get(f"{API}/events/contract", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data["eventVersion"] == 1
        assert set(data["types"]) >= {
            "PersonCreated", "ConversationStarted", "MessageReceived", "PropertyInquiry",
            "VisitScheduled", "PropertyVisited", "OpportunityCreated", "OfferSent",
            "PropertyReserved", "PropertySold",
        }
        assert set(data["sources"]) >= {"arturito", "whatsapp", "kommo", "website", "crm"}


# ---------------- Property Inquiry creates Lead + Opportunity + Task ---------------- #
class TestPropertyInquiryFirstContact:
    def test_new_contact_creates_lead_opp_task(self):
        phone = _unique_phone()
        prop_id = f"prop-{uuid.uuid4().hex[:8]}"
        idem = f"test-inq-{uuid.uuid4().hex}"

        env = _base_event("PropertyInquiry", phone, prop_id, idem=idem)
        r = _post_event(**env)
        assert r.status_code == 201, r.text
        body = r.json()
        assert body.get("deduped") is False
        assert body.get("personId"), "PersonResolver should have created a person"
        person_id = body["personId"]

        # Lead
        lead = _find_lead(person_id)
        assert lead is not None, "Lead should be created"
        assert lead["status"] == "nuevo"
        assert lead["source"] == "arturito"
        assert prop_id in lead.get("interestedPropertyIds", [])

        # Opportunity
        opp = _find_opp(person_id, prop_id)
        assert opp is not None, "Opportunity should be created"
        assert opp["stage"] == "interes"

        # Task
        tasks = _find_tasks(person_id, prop_id, "contactar", "pendiente")
        assert len(tasks) == 1, f"Expected 1 pending 'contactar' task, got {len(tasks)}"


# ---------------- Stage progression + no regression ---------------- #
class TestOpportunityStageProgression:
    def test_stage_progression_and_no_regression(self):
        phone = _unique_phone()
        prop_id = f"prop-{uuid.uuid4().hex[:8]}"

        stage_sequence = [
            ("PropertyInquiry", "interes"),
            ("VisitScheduled", "visita_agendada"),
            ("PropertyVisited", "visitada"),
            ("OfferSent", "oferta"),
            ("PropertyReserved", "reserva"),
            ("PropertySold", "ganada"),
        ]

        person_id = None
        for etype, expected_stage in stage_sequence:
            env = _base_event(etype, phone, prop_id,
                              idem=f"test-{etype}-{uuid.uuid4().hex}")
            r = _post_event(**env)
            assert r.status_code == 201, f"{etype} failed: {r.text}"
            body = r.json()
            person_id = body.get("personId") or person_id
            assert person_id is not None
            opp = _find_opp(person_id, prop_id)
            assert opp is not None, f"Opportunity missing after {etype}"
            assert opp["stage"] == expected_stage, \
                f"After {etype} expected stage={expected_stage} got {opp['stage']}"

        # Regression check: sending PropertyInquiry again (earlier stage) must NOT regress
        env = _base_event("PropertyInquiry", phone, prop_id,
                          idem=f"test-regress-{uuid.uuid4().hex}")
        r = _post_event(**env)
        assert r.status_code == 201
        opp = _find_opp(person_id, prop_id)
        assert opp["stage"] == "ganada", \
            f"Stage should NOT regress from 'ganada'; got {opp['stage']}"


# ---------------- Lead status progression ---------------- #
class TestLeadStatusProgression:
    def test_lead_status_advances_correctly(self):
        phone = _unique_phone()
        prop_id = f"prop-{uuid.uuid4().hex[:8]}"

        # First: PropertyInquiry -> nuevo
        r = _post_event(**_base_event("PropertyInquiry", phone, prop_id,
                                      idem=f"test-lead-inq-{uuid.uuid4().hex}"))
        assert r.status_code == 201
        person_id = r.json()["personId"]
        lead = _find_lead(person_id)
        assert lead["status"] == "nuevo"

        # VisitScheduled -> calificado
        r = _post_event(**_base_event("VisitScheduled", phone, prop_id,
                                      idem=f"test-lead-vs-{uuid.uuid4().hex}"))
        assert r.status_code == 201
        lead = _find_lead(person_id)
        assert lead["status"] == "calificado"

        # PropertyReserved -> convertido
        r = _post_event(**_base_event("PropertyReserved", phone, prop_id,
                                      idem=f"test-lead-pr-{uuid.uuid4().hex}"))
        assert r.status_code == 201
        lead = _find_lead(person_id)
        assert lead["status"] == "convertido"

        # No regression: PropertyInquiry now should not regress to 'nuevo'
        r = _post_event(**_base_event("PropertyInquiry", phone, prop_id,
                                      idem=f"test-lead-regr-{uuid.uuid4().hex}"))
        assert r.status_code == 201
        lead = _find_lead(person_id)
        assert lead["status"] == "convertido", \
            f"Lead should not regress from 'convertido'; got {lead['status']}"

    def test_offer_sent_moves_lead_to_calificado(self):
        phone = _unique_phone()
        prop_id = f"prop-{uuid.uuid4().hex[:8]}"
        r = _post_event(**_base_event("PropertyInquiry", phone, prop_id,
                                      idem=f"test-ofl-1-{uuid.uuid4().hex}"))
        person_id = r.json()["personId"]
        r = _post_event(**_base_event("OfferSent", phone, prop_id,
                                      idem=f"test-ofl-2-{uuid.uuid4().hex}"))
        assert r.status_code == 201
        lead = _find_lead(person_id)
        assert lead["status"] == "calificado"

    def test_property_visited_moves_lead_to_calificado(self):
        phone = _unique_phone()
        prop_id = f"prop-{uuid.uuid4().hex[:8]}"
        r = _post_event(**_base_event("PropertyInquiry", phone, prop_id,
                                      idem=f"test-pvl-1-{uuid.uuid4().hex}"))
        person_id = r.json()["personId"]
        r = _post_event(**_base_event("PropertyVisited", phone, prop_id,
                                      idem=f"test-pvl-2-{uuid.uuid4().hex}"))
        assert r.status_code == 201
        lead = _find_lead(person_id)
        assert lead["status"] == "calificado"

    def test_opportunity_created_moves_lead_to_calificado(self):
        phone = _unique_phone()
        prop_id = f"prop-{uuid.uuid4().hex[:8]}"
        r = _post_event(**_base_event("PropertyInquiry", phone, prop_id,
                                      idem=f"test-oc-1-{uuid.uuid4().hex}"))
        person_id = r.json()["personId"]
        r = _post_event(**_base_event("OpportunityCreated", phone, prop_id,
                                      idem=f"test-oc-2-{uuid.uuid4().hex}"))
        assert r.status_code == 201
        lead = _find_lead(person_id)
        assert lead["status"] == "calificado"

    def test_property_sold_moves_lead_to_convertido(self):
        phone = _unique_phone()
        prop_id = f"prop-{uuid.uuid4().hex[:8]}"
        r = _post_event(**_base_event("PropertyInquiry", phone, prop_id,
                                      idem=f"test-ps-1-{uuid.uuid4().hex}"))
        person_id = r.json()["personId"]
        r = _post_event(**_base_event("PropertySold", phone, prop_id,
                                      idem=f"test-ps-2-{uuid.uuid4().hex}"))
        assert r.status_code == 201
        lead = _find_lead(person_id)
        assert lead["status"] == "convertido"


# ---------------- MessageReceived: bump + dedupe pending 'responder' ---------------- #
class TestMessageReceivedTaskDedupe:
    def test_message_bumps_count_and_dedupes_pending_task(self):
        phone = _unique_phone()
        prop_id = f"prop-{uuid.uuid4().hex[:8]}"

        # First MessageReceived (also creates the Lead since no PropertyInquiry yet)
        r = _post_event(**_base_event("MessageReceived", phone, prop_id,
                                      idem=f"test-msg-1-{uuid.uuid4().hex}"))
        assert r.status_code == 201
        person_id = r.json()["personId"]

        lead1 = _find_lead(person_id)
        assert lead1 is not None
        assert lead1["messageCount"] == 1

        # Send 2 more messages
        for i in range(2, 4):
            r = _post_event(**_base_event("MessageReceived", phone, prop_id,
                                          idem=f"test-msg-{i}-{uuid.uuid4().hex}"))
            assert r.status_code == 201

        lead2 = _find_lead(person_id)
        assert lead2["messageCount"] == 3, f"Expected messageCount=3, got {lead2['messageCount']}"

        # Only ONE pending 'responder' task should exist
        pending = _find_tasks(person_id, prop_id, "responder", "pendiente")
        assert len(pending) == 1, \
            f"Expected 1 pending 'responder' task (dedupe), got {len(pending)}"


# ---------------- Task lifecycle ---------------- #
class TestTaskLifecycle:
    def test_mark_task_done_and_new_message_creates_new_task(self):
        phone = _unique_phone()
        prop_id = f"prop-{uuid.uuid4().hex[:8]}"

        r = _post_event(**_base_event("MessageReceived", phone, prop_id,
                                      idem=f"test-tl-1-{uuid.uuid4().hex}"))
        person_id = r.json()["personId"]
        pending = _find_tasks(person_id, prop_id, "responder", "pendiente")
        assert len(pending) == 1
        task_id = pending[0]["id"]

        # PATCH to hecha
        r = requests.patch(f"{API}/core/tasks/{task_id}",
                           json={"status": "hecha"}, timeout=10)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "hecha"

        # New MessageReceived should create a NEW pending task (dedupe only blocks pending)
        r = _post_event(**_base_event("MessageReceived", phone, prop_id,
                                      idem=f"test-tl-2-{uuid.uuid4().hex}"))
        assert r.status_code == 201
        pending_after = _find_tasks(person_id, prop_id, "responder", "pendiente")
        assert len(pending_after) == 1, \
            f"After marking previous done, new msg should create 1 new pending task; got {len(pending_after)}"
        assert pending_after[0]["id"] != task_id

    def test_mark_task_descartada(self):
        phone = _unique_phone()
        prop_id = f"prop-{uuid.uuid4().hex[:8]}"
        r = _post_event(**_base_event("PropertyInquiry", phone, prop_id,
                                      idem=f"test-td-{uuid.uuid4().hex}"))
        person_id = r.json()["personId"]
        pending = _find_tasks(person_id, prop_id, "contactar", "pendiente")
        assert len(pending) == 1
        r = requests.patch(f"{API}/core/tasks/{pending[0]['id']}",
                           json={"status": "descartada"}, timeout=10)
        assert r.status_code == 200
        assert r.json()["status"] == "descartada"


# ---------------- Idempotency ---------------- #
class TestIdempotency:
    def test_duplicate_idempotency_key_returns_deduped(self):
        phone = _unique_phone()
        prop_id = f"prop-{uuid.uuid4().hex[:8]}"
        idem = f"test-idem-{uuid.uuid4().hex}"

        env = _base_event("PropertyInquiry", phone, prop_id, idem=idem)
        r1 = _post_event(**env)
        assert r1.status_code == 201
        b1 = r1.json()
        assert b1["deduped"] is False
        person_id = b1["personId"]

        r2 = _post_event(**env)
        assert r2.status_code == 201
        b2 = r2.json()
        assert b2["deduped"] is True

        # No duplicate lead / opp / task
        leads = [l for l in requests.get(f"{API}/core/leads").json()["leads"]
                 if l["personId"] == person_id]
        assert len(leads) == 1

        opps = [o for o in requests.get(f"{API}/core/opportunities").json()["opportunities"]
                if o["personId"] == person_id and o["propertyId"] == prop_id]
        assert len(opps) == 1

        tasks = _find_tasks(person_id, prop_id, "contactar")
        assert len(tasks) == 1


# ---------------- Validation ---------------- #
class TestValidation:
    def test_invalid_event_type(self):
        r = _post_event(type="NotAType", source="arturito", contact={"phone": _unique_phone()})
        assert r.status_code == 422

    def test_invalid_event_source(self):
        r = _post_event(type="PropertyInquiry", source="martian_bot",
                        contact={"phone": _unique_phone()})
        assert r.status_code == 422

    def test_invalid_task_status_patch(self):
        # Need a real task id — create one first
        phone = _unique_phone()
        prop_id = f"prop-{uuid.uuid4().hex[:8]}"
        r = _post_event(**_base_event("PropertyInquiry", phone, prop_id,
                                      idem=f"test-invtask-{uuid.uuid4().hex}"))
        person_id = r.json()["personId"]
        task_id = _find_tasks(person_id, prop_id, "contactar", "pendiente")[0]["id"]
        r = requests.patch(f"{API}/core/tasks/{task_id}", json={"status": "flotando"}, timeout=10)
        assert r.status_code == 422

    def test_invalid_opportunity_stage_patch(self):
        phone = _unique_phone()
        prop_id = f"prop-{uuid.uuid4().hex[:8]}"
        r = _post_event(**_base_event("PropertyInquiry", phone, prop_id,
                                      idem=f"test-invopp-{uuid.uuid4().hex}"))
        person_id = r.json()["personId"]
        opp = _find_opp(person_id, prop_id)
        r = requests.patch(f"{API}/core/opportunities/{opp['id']}",
                           json={"stage": "quantumleap"}, timeout=10)
        assert r.status_code == 422

    def test_invalid_lead_status_query(self):
        r = requests.get(f"{API}/core/leads?status=infinite", timeout=10)
        assert r.status_code == 422


# ---------------- Manual PATCH: valid + 404 ---------------- #
class TestManualPatch:
    def test_patch_opportunity_valid_stage(self):
        phone = _unique_phone()
        prop_id = f"prop-{uuid.uuid4().hex[:8]}"
        r = _post_event(**_base_event("PropertyInquiry", phone, prop_id,
                                      idem=f"test-po-{uuid.uuid4().hex}"))
        person_id = r.json()["personId"]
        opp = _find_opp(person_id, prop_id)
        # Manually advance to 'visita_agendada'
        r = requests.patch(f"{API}/core/opportunities/{opp['id']}",
                           json={"stage": "visita_agendada"}, timeout=10)
        assert r.status_code == 200, r.text
        assert r.json()["stage"] == "visita_agendada"

    def test_patch_opportunity_not_found(self):
        # Use a valid-looking but non-existent ObjectId
        r = requests.patch(f"{API}/core/opportunities/507f1f77bcf86cd799439011",
                           json={"stage": "interes"}, timeout=10)
        assert r.status_code == 404

    def test_patch_task_not_found(self):
        r = requests.patch(f"{API}/core/tasks/507f1f77bcf86cd799439011",
                           json={"status": "hecha"}, timeout=10)
        assert r.status_code == 404


# ---------------- Anonymous / PersonCreated events must not create projections ---------------- #
class TestNoProjectionsForAnonymousOrPersonCreated:
    def test_anonymous_event_no_projection(self):
        # No contact identifier at all → no person_id → no lead/opp/task
        r = requests.get(f"{API}/core/summary", timeout=10)
        before = r.json()
        r = _post_event(type="PropertyInquiry", source="website",
                        subject={"propertyId": f"prop-{uuid.uuid4().hex[:6]}"},
                        idempotencyKey=f"test-anon-{uuid.uuid4().hex}")
        assert r.status_code == 201
        body = r.json()
        assert body.get("personId") is None
        r = requests.get(f"{API}/core/summary", timeout=10)
        after = r.json()
        assert after["leads"] == before["leads"]
        assert after["opportunities"] == before["opportunities"]
        assert after["tasks"] == before["tasks"]

    def test_person_created_no_projection(self):
        # PersonCreated is explicitly excluded from projections
        phone = _unique_phone()
        r = _post_event(type="PersonCreated", source="app",
                        contact={"phone": phone, "name": f"TEST PC {phone[-6:]}"},
                        idempotencyKey=f"test-pc-{uuid.uuid4().hex}")
        assert r.status_code == 201
        person_id = r.json()["personId"]
        assert person_id  # person is still resolved/created
        assert _find_lead(person_id) is None, \
            "PersonCreated should NOT create a lead"


# ---------------- Provider-agnostic contract ---------------- #
class TestProviderAgnostic:
    @pytest.mark.parametrize("source", ["arturito", "whatsapp", "kommo", "website"])
    def test_multiple_sources_all_produce_lead(self, source):
        phone = _unique_phone()
        prop_id = f"prop-{uuid.uuid4().hex[:8]}"
        r = _post_event(**_base_event("PropertyInquiry", phone, prop_id, source=source,
                                      idem=f"test-src-{source}-{uuid.uuid4().hex}"))
        assert r.status_code == 201, r.text
        person_id = r.json()["personId"]
        lead = _find_lead(person_id)
        assert lead is not None
        assert lead["source"] == source


# ---------------- Rebuild ---------------- #
class TestRebuild:
    def test_rebuild_reproduces_projections(self):
        # Seed one deterministic flow
        phone = _unique_phone()
        prop_id = f"prop-{uuid.uuid4().hex[:8]}"
        for etype in ("PropertyInquiry", "VisitScheduled", "PropertyVisited"):
            r = _post_event(**_base_event(etype, phone, prop_id,
                                          idem=f"test-rb-{etype}-{uuid.uuid4().hex}"))
            assert r.status_code == 201
        person_id = r.json()["personId"]

        r = requests.get(f"{API}/core/summary", timeout=15)
        before = r.json()

        r = requests.post(f"{API}/core/rebuild", timeout=60)
        assert r.status_code == 200, r.text
        after = r.json()
        assert "events_processed" in after
        assert after["events_processed"] > 0

        # Idempotent rebuild: totals stable across two runs
        r = requests.post(f"{API}/core/rebuild", timeout=60)
        assert r.status_code == 200
        after2 = r.json()
        assert after["leads"] == after2["leads"]
        assert after["opportunities"] == after2["opportunities"]
        assert after["tasks"] == after2["tasks"]

        # Our seeded person+property still has correct projections
        lead = _find_lead(person_id)
        assert lead is not None
        assert lead["status"] == "calificado"
        opp = _find_opp(person_id, prop_id)
        assert opp is not None
        assert opp["stage"] == "visitada"

        # Summary should be >= what it was before rebuild (rebuild rebuilds ALL)
        assert after["leads"] >= 1
        assert after["opportunities"] >= 1
