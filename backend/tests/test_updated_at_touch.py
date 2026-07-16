"""VERA OS backend regression tests for `updatedAt` field + `touch()` behavior.

Coverage:
- GET /api/properties and GET /api/properties/{id} expose `updatedAt` (ISO datetime).
- Every media/state activity bumps `updatedAt` on the parent property:
    * upload image, delete image, set cover, reorder images
    * upload document, delete document
    * archive/restore

These tests use the FIRST seeded property returned by the API and are safe:
uploaded assets are cleaned up in the same test. We do NOT create new
properties (no POST /properties endpoint is exposed) so the seed is unchanged.
"""
import io
import os
import time
from datetime import datetime

import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL", "https://real-estate-os-10.preview.emergentagent.com"
).rstrip("/")


def _iso_to_dt(s):
    # Support both 'Z' suffix and full offset
    if s.endswith("Z"):
        s = s.replace("Z", "+00:00")
    return datetime.fromisoformat(s)


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Accept": "application/json"})
    return s


@pytest.fixture(scope="module")
def properties(api):
    r = api.get(f"{BASE_URL}/api/properties", timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, list) and len(data) >= 1
    return data


@pytest.fixture(scope="module")
def sample_property_id(properties):
    return properties[0]["id"]


def _get_updated_at(api, pid):
    r = api.get(f"{BASE_URL}/api/properties/{pid}", timeout=30)
    assert r.status_code == 200, r.text
    return _iso_to_dt(r.json()["updatedAt"])


def _tiny_png_bytes():
    # 1x1 transparent PNG
    return bytes.fromhex(
        "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
        "0000000d49444154789c6300010000000500010d0a2db40000000049454e44ae426082"
    )


# --- updatedAt presence ------------------------------------------------------


class TestUpdatedAtField:
    def test_list_has_updated_at_valid(self, properties):
        for p in properties:
            assert "updatedAt" in p, f"missing updatedAt in {p.get('id')}"
            # must be a valid ISO datetime
            dt = _iso_to_dt(p["updatedAt"])
            assert isinstance(dt, datetime)
            # updated_at >= created_at
            assert dt >= _iso_to_dt(p["createdAt"])

    def test_detail_has_updated_at_valid(self, api, sample_property_id):
        r = api.get(f"{BASE_URL}/api/properties/{sample_property_id}", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert "updatedAt" in d
        dt = _iso_to_dt(d["updatedAt"])
        assert isinstance(dt, datetime)


# --- touch() on media activity ----------------------------------------------


class TestTouchOnActivity:
    def _upload_image(self, api, pid, name="test_touch.png"):
        files = {"file": (name, io.BytesIO(_tiny_png_bytes()), "image/png")}
        r = api.post(f"{BASE_URL}/api/properties/{pid}/images", files=files, timeout=60)
        assert r.status_code == 201, r.text
        return r.json()

    def _delete_image(self, api, pid, image_id):
        r = api.delete(
            f"{BASE_URL}/api/properties/{pid}/images/{image_id}", timeout=30
        )
        assert r.status_code == 204, r.text

    def test_upload_image_touches_updated_at(self, api, sample_property_id):
        before = _get_updated_at(api, sample_property_id)
        time.sleep(1.1)
        img = self._upload_image(api, sample_property_id, "touch_upload.png")
        after = _get_updated_at(api, sample_property_id)
        try:
            assert after > before, f"upload_image did not touch updatedAt (before={before}, after={after})"
        finally:
            self._delete_image(api, sample_property_id, img["id"])

    def test_delete_image_touches_updated_at(self, api, sample_property_id):
        img = self._upload_image(api, sample_property_id, "touch_delete.png")
        time.sleep(1.1)
        before = _get_updated_at(api, sample_property_id)
        time.sleep(1.1)
        self._delete_image(api, sample_property_id, img["id"])
        after = _get_updated_at(api, sample_property_id)
        assert after > before, f"delete_image did not touch updatedAt (before={before}, after={after})"

    def test_set_cover_touches_updated_at(self, api, sample_property_id):
        # need at least 1 image (we upload one to guarantee) then set it as cover
        img = self._upload_image(api, sample_property_id, "touch_cover.png")
        time.sleep(1.1)
        before = _get_updated_at(api, sample_property_id)
        time.sleep(1.1)
        try:
            r = api.patch(
                f"{BASE_URL}/api/properties/{sample_property_id}/images/{img['id']}/cover",
                timeout=30,
            )
            assert r.status_code == 204, r.text
            after = _get_updated_at(api, sample_property_id)
            assert after > before, f"set_cover did not touch updatedAt (before={before}, after={after})"
        finally:
            self._delete_image(api, sample_property_id, img["id"])

    def test_reorder_images_touches_updated_at(self, api, sample_property_id):
        # upload two images so we can reorder deterministically
        img1 = self._upload_image(api, sample_property_id, "touch_reorder1.png")
        img2 = self._upload_image(api, sample_property_id, "touch_reorder2.png")
        try:
            # get current order
            r = api.get(f"{BASE_URL}/api/properties/{sample_property_id}", timeout=30)
            assert r.status_code == 200
            image_ids = [im["id"] for im in r.json()["images"]]
            # reverse order
            reordered = list(reversed(image_ids))
            time.sleep(1.1)
            before = _get_updated_at(api, sample_property_id)
            time.sleep(1.1)
            r = api.patch(
                f"{BASE_URL}/api/properties/{sample_property_id}/images/reorder",
                json={"imageIds": reordered},
                timeout=30,
            )
            assert r.status_code == 204, r.text
            after = _get_updated_at(api, sample_property_id)
            assert after > before, f"reorder did not touch updatedAt (before={before}, after={after})"
        finally:
            self._delete_image(api, sample_property_id, img1["id"])
            self._delete_image(api, sample_property_id, img2["id"])

    def test_upload_document_touches_updated_at(self, api, sample_property_id):
        before = _get_updated_at(api, sample_property_id)
        time.sleep(1.1)
        files = {"file": ("plan.pdf", io.BytesIO(b"%PDF-1.4\n%test\n"), "application/pdf")}
        r = api.post(
            f"{BASE_URL}/api/properties/{sample_property_id}/documents",
            files=files,
            data={"doc_type": "plano"},
            timeout=60,
        )
        assert r.status_code == 201, r.text
        doc_id = r.json()["id"]
        try:
            after = _get_updated_at(api, sample_property_id)
            assert after > before, f"upload_document did not touch updatedAt (before={before}, after={after})"
        finally:
            # cleanup
            dr = api.delete(
                f"{BASE_URL}/api/properties/{sample_property_id}/documents/{doc_id}",
                timeout=30,
            )
            assert dr.status_code == 204, dr.text

    def test_delete_document_touches_updated_at(self, api, sample_property_id):
        files = {"file": ("plan2.pdf", io.BytesIO(b"%PDF-1.4\n%test2\n"), "application/pdf")}
        r = api.post(
            f"{BASE_URL}/api/properties/{sample_property_id}/documents",
            files=files,
            data={"doc_type": "plano"},
            timeout=60,
        )
        assert r.status_code == 201, r.text
        doc_id = r.json()["id"]
        time.sleep(1.1)
        before = _get_updated_at(api, sample_property_id)
        time.sleep(1.1)
        dr = api.delete(
            f"{BASE_URL}/api/properties/{sample_property_id}/documents/{doc_id}",
            timeout=30,
        )
        assert dr.status_code == 204, dr.text
        after = _get_updated_at(api, sample_property_id)
        assert after > before, f"delete_document did not touch updatedAt (before={before}, after={after})"

    def test_archive_restore_touches_updated_at(self, api, sample_property_id):
        # Try common archive/restore routes; skip cleanly if not exposed
        before = _get_updated_at(api, sample_property_id)
        time.sleep(1.1)
        archived_ok = False
        for candidate in (
            (f"{BASE_URL}/api/properties/{sample_property_id}/archive", "POST"),
            (f"{BASE_URL}/api/properties/{sample_property_id}/archive", "PATCH"),
            (f"{BASE_URL}/api/properties/{sample_property_id}", "PATCH"),
        ):
            url, method = candidate
            if method == "POST":
                r = api.post(url, timeout=30)
            else:
                r = api.patch(url, json={"archived": True}, timeout=30)
            if r.status_code in (200, 204):
                archived_ok = True
                break
        if not archived_ok:
            pytest.skip("No archive endpoint available in this build")
        after_archive = _get_updated_at(api, sample_property_id)
        assert after_archive > before, f"archive did not touch updatedAt"

        # restore
        time.sleep(1.1)
        restored_ok = False
        for candidate in (
            (f"{BASE_URL}/api/properties/{sample_property_id}/restore", "POST"),
            (f"{BASE_URL}/api/properties/{sample_property_id}/restore", "PATCH"),
            (f"{BASE_URL}/api/properties/{sample_property_id}", "PATCH"),
        ):
            url, method = candidate
            if method == "POST":
                r = api.post(url, timeout=30)
            else:
                r = api.patch(url, json={"archived": False}, timeout=30)
            if r.status_code in (200, 204):
                restored_ok = True
                break
        if not restored_ok:
            pytest.skip("No restore endpoint available in this build")
        after_restore = _get_updated_at(api, sample_property_id)
        assert after_restore > after_archive, f"restore did not touch updatedAt"
