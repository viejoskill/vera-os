# Public photo WebP variants (image_variants.py + public_photos.py + serializers) — iteration_97
import asyncio
import io
import os
import sys
import uuid

import pytest
import requests
from dotenv import load_dotenv
from PIL import Image

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
sys.path.insert(0, "/app/backend")

PUBLIC_PREFIX = "/storage/v1/object/public/property-images-public/"


def _jpeg(w, h, color=(200, 30, 30)):
    buf = io.BytesIO()
    Image.new("RGB", (w, h), color).save(buf, format="JPEG", quality=90)
    return buf.getvalue()


@pytest.fixture(scope="module")
def listings():
    r = requests.get(f"{BASE_URL}/api/public/listings", timeout=60)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list) and data
    return data


# ---------- unit: image_variants ----------
class TestImageVariantsUnit:
    def test_widths_smaller_than_original(self):
        from image_variants import generate_webp_variants
        out = generate_webp_variants(_jpeg(2000, 1000))
        assert sorted(out) == [480, 960, 1600]
        for w, b in out.items():
            im = Image.open(io.BytesIO(b))
            assert im.format == "WEBP" and im.size[0] == w and im.size[1] == round(1000 * w / 2000)

    def test_skips_widths_not_smaller(self):
        from image_variants import generate_webp_variants
        assert sorted(generate_webp_variants(_jpeg(1000, 800))) == [480, 960]
        assert generate_webp_variants(_jpeg(480, 720)) == {}

    def test_garbage_returns_empty(self):
        from image_variants import generate_webp_variants
        assert generate_webp_variants(b"not an image") == {}

    def test_rgba_png(self):
        from image_variants import generate_webp_variants
        buf = io.BytesIO()
        Image.new("RGBA", (1000, 500), (0, 0, 0, 0)).save(buf, format="PNG")
        out = generate_webp_variants(buf.getvalue())
        assert Image.open(io.BytesIO(out[480])).mode == "RGBA"

    def test_exif_orientation_applied(self):
        from image_variants import generate_webp_variants
        im = Image.new("RGB", (2000, 1000))
        exif = im.getexif()
        exif[0x0112] = 6  # rotate 90
        buf = io.BytesIO()
        im.save(buf, format="JPEG", exif=exif.tobytes())
        out = generate_webp_variants(buf.getvalue())
        # After transpose it's 1000x2000 → only 480/960
        assert sorted(out) == [480, 960]
        assert Image.open(io.BytesIO(out[480])).size == (480, 960)


# ---------- public API ----------
class TestPublicListingsVariants:
    def test_listings_have_variant_field(self, listings):
        with_var = [p for p in listings if p.get("coverImageVariants")]
        assert len(with_var) >= len(listings) * 0.8
        for p in with_var:
            assert set(p["coverImageVariants"]).issubset({"480", "960", "1600"})
            for url in p["coverImageVariants"].values():
                assert PUBLIC_PREFIX in url and url.endswith(".webp")

    def test_variant_urls_served_publicly_as_webp(self, listings):
        p = next(p for p in listings if p.get("coverImageVariants"))
        for w, url in p["coverImageVariants"].items():
            r = requests.get(url, timeout=30)
            assert r.status_code == 200, url
            assert r.headers.get("content-type", "").startswith("image/webp")
            assert "31536000" in r.headers.get("cache-control", "")
            assert Image.open(io.BytesIO(r.content)).size[0] == int(w)

    def test_detail_images_variants(self, listings):
        p = next(p for p in listings if p.get("coverImageVariants"))
        r = requests.get(f"{BASE_URL}/api/public/listings/{p['id']}", timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert d["coverImageVariants"] == p["coverImageVariants"]
        assert any(i.get("variants") for i in d["images"])
        for i in d["images"]:
            assert "url" in i and i["url"]  # original signed still present
            for url in (i.get("variants") or {}).values():
                assert PUBLIC_PREFIX in url

    def test_original_is_not_in_public_bucket(self, listings):
        p = next(p for p in listings if p.get("coverImageVariants"))
        assert "property-images-public" not in p["coverImage"]
        assert "token=" in p["coverImage"] or "/sign/" in p["coverImage"]


# ---------- CRM API: upload/delete on UNPUBLISHED TEST property ----------
class TestCrmUnpublished:
    created = []

    @classmethod
    def teardown_class(cls):
        for pid in cls.created:
            requests.delete(f"{BASE_URL}/api/properties/{pid}", timeout=60)

    def test_upload_to_unpublished_has_no_variants(self):
        r = requests.post(f"{BASE_URL}/api/properties", json={"title": "TEST_variants_unpublished", "status": "draft"}, timeout=60)
        assert r.status_code == 201, r.text
        pid = r.json()["id"]
        self.created.append(pid)
        up = requests.post(
            f"{BASE_URL}/api/properties/{pid}/images",
            files={"file": ("big.jpg", _jpeg(2000, 1200), "image/jpeg")}, timeout=120,
        )
        assert up.status_code == 201, up.text
        img = up.json()
        assert img["variants"] == {}
        assert img["url"]
        det = requests.get(f"{BASE_URL}/api/properties/{pid}", timeout=60).json()
        assert det["coverImageVariants"] == {}
        assert all(i["variants"] == {} for i in det["images"])
        # no manifest created for unpublished property
        from public_photos import _manifest_path
        from storage_service import get_storage
        import config
        url = get_storage().get_public_url(config.BUCKET_IMAGES_PUBLIC, _manifest_path(pid))
        assert requests.get(url, timeout=20).status_code in (400, 404)
        # delete image works
        dr = requests.delete(f"{BASE_URL}/api/properties/{pid}/images/{img['id']}", timeout=60)
        assert dr.status_code in (200, 204)

    def test_crm_list_has_field(self):
        r = requests.get(f"{BASE_URL}/api/properties", timeout=120)
        assert r.status_code == 200
        rows = r.json()
        assert rows and all("coverImageVariants" in p for p in rows)


# ---------- service-level: sync/remove single image (TEST property, never published) ----------
class TestPublicPhotosService:
    def test_sync_and_remove_single_image(self):
        import config
        import public_photos
        from storage_service import get_storage

        async def run():
            st = get_storage()
            pid = f"TEST-{uuid.uuid4()}"
            path = f"workspaces/vera-default/properties/{pid}/images/{uuid.uuid4().hex}.jpg"
            await st.upload(config.BUCKET_IMAGES, path, _jpeg(1800, 1200), "image/jpeg")
            img = {"id": str(uuid.uuid4()), "bucket": config.BUCKET_IMAGES, "object_path": path}
            try:
                sizes = await public_photos.sync_single_image(pid, img)
                assert sorted(sizes) == [480, 960, 1600]
                public_photos._MANIFEST_CACHE.pop(pid, None)
                man = await public_photos.read_manifest(pid)
                assert man == {img["id"]: [480, 960, 1600]}
                urls = public_photos.public_variant_urls(path)
                assert requests.get(urls["960"], timeout=20).status_code == 200
                await public_photos.remove_single_image(pid, img)
                public_photos._MANIFEST_CACHE.pop(pid, None)
                assert await public_photos.read_manifest(pid) == {}
                assert requests.get(urls["960"], timeout=20).status_code in (400, 404)
            finally:
                await public_photos.delete_variants(path)
                await public_photos.delete_manifest(pid)
                await st.delete(config.BUCKET_IMAGES, path)

        asyncio.run(run())
