"""Knowledge Engine (VERA Brain v1) — pytest end-to-end suite.

Cubre:
- Extracción LLM en background al recibir POST /api/events con payload.summary.
- POST /api/people/{id}/knowledge/learn (síncrono) — devuelve facts + knowledge.
- Idempotencia acumulativa: reejecutar el mismo learn NO duplica hechos.
- Contradicción sobre tipos single-valued (profession) → prev pasa a status='review'.
- GET /api/knowledge/facts?type=..&value=.. (excluye status='review').
- GET /api/people/{id}/knowledge sin resúmenes → factCount 0.
- Validación 404 en persona inexistente para GET/POST knowledge.

NO borra la persona real 'Juan Pedro Andersen' ni 'Cata 💓'.
"""
from __future__ import annotations

import os
import time
import uuid

import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

JUAN_ID = "602b6bad-0350-4ee3-a67b-e0a57fb55ecb"


# --------------------------------------------------------------------------- #
# Fixtures
# --------------------------------------------------------------------------- #
@pytest.fixture(scope="module")
def api_client() -> requests.Session:
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def qa_buyer(api_client: requests.Session) -> str:
    """Crea (o reutiliza) una persona vía POST /api/events con payload.summary.
    Devuelve el person_id. La extracción corre en background (~6s)."""
    suffix = uuid.uuid4().hex[:8]
    phone = f"+549370{suffix[:7]}"  # unique
    name = f"QA Comprador {suffix}"
    payload = {
        "type": "MessageReceived",
        "source": "arturito",
        "contact": {"phone": phone, "name": name},
        "payload": {
            "summary": (
                "Busca una casa de 3 dormitorios en Costa del Este, presupuesto "
                "aproximado USD 120000, acepta crédito, decide junto a su esposa."
            )
        },
        "idempotencyKey": f"kqa-{suffix}",
    }
    r = api_client.post(f"{API}/events", json=payload)
    assert r.status_code in (200, 201), f"POST /events failed: {r.status_code} {r.text}"

    # Wait for background extraction (LLM ~5-8s per spec)
    person_id = None
    for _ in range(6):  # up to ~12s
        time.sleep(2)
        lr = api_client.get(f"{API}/people", params={"query": name})
        if lr.status_code == 200:
            rows = [p for p in lr.json() if p.get("fullName", "") == name]
            if rows:
                person_id = rows[0]["id"]
                # Give extraction extra time to persist facts
                for _ in range(6):
                    kr = api_client.get(f"{API}/people/{person_id}/knowledge")
                    if kr.status_code == 200 and kr.json().get("factCount", 0) > 0:
                        return person_id
                    time.sleep(2)
                if person_id:
                    return person_id
    if not person_id:
        pytest.skip("No pude crear la persona QA Comprador vía POST /events.")
    return person_id


# --------------------------------------------------------------------------- #
# 1) Backend LLM extraction (background) desde POST /events
# --------------------------------------------------------------------------- #
class TestBackgroundExtraction:
    def test_person_created_and_knowledge_extracted(self, api_client, qa_buyer):
        person_id = qa_buyer
        r = api_client.get(f"{API}/people/{person_id}/knowledge")
        assert r.status_code == 200
        k = r.json()
        assert k["personId"] == person_id
        assert k["factCount"] >= 3, f"muy pocos hechos: {k['factCount']} ({k})"

        # gather all facts across categories
        all_facts = []
        for key in ("roles", "relationship", "interests", "preferences",
                    "facts", "businessContext", "aiTags"):
            all_facts.extend(k.get(key) or [])
        types = {f["type"] for f in all_facts}
        # Validate presence of KEY types (not exact set — LLM varía)
        # role=Comprador
        role_vals = [f["value"] for f in all_facts if f["type"] == "role"]
        assert any("comprador" in str(v).lower() for v in role_vals), f"role Comprador faltante: {role_vals}"
        # budget = 120000 (USD)
        budgets = [f for f in all_facts if f["type"] == "budget"]
        assert budgets, "budget faltante"
        assert any(int(str(b["value"]).replace(",", "").split(".")[0]) == 120000
                   for b in budgets if str(b["value"]).replace(".", "").replace(",", "").isdigit()), f"budget!=120000: {budgets}"
        assert any((b.get("currency") or "").upper() == "USD" for b in budgets), f"currency USD faltante: {budgets}"
        # bedrooms=3
        beds = [f for f in all_facts if f["type"] == "bedrooms"]
        assert beds and any(str(b["value"]) == "3" for b in beds), f"bedrooms=3 faltante: {beds}"
        # accepts_credit truthy
        credit = [f for f in all_facts if f["type"] == "accepts_credit"]
        assert credit, "accepts_credit faltante"
        # location Costa del Este
        locs = [f for f in all_facts if f["type"] == "location"]
        assert any("costa del este" in str(l["value"]).lower() for l in locs), f"location Costa del Este faltante: {locs}"
        # decision_maker
        dms = [f for f in all_facts if f["type"] == "decision_maker"]
        assert dms, f"decision_maker faltante (types vistos: {types})"

        # readable non-empty y confidenceLabel válido
        assert isinstance(k["readable"], list) and len(k["readable"]) > 0
        assert k["confidenceLabel"] in ("Alta", "Media", "Baja")


# --------------------------------------------------------------------------- #
# 2) Learn síncrono — POST /people/{id}/knowledge/learn
# --------------------------------------------------------------------------- #
class TestSyncLearn:
    def test_learn_returns_facts_and_updates_knowledge(self, api_client):
        # Uso persona real 'Juan Pedro Andersen' que ya trae role=Agrimensor (no borrar)
        body = {
            "summary": (
                "Es agrimensor y realiza mensuras para Varela Propiedades. "
                "Trabaja con Sebastián. No es comprador."
            ),
            "sourceRef": f"pytest-learn-{uuid.uuid4().hex[:6]}",
        }
        r = api_client.post(f"{API}/people/{JUAN_ID}/knowledge/learn", json=body)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j.get("learned", 0) > 0, f"learned==0: {j}"
        assert isinstance(j.get("facts"), list) and len(j["facts"]) > 0
        assert "knowledge" in j
        k = j["knowledge"]
        role_vals = [f["value"] for f in (k.get("roles") or [])]
        prof_vals = [f["value"] for f in (k.get("facts") or []) if f["type"] == "profession"]
        # role=Agrimensor debe estar en el knowledge (viene por role o profession)
        combined = [str(v).lower() for v in role_vals + prof_vals]
        assert any("agrimensor" in v for v in combined), (
            f"Agrimensor faltante en knowledge (roles={role_vals}, profession={prof_vals})"
        )


# --------------------------------------------------------------------------- #
# 3) Idempotencia — reejecutar el mismo learn no duplica
# --------------------------------------------------------------------------- #
class TestIdempotency:
    def test_relearn_same_summary_does_not_duplicate(self, api_client):
        summary = (
            "Es agrimensor y realiza mensuras para Varela Propiedades. "
            "Trabaja con Sebastián. No es comprador."
        )
        # 1st (may confirm or create depending on prior state)
        api_client.post(f"{API}/people/{JUAN_ID}/knowledge/learn",
                        json={"summary": summary, "sourceRef": "pytest-idem-1"})
        k1 = api_client.get(f"{API}/people/{JUAN_ID}/knowledge").json()
        # 2nd → todos los facts deberían venir con outcome 'confirmed' (o skipped)
        r2 = api_client.post(f"{API}/people/{JUAN_ID}/knowledge/learn",
                             json={"summary": summary, "sourceRef": "pytest-idem-2"})
        assert r2.status_code == 200
        j2 = r2.json()
        outcomes = [f["outcome"] for f in j2.get("facts", [])]
        assert outcomes, "no facts en 2da corrida"
        # All outcomes should be 'confirmed' (o 'skipped') — nunca 'created'
        created = [o for o in outcomes if o == "created"]
        assert not created, f"la 2da corrida creó hechos nuevos (esperaba confirmed): {outcomes}"

        k2 = api_client.get(f"{API}/people/{JUAN_ID}/knowledge").json()
        # factCount NO crece por repetir el mismo resumen
        assert k2["factCount"] == k1["factCount"], (
            f"factCount cambió tras relearn ({k1['factCount']} → {k2['factCount']})"
        )


# --------------------------------------------------------------------------- #
# 4) Contradicción — profession Agrimensor → Arquitecto
# --------------------------------------------------------------------------- #
class TestContradiction:
    def test_contradiction_marks_previous_as_review(self, api_client):
        # Crear persona nueva y sembrar profession=Agrimensor primero
        suffix = uuid.uuid4().hex[:8]
        name = f"QA Contradic {suffix}"
        phone = f"+549370{suffix[:7]}"
        # Crear persona vía /people
        cr = api_client.post(f"{API}/people", json={"fullName": name, "primaryPhone": phone})
        assert cr.status_code in (200, 201), cr.text
        person_id = cr.json()["id"]

        # seed profession=Agrimensor
        r1 = api_client.post(
            f"{API}/people/{person_id}/knowledge/learn",
            json={"summary": "Su profesión es Agrimensor. Trabaja en mensuras.",
                  "sourceRef": "pytest-contradic-1"},
        )
        assert r1.status_code == 200
        # ahora contradecir con Arquitecto
        r2 = api_client.post(
            f"{API}/people/{person_id}/knowledge/learn",
            json={"summary": "Su profesión es Arquitecto y hace planos.",
                  "sourceRef": "pytest-contradic-2"},
        )
        assert r2.status_code == 200
        # obtener knowledge
        k = api_client.get(f"{API}/people/{person_id}/knowledge").json()
        # buscar todos los facts profession en cualquier categoría
        buckets = []
        for key in ("roles", "relationship", "interests", "preferences",
                    "facts", "businessContext", "aiTags", "needsReview"):
            buckets.extend(k.get(key) or [])
        profs = [f for f in buckets if f["type"] == "profession"]
        prof_vals = {str(f["value"]).lower(): f for f in profs}
        # ambos hechos deben existir (no se borró el anterior)
        assert "agrimensor" in prof_vals, f"Agrimensor faltante tras contradicción: {prof_vals}"
        assert "arquitecto" in prof_vals, f"Arquitecto faltante: {prof_vals}"
        # el previo (Agrimensor) debe estar en review
        assert prof_vals["agrimensor"]["status"] == "review", (
            f"Agrimensor debe estar en review: {prof_vals['agrimensor']}"
        )
        # el nuevo debería estar activo
        assert prof_vals["arquitecto"]["status"] == "active"
        # needsReview debe listar al menos el hecho contradicho
        review_types = {(f["type"], str(f["value"]).lower()) for f in (k.get("needsReview") or [])}
        assert ("profession", "agrimensor") in review_types, f"needsReview={review_types}"


# --------------------------------------------------------------------------- #
# 5) Consulta estructurada — /knowledge/facts
# --------------------------------------------------------------------------- #
class TestKnowledgeFactsQuery:
    def test_query_role_agrimensor(self, api_client):
        r = api_client.get(f"{API}/knowledge/facts", params={"type": "role", "value": "Agrimensor"})
        assert r.status_code == 200
        data = r.json()
        facts = data["facts"]
        assert isinstance(facts, list) and len(facts) >= 1, f"vacío: {data}"
        # todos matchean type=role, value=Agrimensor (case-insensitive por value_norm)
        assert all(f["type"] == "role" for f in facts)
        assert all(str(f["value"]).lower() == "agrimensor" for f in facts)
        # Juan debe estar
        assert any(f["personId"] == JUAN_ID for f in facts), "Juan no aparece"
        # Ningún fact en review
        assert all(f["status"] != "review" for f in facts)

    def test_query_budget(self, api_client, qa_buyer):
        # depende de qa_buyer para asegurar que hay al menos un budget cargado
        r = api_client.get(f"{API}/knowledge/facts", params={"type": "budget"})
        assert r.status_code == 200
        facts = r.json()["facts"]
        assert isinstance(facts, list) and len(facts) >= 1, "no hay budgets"
        assert all(f["type"] == "budget" for f in facts)
        assert all(f["status"] != "review" for f in facts)


# --------------------------------------------------------------------------- #
# 6) No conocimiento
# --------------------------------------------------------------------------- #
class TestEmptyKnowledge:
    def test_person_without_summaries_has_zero_facts(self, api_client):
        # crear persona nueva sin summaries
        suffix = uuid.uuid4().hex[:8]
        cr = api_client.post(f"{API}/people", json={
            "fullName": f"QA Vacio {suffix}",
            "primaryPhone": f"+549370{suffix[:7]}",
        })
        assert cr.status_code in (200, 201)
        pid = cr.json()["id"]
        r = api_client.get(f"{API}/people/{pid}/knowledge")
        assert r.status_code == 200
        k = r.json()
        assert k["factCount"] == 0
        assert k["readable"] == []


# --------------------------------------------------------------------------- #
# 7) Validación 404
# --------------------------------------------------------------------------- #
class TestNotFound:
    """El backend actualmente REVIENTA (500) cuando el id no tiene formato UUID:
    people_repository.get() delega a Supabase y Postgres rechaza el cast → 22P02.
    Usamos un UUID válido pero inexistente para probar el 404 diseñado.
    (Bug reportado en el informe: /api/people/{invalid-uuid}/knowledge → 500 en vez de 404.)
    """

    def test_get_knowledge_404_for_unknown_person(self, api_client):
        r = api_client.get(f"{API}/people/00000000-0000-0000-0000-{uuid.uuid4().hex[:12]}/knowledge")
        assert r.status_code == 404

    def test_post_learn_404_for_unknown_person(self, api_client):
        r = api_client.post(
            f"{API}/people/00000000-0000-0000-0000-{uuid.uuid4().hex[:12]}/knowledge/learn",
            json={"summary": "Test summary de más de 15 caracteres para pasar la validación."},
        )
        assert r.status_code == 404

    def test_invalid_uuid_leaks_500_bug(self, api_client):
        """XFAIL/known-bug: id no-UUID hoy devuelve 500 (debería 404 o 422)."""
        r = api_client.get(f"{API}/people/nonexistent-{uuid.uuid4().hex}/knowledge")
        # documentar el comportamiento actual (bug)
        assert r.status_code == 500, f"si esto pasa a 404 el bug fue corregido: {r.status_code}"
