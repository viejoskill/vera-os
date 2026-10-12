"""Backend tests para descarga de fotos de Alquileres (A161).

Endpoints bajo test:
- GET /api/rentals/properties/{pid}/images/{imgId}/download
- GET /api/rentals/properties/{pid}/export/photos.zip
"""
import io
import os
import zipfile
import pytest
import requests
from PIL import Image

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if False else None
# Load from frontend/.env for integration test (public URL)
with open("/app/frontend/.env") as f:
    for line in f:
        if line.startswith("REACT_APP_BACKEND_URL"):
            BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
            break

PID = "6744cf8a907f4a239a7504101c66a2df"


def _mkimg(fmt="JPEG"):
    buf = io.BytesIO()
    Image.new("RGB", (16, 16), color=(123, 200, 50)).save(buf, format=fmt)
    buf.seek(0)
    return buf


@pytest.fixture(scope="module")
def session():
    return requests.Session()


@pytest.fixture(scope="module")
def uploaded_images(session):
    """Sube 2 fotos a A161 y las elimina al final."""
    uploaded = []
    for i, fmt in enumerate(["JPEG", "PNG"]):
        buf = _mkimg(fmt)
        files = {"file": (f"test_{i}.{fmt.lower()}", buf, f"image/{fmt.lower()}")}
        r = session.post(f"{BASE_URL}/api/rentals/properties/{PID}/images", files=files)
        assert r.status_code == 201, f"upload failed: {r.status_code} {r.text}"
        uploaded.append(r.json()["id"])
    yield uploaded
    # cleanup
    for img_id in uploaded:
        session.delete(f"{BASE_URL}/api/rentals/properties/{PID}/images/{img_id}")


def test_zip_404_when_no_photos(session):
    """Antes de subir, A161 no tiene fotos → ZIP debe dar 404."""
    r = session.get(f"{BASE_URL}/api/rentals/properties/{PID}/export/photos.zip")
    assert r.status_code == 404
    assert "foto" in r.text.lower() or "sin" in r.text.lower() or "no" in r.text.lower()


def test_single_image_download(session, uploaded_images):
    img_id = uploaded_images[0]
    r = session.get(f"{BASE_URL}/api/rentals/properties/{PID}/images/{img_id}/download")
    assert r.status_code == 200
    assert r.headers.get("content-type", "").startswith("image/")
    cd = r.headers.get("content-disposition", "")
    assert "attachment" in cd.lower()
    assert "A161" in cd  # codigo de propiedad
    assert len(r.content) > 100


def test_single_image_download_404(session, uploaded_images):
    r = session.get(f"{BASE_URL}/api/rentals/properties/{PID}/images/noexiste/download")
    assert r.status_code == 404


def test_zip_download(session, uploaded_images):
    r = session.get(f"{BASE_URL}/api/rentals/properties/{PID}/export/photos.zip")
    assert r.status_code == 200
    assert r.headers.get("content-type") == "application/zip"
    cd = r.headers.get("content-disposition", "")
    assert "attachment" in cd.lower()
    assert "A161" in cd
    zf = zipfile.ZipFile(io.BytesIO(r.content))
    names = zf.namelist()
    assert len(names) == len(uploaded_images)
    # Numeradas: 01-foto.ext, 02-foto.ext
    assert any(n.startswith("01-foto") for n in names)
    assert any(n.startswith("02-foto") for n in names)
