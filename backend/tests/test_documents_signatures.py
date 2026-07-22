"""Backend tests — Signature engine (Sprint 3).

Covers:
- PATCH /api/documents/templates/{id} with {signatureMethods:[...]}
- POST /api/documents with signatureMethod + persons creates participants
- PATCH /api/documents/{id}/signature-method (post-creation)
- POST /api/documents/{id}/participants/{pid}/send for whatsapp/email/link channels
- GET /api/sign/{token} marks 'viewed'
- POST /api/sign/{token} signs, invalidates token; document→'signed' + lockedAt when all required signed
- POST /api/sign/{token} reject flow
- GET /api/documents/{id}/history contains full event chain
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://real-estate-os-10.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

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
    assert people, "Need at least 1 real person"
    return people[0]["id"]


# ------------------------------- Template patch --------------------------- #
class TestTemplateSignatureMethods:
    def test_patch_signature_methods_persists(self, api_client):
        # Read current
        r0 = api_client.get(f"{API}/documents/templates/{AUTH_TEMPLATE_ID}")
        assert r0.status_code == 200
        original = r0.json().get("signatureMethods") or []

        # Patch to digital only
        r1 = api_client.patch(
            f"{API}/documents/templates/{AUTH_TEMPLATE_ID}",
            json={"signatureMethods": ["digital"]},
        )
        assert r1.status_code == 200, r1.text
        assert r1.json()["signatureMethods"] == ["digital"]

        # GET verifies persistence
        r2 = api_client.get(f"{API}/documents/templates/{AUTH_TEMPLATE_ID}")
        assert r2.status_code == 200
        assert r2.json()["signatureMethods"] == ["digital"]

        # Restore original (so wizard tests still have both methods)
        restore = ["digital", "presencial"] if not original else original
        r3 = api_client.patch(
            f"{API}/documents/templates/{AUTH_TEMPLATE_ID}",
            json={"signatureMethods": restore},
        )
        assert r3.status_code == 200
        assert set(r3.json()["signatureMethods"]) == set(restore)


# ------------------------------- Create doc w/ method --------------------- #
def _create_doc_digital(api_client, person_id, title_suffix=""):
    title = f"TEST_sig_digital_{int(time.time()*1000)}{title_suffix}"
    r = api_client.post(f"{API}/documents", json={
        "templateId": AUTH_TEMPLATE_ID,
        "title": title,
        "persons": [{"personId": person_id, "role": "vendedor"}],
        "signatureMethod": "digital",
        "origin": "manual",
    })
    assert r.status_code == 201, r.text
    return r.json()


class TestCreateWithSignatureMethod:
    def test_create_persists_method_and_participants(self, api_client, a_person_id):
        doc = _create_doc_digital(api_client, a_person_id)
        assert doc["signatureMethod"] == "digital"
        assert doc["status"] == "draft"
        assert doc.get("lockedAt") in (None, "")
        parts = doc.get("participants") or []
        assert len(parts) == 1, f"expected 1 participant, got {parts}"
        p = parts[0]
        assert p["personId"] == a_person_id
        assert p["role"] == "vendedor"
        assert p["signatureStatus"] == "pending"
        assert p["signatureRequired"] is True
        assert (p.get("signatureMethod") or "digital") == "digital"

    def test_create_rejects_invalid_method(self, api_client, a_person_id):
        r = api_client.post(f"{API}/documents", json={
            "templateId": AUTH_TEMPLATE_ID,
            "title": f"TEST_sig_bad_{int(time.time())}",
            "persons": [{"personId": a_person_id, "role": "vendedor"}],
            "signatureMethod": "biometric",
        })
        assert r.status_code == 422, r.text


# ------------------------------- Send channels ---------------------------- #
class TestSendSignature:
    @pytest.fixture(scope="class")
    def doc_and_pid(self, api_client, a_person_id):
        doc = _create_doc_digital(api_client, a_person_id, "_send")
        pid = doc["participants"][0]["id"]
        return doc, pid

    def test_send_whatsapp_returns_wa_url(self, api_client, doc_and_pid):
        doc, pid = doc_and_pid
        r = api_client.post(
            f"{API}/documents/{doc['id']}/participants/{pid}/send",
            json={"channel": "whatsapp", "baseUrl": BASE_URL},
        )
        assert r.status_code == 200, r.text
        p = r.json()
        assert p["channel"] == "whatsapp"
        assert p["url"].startswith(f"{BASE_URL}/firma/")
        assert "message" in p and p["message"]
        assert "whatsappUrl" in p and p["whatsappUrl"].startswith("https://wa.me/")

        # Doc moved to 'shared'
        g = api_client.get(f"{API}/documents/{doc['id']}")
        assert g.status_code == 200
        assert g.json()["status"] == "shared"

    def test_send_email_returns_mailto(self, api_client, doc_and_pid):
        doc, pid = doc_and_pid
        r = api_client.post(
            f"{API}/documents/{doc['id']}/participants/{pid}/send",
            json={"channel": "email", "baseUrl": BASE_URL},
        )
        assert r.status_code == 200, r.text
        p = r.json()
        assert p["channel"] == "email"
        assert p.get("mailtoUrl", "").startswith("mailto:")

    def test_send_link_returns_url(self, api_client, doc_and_pid):
        doc, pid = doc_and_pid
        r = api_client.post(
            f"{API}/documents/{doc['id']}/participants/{pid}/send",
            json={"channel": "link", "baseUrl": BASE_URL},
        )
        assert r.status_code == 200, r.text
        p = r.json()
        assert p["channel"] == "link"
        assert p["url"].startswith(f"{BASE_URL}/firma/")


# ------------------------------- Full sign flow --------------------------- #
def _extract_token(url: str) -> str:
    return url.split("/firma/")[-1]


class TestPublicSignFlow:
    def test_full_digital_sign_flow(self, api_client, a_person_id):
        # 1. Create doc
        doc = _create_doc_digital(api_client, a_person_id, "_full")
        doc_id = doc["id"]
        pid = doc["participants"][0]["id"]

        # 2. Send link → get token
        r = api_client.post(
            f"{API}/documents/{doc_id}/participants/{pid}/send",
            json={"channel": "link", "baseUrl": BASE_URL},
        )
        assert r.status_code == 200, r.text
        token = _extract_token(r.json()["url"])
        assert token and len(token) > 20

        # 3. GET /api/sign/{token} → marks 'viewed'
        v = api_client.get(f"{API}/sign/{token}")
        assert v.status_code == 200, v.text
        view = v.json()
        assert view["token"] == token
        assert view["expired"] is False
        assert view["alreadySigned"] is False
        assert view["document"]["id"] == doc_id
        assert view["document"]["signatureMethod"] == "digital"
        assert "resolvedVariables" in view["document"]
        assert view["participant"]["status"] == "viewed"

        # Confirm status flipped in DB
        g = api_client.get(f"{API}/documents/{doc_id}")
        pstatus = next(p["signatureStatus"] for p in g.json()["participants"] if p["id"] == pid)
        assert pstatus == "viewed"

        # 4. POST /api/sign/{token} → sign
        s = api_client.post(f"{API}/sign/{token}", json={
            "action": "sign", "typedName": "Test Signer", "mode": "digital",
        })
        assert s.status_code == 200, s.text
        result = s.json()
        assert result.get("documentStatus") == "signed"
        assert result.get("signatureState") == "signed"

        # 5. Doc is locked & signed
        g2 = api_client.get(f"{API}/documents/{doc_id}")
        d2 = g2.json()
        assert d2["status"] == "signed"
        assert d2.get("lockedAt")
        p_signed = next(p for p in d2["participants"] if p["id"] == pid)
        assert p_signed["signatureStatus"] == "signed"
        assert p_signed.get("signedAt")

        # 6. Token invalidated → subsequent GET or POST returns 404/410
        again = api_client.get(f"{API}/sign/{token}")
        assert again.status_code in (404, 410), again.text
        again_post = api_client.post(f"{API}/sign/{token}", json={
            "action": "sign", "typedName": "Again"
        })
        assert again_post.status_code in (404, 410), again_post.text

        # 7. History contains full chain
        h = api_client.get(f"{API}/documents/{doc_id}/history")
        assert h.status_code == 200
        events = h.json()
        types = [e.get("type") for e in events]
        # Expected event kinds anywhere in the timeline
        expected = {
            "document.created",
            "document.shared",
            "document.participant.sent",
            "document.participant.viewed",
            "document.participant.signed",
            "document.signed",
        }
        missing = expected - set(types)
        assert not missing, f"Missing history events: {missing}. Got: {types}"

    def test_reject_flow(self, api_client, a_person_id):
        doc = _create_doc_digital(api_client, a_person_id, "_reject")
        doc_id, pid = doc["id"], doc["participants"][0]["id"]

        r = api_client.post(
            f"{API}/documents/{doc_id}/participants/{pid}/send",
            json={"channel": "link", "baseUrl": BASE_URL},
        )
        token = _extract_token(r.json()["url"])
        api_client.get(f"{API}/sign/{token}")  # marks viewed

        rej = api_client.post(f"{API}/sign/{token}", json={
            "action": "reject", "reason": "no aplica",
        })
        assert rej.status_code == 200, rej.text
        assert rej.json().get("signatureState") == "rejected"

        # Token invalidated
        again = api_client.post(f"{API}/sign/{token}", json={"action": "sign"})
        assert again.status_code in (404, 410)


class TestSignatureMethodPatch:
    def test_set_signature_method_after_creation(self, api_client, a_person_id):
        # Create doc without method
        r = api_client.post(f"{API}/documents", json={
            "templateId": AUTH_TEMPLATE_ID,
            "title": f"TEST_sig_no_method_{int(time.time())}",
            "persons": [{"personId": a_person_id, "role": "vendedor"}],
        })
        assert r.status_code == 201, r.text
        doc_id = r.json()["id"]
        assert (r.json().get("signatureMethod") or None) in (None, "")

        # PATCH to add method
        p = api_client.patch(f"{API}/documents/{doc_id}/signature-method",
                             json={"signatureMethod": "presencial"})
        assert p.status_code == 200, p.text
        assert p.json()["signatureMethod"] == "presencial"


class TestInvalidToken:
    def test_invalid_token_returns_404(self, api_client):
        r = api_client.get(f"{API}/sign/nonexistent-token-xyz")
        assert r.status_code == 404
