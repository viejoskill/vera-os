"""Sprint: Compartir Propiedades (Public URL) — REFACTOR fuente única.

Verifica que Property.publicUrl provenga EXCLUSIVAMENTE de
`publications['web-varela'].url` (fuente única de verdad):

- Publicada en web  → publicUrl == '.../?propiedad=<idPublico>'
    (idPublico = legacy_id del CRM o `vera-<uuid>` para nacidas en VERA)
- No publicada (draft) → publicUrl == None
- /api/public/listings y /listings/{id} exponen la MISMA URL (fuente única)
- whatsappUrl deriva de esa URL: contiene `propiedad=<id>` url-encoded + `source=website`
- publish (idempotente) sobre publicada devuelve 200 y persiste url en publications
- PATCH inocuo re-sincroniza y NO borra la url

Formato de URL pública:
  https://www.varelapropiedadescde.com.ar/?propiedad=<idPublico>
"""
from __future__ import annotations

import os
from urllib.parse import quote

import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")

PUBLISHED_ID = "9c1d4217-2522-4649-a269-bbd536a71f39"
PUBLISHED_CODE = "VAR-163159"
# Esta propiedad nació en VERA (sin legacy_id) → idPublico = vera-<uuid>.
EXPECTED_PUBLIC_URL = (
    "https://www.varelapropiedadescde.com.ar/?propiedad=vera-9c1d4217-2522-4649-a269-bbd536a71f39"
)
EXPECTED_ID_PUBLICO = "vera-9c1d4217-2522-4649-a269-bbd536a71f39"
URL_PREFIX = "https://www.varelapropiedadescde.com.ar/?propiedad="


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# --- 1) GET /api/properties: 29/29 web-publicadas con publicUrl correcto ---
class TestListPublicUrl:
    def test_get_properties_returns_public_url_for_published(self, api):
        r = api.get(f"{BASE_URL}/api/properties", timeout=30)
        assert r.status_code == 200, r.text
        rows = r.json()
        assert isinstance(rows, list) and len(rows) > 0
        published = next((p for p in rows if p.get("id") == PUBLISHED_ID), None)
        assert published is not None, f"Fixture {PUBLISHED_ID} not found"
        assert published["publicUrl"] == EXPECTED_PUBLIC_URL

    def test_all_web_published_have_valid_public_url(self, api):
        """TODAS las propiedades con publications['web-varela'].status=='published'
        deben exponer publicUrl con formato '.../?propiedad=<id>' y NUNCA null."""
        r = api.get(f"{BASE_URL}/api/properties", timeout=30)
        assert r.status_code == 200
        rows = r.json()
        web_pub = [p for p in rows if (p.get("publications") or {}).get("web-varela", {}).get("status") == "published"]
        assert len(web_pub) >= 29, f"Expected >=29 web-published (backfill), got {len(web_pub)}"

        missing = [p["id"] for p in web_pub if not p.get("publicUrl")]
        assert missing == [], f"Published properties without publicUrl: {missing}"

        bad_format = [p["id"] for p in web_pub if not p["publicUrl"].startswith(URL_PREFIX)]
        assert bad_format == [], f"Published with bad publicUrl format: {bad_format}"

        # Regresión anti-bug antiguo: NUNCA formato '/propiedad/<code>'.
        legacy_path = [p["id"] for p in web_pub if "/propiedad/" in p["publicUrl"] and "?propiedad=" not in p["publicUrl"]]
        assert legacy_path == [], f"Legacy '/propiedad/<code>' format leaked: {legacy_path}"

    def test_no_inconsistent_publications(self, api):
        r = api.get(f"{BASE_URL}/api/properties", timeout=30)
        assert r.status_code == 200
        bad = [
            p["id"] for p in r.json()
            if (p.get("publications") or {}).get("web-varela", {}).get("status") == "inconsistent"
        ]
        assert bad == [], f"Inconsistent publications: {bad}"

    def test_public_url_matches_publications_url_single_source(self, api):
        """La fuente única: property.publicUrl == publications['web-varela'].url (exacto)."""
        r = api.get(f"{BASE_URL}/api/properties", timeout=30)
        assert r.status_code == 200
        for p in r.json():
            web = (p.get("publications") or {}).get("web-varela") or {}
            if web.get("status") == "published" and web.get("url"):
                assert p["publicUrl"] == web["url"], (
                    f"publicUrl NOT derived from publications.web-varela.url for {p['id']}"
                )
            else:
                assert p.get("publicUrl") is None, (
                    f"publicUrl should be null when not published, got {p.get('publicUrl')!r} for {p['id']}"
                )


# --- 2) Draft property → publicUrl == None (crear y limpiar) ---
class TestDraftHasNullPublicUrl:
    def test_draft_property_has_null_public_url(self, api):
        payload = {
            "title": "TEST_share_singlesource_draft",
            "operation": "venta",
            "type": "departamento",
            "price": 1,
            "currency": "USD",
            "status": "draft",
        }
        r = api.post(f"{BASE_URL}/api/properties", json=payload, timeout=30)
        assert r.status_code in (200, 201), r.text
        created = r.json()
        pid = created["id"]
        try:
            assert created.get("publicUrl") is None
            r2 = api.get(f"{BASE_URL}/api/properties/{pid}", timeout=30)
            assert r2.status_code == 200
            assert r2.json().get("publicUrl") is None
        finally:
            d = api.delete(f"{BASE_URL}/api/properties/{pid}", timeout=30)
            assert d.status_code in (200, 204), d.text


# --- 3) /api/public/listings expone publicUrl y whatsappUrl deriva de esa url ---
class TestPublicListings:
    def test_public_listing_detail_public_url(self, api):
        r = api.get(f"{BASE_URL}/api/public/listings/{PUBLISHED_ID}", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("publicUrl") == EXPECTED_PUBLIC_URL

    def test_public_listing_whatsapp_url_derives_from_public_url(self, api):
        """whatsappUrl DEBE contener la publicUrl url-encoded (con `propiedad=<id>`)
        + parámetros de tracking (source=website)."""
        r = api.get(f"{BASE_URL}/api/public/listings/{PUBLISHED_ID}", timeout=30)
        assert r.status_code == 200
        data = r.json()
        wa = data.get("whatsappUrl") or ""
        assert wa.startswith("https://wa.me/"), wa
        # `?propiedad=vera-<uuid>` va url-encoded dentro del text=... (el ? del query
        # queda como %3F).
        encoded_id_public = quote(EXPECTED_ID_PUBLICO)  # dashes se preservan
        assert f"propiedad%3D{encoded_id_public}" in wa, (
            f"whatsappUrl no contiene 'propiedad={EXPECTED_ID_PUBLICO}' encoded: {wa}"
        )
        # Tracking obligatorio
        assert "source%3Dwebsite" in wa, f"whatsappUrl missing source=website: {wa}"

    def test_public_listings_index_contains_public_url(self, api):
        r = api.get(f"{BASE_URL}/api/public/listings", timeout=30)
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list) and len(rows) > 0
        item = next((x for x in rows if x.get("id") == PUBLISHED_ID), None)
        assert item is not None, "Published fixture not present in public listings"
        assert item.get("publicUrl") == EXPECTED_PUBLIC_URL
        # whatsappUrl también en el listado
        assert item.get("whatsappUrl", "").startswith("https://wa.me/")


# --- 4) publish (idempotente) sobre publicada persiste url ---
class TestPublishIdempotent:
    def test_publish_web_varela_is_idempotent_and_persists_url(self, api):
        r = api.post(
            f"{BASE_URL}/api/properties/{PUBLISHED_ID}/publications/web-varela",
            json={"action": "publish"},
            timeout=60,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        pubs = data.get("publications") or {}
        web = pubs.get("web-varela") or {}
        assert web.get("status") == "published"
        assert web.get("url") == EXPECTED_PUBLIC_URL
        # publicUrl expuesta coherente (fuente única)
        assert data.get("publicUrl") == EXPECTED_PUBLIC_URL


# --- 5) PATCH inocuo NO borra publications.url (auto re-sync la persiste) ---
class TestPatchKeepsPublicUrl:
    def test_patch_same_title_keeps_public_url_persisted(self, api):
        # Leer estado actual
        g = api.get(f"{BASE_URL}/api/properties/{PUBLISHED_ID}", timeout=30)
        assert g.status_code == 200
        current = g.json()
        original_title = current.get("title") or "Casa"

        # PATCH inocuo con mismo título
        r = api.patch(
            f"{BASE_URL}/api/properties/{PUBLISHED_ID}",
            json={"title": original_title},
            timeout=60,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        pubs = data.get("publications") or {}
        web = pubs.get("web-varela") or {}
        assert web.get("status") == "published", f"Status changed after PATCH: {web}"
        assert web.get("url") == EXPECTED_PUBLIC_URL, (
            f"publications.web-varela.url was NOT preserved after PATCH: {web.get('url')!r}"
        )
        assert data.get("publicUrl") == EXPECTED_PUBLIC_URL
