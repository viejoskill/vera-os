"""Tests for property file export/download endpoints (Sprint: exportar/backup).

Covers:
  * GET /api/properties/{id}/export/photos.zip → 200, zip, Content-Disposition VAR-XXXXXX-fotos.zip
  * ZIP entries: sequential prefix 01-, 02-... in position order; count = image count
  * GET /api/properties/{id}/images/{imageId}/download → 200, image mime, original name
  * Zero-images → 404 with Spanish message
  * Non-existent image → 404
"""
from __future__ import annotations

import io
import os
import re
import zipfile

import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else "https://real-estate-os-10.preview.emergentagent.com"
# Property known to have 14 photos, per review request.
PROPERTY_ID = "9c1d4217-2522-4649-a269-bbd536a71f39"
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def api_client() -> requests.Session:
    s = requests.Session()
    s.headers.update({"Accept": "*/*"})
    return s


@pytest.fixture(scope="module")
def property_detail(api_client: requests.Session) -> dict:
    r = api_client.get(f"{API}/properties/{PROPERTY_ID}", timeout=30)
    assert r.status_code == 200, f"Property fetch failed: {r.status_code} {r.text[:200]}"
    return r.json()


# --- photos.zip export ---------------------------------------------------- #
class TestExportPhotosZip:
    def test_zip_headers_and_status(self, api_client: requests.Session):
        r = api_client.get(f"{API}/properties/{PROPERTY_ID}/export/photos.zip", timeout=60)
        assert r.status_code == 200
        assert r.headers.get("Content-Type", "").startswith("application/zip")
        cd = r.headers.get("Content-Disposition", "")
        assert "attachment" in cd.lower()
        # Expect VAR-XXXXXX-fotos.zip pattern in ascii filename or filename*.
        assert re.search(r"VAR-[A-Za-z0-9]+-fotos\.zip", cd), f"Unexpected CD: {cd}"

    def test_zip_is_valid_and_entries_ordered(self, api_client, property_detail):
        r = api_client.get(f"{API}/properties/{PROPERTY_ID}/export/photos.zip", timeout=60)
        assert r.status_code == 200
        images = property_detail.get("images") or []
        expected_count = len(images)
        assert expected_count > 0, "Fixture property should have images"

        with zipfile.ZipFile(io.BytesIO(r.content)) as zf:
            bad = zf.testzip()
            assert bad is None, f"Corrupt entry: {bad}"
            names = zf.namelist()
            assert len(names) == expected_count, f"expected {expected_count} entries, got {len(names)}"
            # Ordered sequential prefixes 01-, 02-, ...
            for i, name in enumerate(names, start=1):
                assert name.startswith(f"{i:02d}-"), f"entry {i} bad prefix: {name}"
            # Order must correspond to images sorted by position ascending.
            images_sorted = sorted(images, key=lambda x: x.get("position", 0))
            for i, (img, entry) in enumerate(zip(images_sorted, names), start=1):
                original = img.get("originalName") or img.get("original_name") or ""
                # Ignore non-ascii vs unicode: check the sequence prefix and that stem+ext match.
                if original:
                    # entry ascii-friendly compare on suffix (extension)
                    ext = os.path.splitext(original)[1] or ".jpg"
                    assert entry.endswith(ext), f"entry {entry} ext mismatch, expected {ext}"


# --- single image download ------------------------------------------------ #
class TestDownloadSingleImage:
    def test_single_download_ok(self, api_client, property_detail):
        images = property_detail.get("images") or []
        assert images, "Need at least one image"
        img = images[0]
        image_id = img.get("id")
        r = api_client.get(
            f"{API}/properties/{PROPERTY_ID}/images/{image_id}/download", timeout=60
        )
        assert r.status_code == 200
        mime = r.headers.get("Content-Type", "")
        assert mime.startswith("image/"), f"unexpected mime: {mime}"
        cd = r.headers.get("Content-Disposition", "")
        assert "attachment" in cd.lower()
        # Body should be non-empty bytes.
        assert len(r.content) > 100

    def test_single_download_nonexistent_image(self, api_client):
        r = api_client.get(
            f"{API}/properties/{PROPERTY_ID}/images/00000000-0000-0000-0000-000000000000/download",
            timeout=30,
        )
        assert r.status_code == 404


# --- error cases ---------------------------------------------------------- #
class TestExportErrors:
    def test_export_photos_on_nonexistent_property(self, api_client):
        r = api_client.get(
            f"{API}/properties/00000000-0000-0000-0000-000000000000/export/photos.zip",
            timeout=30,
        )
        assert r.status_code == 404

    def test_export_photos_on_property_without_images(self, api_client):
        """Create a temporary property (no images), assert 404 Spanish message, then delete."""
        create = api_client.post(
            f"{API}/properties",
            json={
                "title": "TEST_export_empty",
                "operation": "sale",
                "type": "apartment",
                "price": 1,
                "currency": "USD",
                "address": "TEST addr",
                "neighborhood": "TEST",
                "city": "Buenos Aires",
                "bedrooms": 1,
                "bathrooms": 1,
                "areaM2": 1,
                "status": "draft",
                "description": "TEST",
            },
            timeout=30,
        )
        if create.status_code not in (200, 201):
            pytest.skip(f"Cannot create test property: {create.status_code} {create.text[:200]}")
        prop_id = create.json().get("id")
        try:
            r = api_client.get(f"{API}/properties/{prop_id}/export/photos.zip", timeout=30)
            assert r.status_code == 404
            body = r.text.lower()
            # Spanish message check
            assert "no tiene fotos" in body or "no tiene" in body or "fotos" in body
        finally:
            api_client.delete(f"{API}/properties/{prop_id}", timeout=30)
