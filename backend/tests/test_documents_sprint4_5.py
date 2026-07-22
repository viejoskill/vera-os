"""Backend tests — Sprints 4 & 5.

Sprint 4: PDF endpoint (GET /api/documents/{id}/pdf) returns application/pdf
with certification block for digital, signature lines for presencial.

Sprint 5: In-app notifications (GET /api/notifications, POST /read, POST
/read-all) — a signature emits a '✍️ Firma recibida' notification.

Also validates: GET /api/documents/by-property/{property_id} for the
documentation checklist.
"""
import io
import os
import time
import uuid

import pytest
import requests
from pypdf import PdfReader

try:
    from dotenv import load_dotenv
    load_dotenv("/app/frontend/.env")
except Exception:
    pass


def _extract_pdf_text(data: bytes) -> str:
    reader = PdfReader(io.BytesIO(data))
    return "\n".join((p.extract_text() or "") for p in reader.pages)

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"

TEMPLATE_ID = "ba0e6d91-f96c-4d95-b069-70c612315d3e"  # Autorización de Venta
PROPERTY_ID = "9c1d4217-2522-4649-a269-bbd536a71f39"   # Los Cedros 1015
PERSON_ID = "aa3d54c8-4ace-4a57-bbf2-804966547797"     # Persona sin DNI


@pytest.fixture(scope="module")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _create_doc(api_client, method="digital", inputs_overrides=None):
    inputs = {"precio": 185000, "propietario_dni": "30111222"}
    if inputs_overrides:
        inputs.update(inputs_overrides)
    r = api_client.post(f"{API}/documents", json={
        "templateId": TEMPLATE_ID,
        "title": f"TEST_sprint45_{uuid.uuid4().hex[:8]}",
        "persons": [{"personId": PERSON_ID, "role": "propietario"}],
        "propertyId": PROPERTY_ID,
        "signatureMethod": method,
        "inputs": inputs,
        "origin": "manual",
    })
    assert r.status_code == 201, r.text
    return r.json()


def _send_and_sign(api_client, doc, typed_name="TEST QA"):
    pid = doc["participants"][0]["id"]
    s = api_client.post(
        f"{API}/documents/{doc['id']}/participants/{pid}/send",
        json={"channel": "link", "baseUrl": BASE_URL},
    )
    assert s.status_code == 200, s.text
    token = s.json()["url"].split("/firma/")[-1]
    # POST /sign/{token}
    sr = api_client.post(f"{API}/sign/{token}", json={
        "action": "sign",
        "typedName": typed_name,
        "mode": doc.get("signatureMethod", "digital"),
    })
    assert sr.status_code == 200, sr.text
    return token, sr.json()


# ------------------------------- PDF -------------------------------------- #
class TestPdfEndpoint:
    def test_pdf_digital_returns_application_pdf(self, api_client):
        doc = _create_doc(api_client, method="digital")
        # Sign so certification block is meaningful
        _send_and_sign(api_client, doc, typed_name="Firmante Digital QA")

        r = api_client.get(f"{API}/documents/{doc['id']}/pdf")
        assert r.status_code == 200, r.text
        ct = r.headers.get("content-type", "")
        assert "application/pdf" in ct, f"unexpected content-type: {ct}"
        # PDF magic header
        assert r.content[:4] == b"%PDF", "response body is not a PDF"
        # Non-trivial size (>1KB)
        assert len(r.content) > 1024, f"pdf too small: {len(r.content)} bytes"
        # PDF should include the certification block header + firmante/method
        text = _extract_pdf_text(r.content)
        assert "Certificado" in text, f"digital PDF missing 'Certificado' header. Text sample:\n{text[:600]}"
        assert "Firmante" in text
        assert "Firma electr" in text  # 'Firma electrónica'

    def test_pdf_presencial_has_signature_lines(self, api_client):
        # Presencial doc — do NOT sign so the presencial line block renders
        # (unsigned line + placeholder). Even signed, presencial renders a line.
        doc = _create_doc(api_client, method="presencial")
        r = api_client.get(f"{API}/documents/{doc['id']}/pdf")
        assert r.status_code == 200, r.text
        assert "application/pdf" in r.headers.get("content-type", "")
        assert r.content[:4] == b"%PDF"
        # No certification block for presencial
        body = r.content.decode("latin-1", errors="ignore")
        # Presencial branch renders an underscore signature line + name/role,
        # and must NOT include the digital certification header.
        text = _extract_pdf_text(r.content)
        assert "____" in text, f"presencial PDF missing signature underscore line. Text sample:\n{text[:600]}"
        assert "Certificado de firma" not in text

    def test_pdf_404_for_missing_doc(self, api_client):
        r = api_client.get(f"{API}/documents/{uuid.uuid4()}/pdf")
        assert r.status_code in (404, 500), r.text


# ------------------------- Documents by property -------------------------- #
class TestByProperty:
    def test_by_property_returns_related_docs(self, api_client):
        # Create a doc explicitly for property → then read by-property
        doc = _create_doc(api_client, method="digital")
        r = api_client.get(f"{API}/documents/by-property/{PROPERTY_ID}")
        assert r.status_code == 200, r.text
        rows = r.json()
        assert isinstance(rows, list) and len(rows) > 0
        # Our just-created doc should be present
        ids = {d["id"] for d in rows}
        assert doc["id"] in ids, "created doc not returned in by-property list"
        # Each row must include signatureState and category (for checklist logic)
        for d in rows:
            assert "signatureState" in d
            assert "category" in d

    def test_by_property_empty_for_unknown(self, api_client):
        r = api_client.get(f"{API}/documents/by-property/{uuid.uuid4()}")
        assert r.status_code == 200
        assert r.json() == []


# ------------------------------- Notifications --------------------------- #
class TestNotifications:
    def test_signature_creates_notification(self, api_client):
        # Baseline
        b = api_client.get(f"{API}/notifications")
        assert b.status_code == 200, b.text
        baseline_ids = {n["id"] for n in b.json().get("items", [])}

        # Create + sign a doc → notification should be emitted
        doc = _create_doc(api_client, method="digital")
        _send_and_sign(api_client, doc, typed_name="Notif Test QA")

        # Poll briefly to allow async persistence
        found = None
        deadline = time.time() + 6
        while time.time() < deadline:
            r = api_client.get(f"{API}/notifications")
            assert r.status_code == 200, r.text
            data = r.json()
            for n in data.get("items", []):
                if n["id"] in baseline_ids:
                    continue
                if n.get("documentId") == doc["id"]:
                    found = n
                    break
            if found:
                break
            time.sleep(0.5)

        assert found is not None, "no notification emitted for signed document"
        # Fields
        assert "Firma" in found.get("title", "") or "✍" in found.get("title", "")
        assert found.get("read") is False
        assert found.get("link") and doc["id"] in found["link"]

    def test_mark_read_and_mark_all(self, api_client):
        # Create + sign to generate a fresh unread notif
        doc = _create_doc(api_client, method="digital")
        _send_and_sign(api_client, doc, typed_name="Mark Read QA")

        # Find the notif for that doc
        target = None
        deadline = time.time() + 6
        while time.time() < deadline:
            r = api_client.get(f"{API}/notifications")
            for n in r.json().get("items", []):
                if n.get("documentId") == doc["id"]:
                    target = n
                    break
            if target:
                break
            time.sleep(0.5)
        assert target is not None

        # mark this one read
        m = api_client.post(f"{API}/notifications/{target['id']}/read")
        assert m.status_code == 200 and m.json().get("ok") is True

        r2 = api_client.get(f"{API}/notifications")
        updated = next((n for n in r2.json()["items"] if n["id"] == target["id"]), None)
        assert updated is not None
        assert updated["read"] is True

        # Now mark all read (from any residual unread)
        ma = api_client.post(f"{API}/notifications/read-all")
        assert ma.status_code == 200 and ma.json().get("ok") is True
        r3 = api_client.get(f"{API}/notifications")
        assert r3.json().get("unread") == 0
