"""Exportador del CRM Legacy: 23 propiedades con su esquema PROPIO (campos en español,
distintos a los de VERA — por eso el importador hace un mapeo explícito). Imágenes y
documentos se exponen como URLs; VERA los descarga y los re-sube a su Storage.
"""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter

router = APIRouter(prefix="/export", tags=["crm-legacy-export"])

_DOC_URL = "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"

_CITIES = [
    ("Costa del Este", "La Costa", "Buenos Aires"),
    ("Pinamar", "Pinamar", "Buenos Aires"),
    ("Cariló", "Pinamar", "Buenos Aires"),
    ("Villa Gesell", "Villa Gesell", "Buenos Aires"),
    ("Mar del Plata", "General Pueyrredón", "Buenos Aires"),
]
_TYPES = ["casa", "departamento", "ph", "terreno", "local"]
_OPS = ["venta", "venta", "venta", "alquiler"]
_CONDS = ["a estrenar", "muy bueno", "bueno", "a reciclar"]
_AMEN = [
    ["pileta", "parrilla", "cochera"],
    ["balcón", "cochera"],
    ["patio", "parrilla"],
    [],
    ["seguridad", "amenities"],
]


def _build() -> list[dict]:
    now = datetime.now(timezone.utc)
    out: list[dict] = []
    for i in range(1, 24):
        lid = f"LEG-{i:04d}"
        city, barrio, prov = _CITIES[i % len(_CITIES)]
        tipo = _TYPES[i % len(_TYPES)]
        operacion = _OPS[i % len(_OPS)]
        is_land = tipo == "terreno"
        precio = (60000 + i * 7500) if operacion == "venta" else (350 + i * 40)
        imgs = 2 if i % 3 else 3
        out.append({
            "legacy_id": lid,
            "titulo": f"{tipo.capitalize()} en {city} #{i}",
            "tipo": tipo,
            "operacion": operacion,
            "precio": precio,
            "moneda": "USD" if operacion == "venta" else "ARS",
            "direccion": f"Calle {100 + i} N° {i * 15}",
            "barrio": barrio,
            "ciudad": city,
            "provincia": prov,
            "dormitorios": None if is_land else (i % 4) + 1,
            "banos": None if is_land else (i % 3) + 1,
            "ambientes": None if is_land else (i % 5) + 1,
            "superficie_cubierta": None if is_land else 45 + i * 6,
            "superficie_terreno": 200 + i * 20 if tipo in ("casa", "ph", "terreno") else None,
            "cocheras": 0 if is_land else i % 2,
            "descripcion": (
                f"Propiedad importada del CRM legacy ({lid}). {tipo.capitalize()} en {city}, "
                f"{_CONDS[i % len(_CONDS)]}. Excelente ubicación y oportunidad para {operacion}."
            ),
            "comodidades": _AMEN[i % len(_AMEN)],
            "estado_propiedad": _CONDS[i % len(_CONDS)],
            "anio": 1990 + (i % 30),
            "fecha_alta": (now - timedelta(days=120 - i * 3)).isoformat(),
            "fecha_modificacion": (now - timedelta(days=(i * 2) % 40)).isoformat(),
            "imagenes": [f"https://picsum.photos/seed/{lid}-{n}/800/600" for n in range(1, imgs + 1)],
            "documentos": [{"nombre": f"Plano-{lid}.pdf", "url": _DOC_URL, "tipo": "plano"}] if i % 5 == 0 else [],
        })
    return out


@router.get("/properties")
async def export_properties():
    props = _build()
    return {"count": len(props), "properties": props}
