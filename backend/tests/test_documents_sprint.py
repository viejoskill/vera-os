"""Sprint tests: Documentos v1 — arquitectura fundacional.

Cubre: templates (crud/versionado), documents (crud + snapshot congelado),
ciclo de vida único, historial por eventos, relationships y signatures.

Datos de prueba con prefijo TEST_ para poder identificarlos si hace falta.
"""
from __future__ import annotations

import os
import time
import uuid

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    BASE_URL = "https://real-estate-os-10.preview.emergentagent.com"
API = f"{BASE_URL}/api"


# ----------------------------- Fixtures ------------------------------------ #
@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def person_id(client):
    """Real person id (FK for signatures)."""
    r = client.get(f"{API}/people")
    assert r.status_code == 200, r.text
    people = r.json()
    assert people, "No hay Personas en Supabase para probar signatures"
    return people[0]["id"]


@pytest.fixture(scope="session")
def property_id(client):
    r = client.get(f"{API}/properties")
    assert r.status_code == 200, r.text
    props = r.json()
    assert props, "No hay Propiedades para probar relationships"
    return props[0]["id"]


def _key(prefix: str) -> str:
    return f"TEST_{prefix}_{uuid.uuid4().hex[:8]}"


# ============================ Templates ==================================== #
class TestTemplates:
    """CRUD + versionado inmutable de DocumentTemplate."""

    def test_list_templates_ok(self, client):
        r = client.get(f"{API}/documents/templates")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_template_v1(self, client):
        tk = _key("autorizacion")
        payload = {
            "templateKey": tk,
            "name": "TEST Autorización de Venta",
            "category": "autorizacion",
            "description": "test",
            "variables": [
                {"key": "seller_name", "label": "Vendedor", "source": "person", "role": "vendedor",
                 "path": "full_name", "type": "text", "required": True}
            ],
            "body": {"blocks": [{"type": "text", "value": "Yo, {{seller_name}}, autorizo..."}]},
            "status": "draft",
        }
        r = client.post(f"{API}/documents/templates", json=payload)
        assert r.status_code == 201, r.text
        data = r.json()
        assert data.get("id")
        assert data.get("version") == 1
        # aceptar snake o camel (repo devuelve snake_case)
        assert (data.get("template_key") or data.get("templateKey")) == tk
        assert data.get("category") == "autorizacion"

    def test_create_template_duplicate_key_returns_409(self, client):
        tk = _key("recibo")
        payload = {"templateKey": tk, "name": "TEST Recibo", "category": "recibo"}
        r1 = client.post(f"{API}/documents/templates", json=payload)
        assert r1.status_code == 201, r1.text
        r2 = client.post(f"{API}/documents/templates", json=payload)
        assert r2.status_code == 409, f"Expected 409, got {r2.status_code} — {r2.text}"

    def test_create_template_invalid_category_returns_422(self, client):
        r = client.post(f"{API}/documents/templates", json={
            "templateKey": _key("bad"), "name": "TEST Bad", "category": "not_a_category",
        })
        assert r.status_code == 422, f"Expected 422, got {r.status_code} — {r.text}"

    def test_get_template_by_id(self, client):
        tk = _key("contrato")
        c = client.post(f"{API}/documents/templates", json={
            "templateKey": tk, "name": "TEST Contrato", "category": "contrato",
        })
        assert c.status_code == 201
        tid = c.json()["id"]
        r = client.get(f"{API}/documents/templates/{tid}")
        assert r.status_code == 200
        assert r.json()["id"] == tid

    def test_versioning_creates_v2_and_lists_both(self, client):
        tk = _key("oferta")
        c1 = client.post(f"{API}/documents/templates", json={
            "templateKey": tk, "name": "TEST Oferta", "category": "oferta",
            "body": {"v": 1},
        })
        assert c1.status_code == 201
        t1 = c1.json()
        assert t1["version"] == 1

        c2 = client.post(f"{API}/documents/templates/{t1['id']}/versions", json={
            "name": "TEST Oferta v2", "body": {"v": 2},
        })
        assert c2.status_code == 201, c2.text
        t2 = c2.json()
        assert t2["version"] == 2
        assert (t2.get("template_key") or t2.get("templateKey")) == tk

        r = client.get(f"{API}/documents/templates/key/{tk}/versions")
        assert r.status_code == 200
        versions = r.json()
        vs = sorted(v["version"] for v in versions)
        assert vs == [1, 2]


# =========================== Documents ===================================== #
class TestDocuments:
    """POST /api/documents con snapshot congelado + validaciones."""

    @pytest.fixture(scope="class")
    def template(self, client):
        tk = _key("reserva")
        r = client.post(f"{API}/documents/templates", json={
            "templateKey": tk, "name": "TEST Reserva", "category": "reserva",
            "body": {"initial": True}, "status": "active",
        })
        assert r.status_code == 201, r.text
        return r.json()

    def test_create_document_without_relationships_returns_422(self, client, template):
        r = client.post(f"{API}/documents", json={
            "templateId": template["id"], "relationships": [],
        })
        assert r.status_code == 422, f"Expected 422, got {r.status_code} — {r.text}"

    def test_create_document_ok(self, client, template, person_id, property_id):
        r = client.post(f"{API}/documents", json={
            "templateId": template["id"],
            "title": "TEST Reserva doc",
            "relationships": [
                {"entityType": "person", "entityId": person_id, "role": "comprador"},
                {"entityType": "property", "entityId": property_id},
            ],
        })
        assert r.status_code == 201, r.text
        doc = r.json()
        assert doc["status"] == "draft"
        assert doc.get("category") == "reserva"
        # Snapshot congelado
        snap = doc.get("template_snapshot") or doc.get("templateSnapshot")
        assert snap is not None, "Falta template_snapshot en la respuesta"
        assert snap.get("version") == 1 or snap.get("Version") == 1
        tv = doc.get("template_version") or doc.get("templateVersion")
        assert tv == 1
        # Number correlativo (opcional)
        rels = doc.get("relationships") or []
        assert len(rels) == 2

    def test_snapshot_frozen_after_new_version(self, client, person_id, property_id):
        """Un doc creado con v1 mantiene template_snapshot v1 aunque exista v2."""
        tk = _key("poder")
        t1 = client.post(f"{API}/documents/templates", json={
            "templateKey": tk, "name": "TEST Poder", "category": "poder",
            "body": {"marker": "v1_body"},
        }).json()

        d = client.post(f"{API}/documents", json={
            "templateId": t1["id"], "title": "TEST doc snap",
            "relationships": [{"entityType": "person", "entityId": person_id, "role": "otorgante"}],
        }).json()
        doc_id = d["id"]

        # v2
        client.post(f"{API}/documents/templates/{t1['id']}/versions", json={
            "body": {"marker": "v2_body"}, "name": "TEST Poder v2",
        })

        # Volvemos a leer el documento: debe seguir en v1 y su snapshot con marker=v1_body
        got = client.get(f"{API}/documents/{doc_id}").json()
        tv = got.get("template_version") or got.get("templateVersion")
        assert tv == 1
        snap = got.get("template_snapshot") or got.get("templateSnapshot") or {}
        body = snap.get("body") or {}
        assert body.get("marker") == "v1_body", f"Snapshot no congelado, marker={body}"

    def test_get_document_hydrated(self, client, template, person_id):
        d = client.post(f"{API}/documents", json={
            "templateId": template["id"], "title": "TEST hydrate",
            "relationships": [{"entityType": "person", "entityId": person_id, "role": "comprador"}],
            "signatures": [{"signerPersonId": person_id, "signerRole": "comprador"}],
        }).json()
        r = client.get(f"{API}/documents/{d['id']}")
        assert r.status_code == 200
        got = r.json()
        assert isinstance(got.get("relationships"), list) and len(got["relationships"]) == 1
        assert isinstance(got.get("signatures"), list) and len(got["signatures"]) == 1

    def test_list_documents(self, client):
        r = client.get(f"{API}/documents")
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# =========================== Lifecycle ==================================== #
class TestLifecycle:
    """draft → generated → shared → signed → archived (con transiciones inválidas)."""

    @pytest.fixture
    def doc_id(self, client, person_id):
        tk = _key("lifecycle")
        t = client.post(f"{API}/documents/templates", json={
            "templateKey": tk, "name": "TEST LC", "category": "tasacion",
        }).json()
        d = client.post(f"{API}/documents", json={
            "templateId": t["id"], "title": "TEST LC doc",
            "relationships": [{"entityType": "person", "entityId": person_id, "role": "tasador"}],
        }).json()
        return d["id"]

    def test_invalid_direct_transition_draft_to_signed(self, client, doc_id):
        r = client.post(f"{API}/documents/{doc_id}/transition", json={"status": "signed"})
        assert r.status_code == 422, f"Expected 422, got {r.status_code} — {r.text}"

    def test_full_lifecycle_flow_and_hash_and_lock(self, client, doc_id):
        # draft → generated
        r1 = client.post(f"{API}/documents/{doc_id}/transition", json={"status": "generated"})
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        h = d1.get("document_hash") or d1.get("documentHash")
        assert h, "generated debe setear document_hash"

        # generated → shared
        r2 = client.post(f"{API}/documents/{doc_id}/transition", json={"status": "shared"})
        assert r2.status_code == 200, r2.text

        # shared → signed
        r3 = client.post(f"{API}/documents/{doc_id}/transition", json={"status": "signed"})
        assert r3.status_code == 200, r3.text
        d3 = r3.json()
        locked = d3.get("locked_at") or d3.get("lockedAt")
        assert locked, "signed debe setear locked_at"

        # PATCH tras signed → 409
        r4 = client.patch(f"{API}/documents/{doc_id}", json={"title": "otro"})
        assert r4.status_code == 409, f"Expected 409, got {r4.status_code} — {r4.text}"

    def test_archived_terminal(self, client, doc_id):
        # llevar hasta archived pasando por generated
        client.post(f"{API}/documents/{doc_id}/transition", json={"status": "generated"})
        r = client.post(f"{API}/documents/{doc_id}/transition", json={"status": "archived"})
        assert r.status_code == 200, r.text
        # archived → cualquier otra → 422
        r2 = client.post(f"{API}/documents/{doc_id}/transition", json={"status": "generated"})
        assert r2.status_code == 422


# ============================ History ===================================== #
class TestHistory:
    """Historial como eventos (append-only)."""

    def test_history_events_in_order(self, client, person_id):
        tk = _key("history")
        t = client.post(f"{API}/documents/templates", json={
            "templateKey": tk, "name": "TEST HIST", "category": "recibo",
        }).json()
        d = client.post(f"{API}/documents", json={
            "templateId": t["id"], "title": "TEST HIST doc",
            "relationships": [{"entityType": "person", "entityId": person_id}],
        }).json()
        doc_id = d["id"]
        # transiciones
        client.post(f"{API}/documents/{doc_id}/transition", json={"status": "generated"})
        client.post(f"{API}/documents/{doc_id}/transition", json={"status": "shared"})
        # dar tiempo a que el mongo write se persista
        time.sleep(0.5)

        r = client.get(f"{API}/documents/{doc_id}/history")
        assert r.status_code == 200, r.text
        hist = r.json()
        assert isinstance(hist, list) and len(hist) >= 3
        types = [ev.get("type") for ev in hist]
        # (más recientes primero)
        assert "document.created" in types
        assert "document.generated" in types
        assert "document.shared" in types


# ========================== Relationships =============================== #
class TestRelationships:
    def test_add_and_delete_relationship(self, client, person_id, property_id):
        tk = _key("rel")
        t = client.post(f"{API}/documents/templates", json={
            "templateKey": tk, "name": "TEST REL", "category": "contrato",
        }).json()
        d = client.post(f"{API}/documents", json={
            "templateId": t["id"], "title": "TEST REL doc",
            "relationships": [{"entityType": "person", "entityId": person_id, "role": "comprador"}],
        }).json()
        did = d["id"]
        # add
        r = client.post(f"{API}/documents/{did}/relationships",
                        json={"entityType": "property", "entityId": property_id})
        assert r.status_code == 201, r.text
        added = r.json()
        # list
        lr = client.get(f"{API}/documents/{did}/relationships")
        assert lr.status_code == 200
        assert len(lr.json()) == 2
        # delete the newly added → ok (queda al menos 1)
        dr = client.delete(f"{API}/documents/{did}/relationships/{added['id']}")
        assert dr.status_code in (200, 204), dr.text
        # ahora sólo queda 1 → intentar borrar la última debe fallar 422
        remaining = client.get(f"{API}/documents/{did}/relationships").json()
        assert len(remaining) == 1
        dr2 = client.delete(f"{API}/documents/{did}/relationships/{remaining[0]['id']}")
        assert dr2.status_code == 422, f"Expected 422, got {dr2.status_code} — {dr2.text}"


# ============================ Signatures ================================= #
class TestSignatures:
    def test_add_and_update_signature(self, client, person_id):
        tk = _key("sig")
        t = client.post(f"{API}/documents/templates", json={
            "templateKey": tk, "name": "TEST SIG", "category": "poder",
        }).json()
        d = client.post(f"{API}/documents", json={
            "templateId": t["id"], "title": "TEST SIG doc",
            "relationships": [{"entityType": "person", "entityId": person_id, "role": "otorgante"}],
        }).json()
        did = d["id"]
        # add
        r = client.post(f"{API}/documents/{did}/signatures", json={
            "signerPersonId": person_id, "signerRole": "otorgante", "signOrder": 1,
        })
        assert r.status_code == 201, r.text
        sig = r.json()
        # patch → signed
        pr = client.patch(f"{API}/documents/{did}/signatures/{sig['id']}", json={"status": "signed"})
        assert pr.status_code == 200, pr.text
        updated = pr.json()
        assert updated.get("status") == "signed"
        signed_at = updated.get("signed_at") or updated.get("signedAt")
        assert signed_at, "signed_at debe setearse al firmar"
        # status inválido
        bad = client.patch(f"{API}/documents/{did}/signatures/{sig['id']}", json={"status": "kaboom"})
        assert bad.status_code == 422
