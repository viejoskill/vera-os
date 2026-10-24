# Duplicación bidireccional Alquileres <-> Ventas (export-to-ventas / import/{sale_id})
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
API = f"{BASE_URL}/api"
RENTAL_ID = "6744cf8a907f4a239a7504101c66a2df"   # A161 - preservar
SALE_ID = "d4f49ca8-99a0-4f43-894b-dae93b2493f9"  # V754 - preservar


@pytest.fixture(scope="module")
def s():
    return requests.Session()


# Alquileres -> Ventas
class TestExportToVentas:
    def test_export_creates_sale_and_preserves_rental(self, s):
        before = s.get(f"{API}/rentals/properties/{RENTAL_ID}").json()
        r = s.post(f"{API}/rentals/properties/{RENTAL_ID}/export-to-ventas")
        assert r.status_code == 201, r.text
        sale = r.json()
        sid = sale["id"]
        try:
            assert sale["code"].startswith("V") and sale["code"][1:].isdigit()
            assert sale["title"] == before["titulo"]
            assert sale["operation"] == "venta"
            assert sale["status"] == "draft"
            assert sale["city"] == before["localidad"]
            assert sale["bedrooms"] == before["dormitorios"]
            assert sale["bathrooms"] == before["banos"]
            assert (sale.get("address") or "") == before["direccion"]
            assert (sale.get("description") or "") == before["descripcion"]
            g = s.get(f"{API}/properties/{sid}")
            assert g.status_code == 200 and g.json()["title"] == before["titulo"]
            after = s.get(f"{API}/rentals/properties/{RENTAL_ID}").json()
            assert after["exportadaAVentas"] == sid
            for k in ["titulo", "codigo", "precioNoche", "dormitorios", "banos", "activa", "localidad"]:
                assert after[k] == before[k], k
        finally:
            d = s.delete(f"{API}/properties/{sid}")
            assert d.status_code == 204
            assert s.get(f"{API}/properties/{sid}").status_code == 404

    def test_export_404(self, s):
        r = s.post(f"{API}/rentals/properties/doesnotexist123/export-to-ventas")
        assert r.status_code == 404


# Ventas -> Alquileres
class TestImportFromSale:
    def test_import_creates_rental_and_preserves_sale(self, s):
        sale = s.get(f"{API}/properties/{SALE_ID}").json()
        r = s.post(f"{API}/rentals/import/{SALE_ID}")
        assert r.status_code == 201, r.text
        rent = r.json()
        rid = rent["id"]
        try:
            assert rent["codigo"].startswith("A")
            assert rent["titulo"] == sale["title"]
            assert rent["direccion"] == sale["address"]
            assert rent["localidad"] == sale["city"]
            assert rent["dormitorios"] == sale["bedrooms"]
            assert rent["banos"] == sale["bathrooms"]
            assert rent["descripcion"] == sale["description"]
            assert rent["activa"] is False
            g = s.get(f"{API}/rentals/properties/{rid}")
            assert g.status_code == 200 and g.json()["titulo"] == sale["title"]
            sale2 = s.get(f"{API}/properties/{SALE_ID}").json()
            assert sale2["title"] == sale["title"] and sale2["status"] == sale["status"]
        finally:
            d = s.delete(f"{API}/rentals/properties/{rid}")
            assert d.status_code in (200, 204)
            assert s.get(f"{API}/rentals/properties/{rid}").status_code == 404

    def test_import_404(self, s):
        r = s.post(f"{API}/rentals/import/00000000-0000-0000-0000-000000000000")
        assert r.status_code == 404
