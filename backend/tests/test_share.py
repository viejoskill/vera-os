"""Tests for GET /api/properties/{id}/share, /stamped-cover, /story."""
import os
import re
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback: read from /app/frontend/.env
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                    break
    except Exception:
        pass

SOLD_ID = "7bab1bf2-3170-4396-914e-837b0a03afb2"


@pytest.fixture(scope="module")
def active_id():
    r = requests.get(f"{BASE_URL}/api/properties", params={"status": "active"}, timeout=30)
    assert r.status_code == 200, r.text
    rows = r.json()
    if not rows:
        pytest.skip("No active properties in DB")
    return rows[0]["id"]


class TestShare:
    def _assert_share_html(self, r, property_id):
        assert r.status_code == 200, r.text
        assert "text/html" in r.headers.get("Content-Type", "")
        html = r.text
        # og:title present, non-empty
        m_title = re.search(r'<meta property="og:title" content="([^"]+)"', html)
        assert m_title and m_title.group(1).strip(), "og:title missing/empty"
        # og:image with http URL
        m_img = re.search(r'<meta property="og:image" content="([^"]+)"', html)
        assert m_img, "og:image missing"
        assert m_img.group(1).startswith("http"), f"og:image not http: {m_img.group(1)}"
        # og:url ends with /web/{property_id}
        m_url = re.search(r'<meta property="og:url" content="([^"]+)"', html)
        assert m_url, "og:url missing"
        assert m_url.group(1).endswith(f"/web/{property_id}"), m_url.group(1)
        # meta refresh + window.location.replace
        assert re.search(r'http-equiv="refresh"[^>]*url=[^"]*/web/' + re.escape(property_id), html), \
            "meta refresh redirect missing"
        assert f'window.location.replace("' in html and f"/web/{property_id}" in html, \
            "window.location.replace missing"

    def test_share_sold(self):
        r = requests.get(f"{BASE_URL}/api/properties/{SOLD_ID}/share", timeout=60, allow_redirects=False)
        self._assert_share_html(r, SOLD_ID)

    def test_share_active(self, active_id):
        r = requests.get(f"{BASE_URL}/api/properties/{active_id}/share", timeout=60, allow_redirects=False)
        self._assert_share_html(r, active_id)

    def test_share_not_found(self):
        r = requests.get(f"{BASE_URL}/api/properties/does-not-exist-xxx/share", timeout=30)
        assert r.status_code == 404


class TestStampedCoverAndStory:
    def test_stamped_cover_sold(self):
        r = requests.get(f"{BASE_URL}/api/properties/{SOLD_ID}/stamped-cover",
                         params={"status": "sold"}, timeout=90)
        assert r.status_code == 200, r.text[:300]
        assert r.headers.get("Content-Type", "").startswith("image/jpeg")
        assert len(r.content) > 5000  # non-trivial JPEG

    def test_story_sold_dimensions(self):
        r = requests.get(f"{BASE_URL}/api/properties/{SOLD_ID}/story",
                         params={"status": "sold"}, timeout=120)
        assert r.status_code == 200, r.text[:300]
        assert r.headers.get("Content-Type", "").startswith("image/jpeg")
        # Validate dimensions 1080x1920 via PIL
        try:
            from PIL import Image
            import io
            img = Image.open(io.BytesIO(r.content))
            assert img.size == (1080, 1920), f"Unexpected story size {img.size}"
        except ImportError:
            pytest.skip("PIL not installed")
