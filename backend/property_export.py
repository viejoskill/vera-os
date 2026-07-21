"""Exportación de los ARCHIVOS ORIGINALES de una propiedad como ZIP.

Diseño reutilizable pensado para el futuro "Exportar Propiedad": recibe una lista
de `ExportEntry` (hoy fotos; más adelante documentos, planos, videos y datos) y
arma un ZIP en memoria descargando SIEMPRE el objeto original desde Storage —
nunca miniaturas, versiones optimizadas ni ediciones de IA. VERA como respaldo
confiable de los activos digitales del usuario.
"""
from __future__ import annotations

import io
import zipfile
from dataclasses import dataclass
from pathlib import Path

from serializers import _property_code
from storage_service import get_storage


@dataclass(frozen=True)
class ExportEntry:
    """Un archivo original a incluir en el ZIP."""
    arcname: str  # ruta/nombre dentro del ZIP
    bucket: str
    object_path: str


def _safe_stem(name: str) -> str:
    """Nombre de archivo sin separadores de ruta (conserva el nombre original)."""
    return Path(name).name.replace("/", "-").replace("\\", "-") or "archivo"


def sequential_photo_name(index: int, original_name: str) -> str:
    """`01-nombreOriginal.jpg` — prefijo de orden + nombre original intacto."""
    clean = _safe_stem(original_name or f"foto-{index}.jpg")
    stem = Path(clean).stem or f"foto-{index}"
    ext = Path(clean).suffix or ".jpg"
    return f"{index:02d}-{stem}{ext}"


def photo_entries(prop: dict) -> list[ExportEntry]:
    """Fotos de la propiedad en el ORDEN definido por el usuario (position)."""
    images = sorted(prop.get("property_images") or [], key=lambda i: i.get("position", 0))
    entries: list[ExportEntry] = []
    for idx, img in enumerate(images, start=1):
        original = img.get("original_name") or img.get("stored_name") or f"foto-{idx}.jpg"
        entries.append(
            ExportEntry(
                arcname=sequential_photo_name(idx, original),
                bucket=img["bucket"],
                object_path=img["object_path"],
            )
        )
    return entries


def zip_filename(prop: dict, kind: str) -> str:
    """`VAR-000123-fotos.zip` — estable y legible."""
    return f"{_property_code(prop['id'])}-{kind}.zip"


def _dedupe(name: str, used: set[str]) -> str:
    if name not in used:
        used.add(name)
        return name
    stem, ext = Path(name).stem, Path(name).suffix
    i = 2
    while f"{stem} ({i}){ext}" in used:
        i += 1
    unique = f"{stem} ({i}){ext}"
    used.add(unique)
    return unique


async def build_zip(entries: list[ExportEntry]) -> bytes:
    """Arma el ZIP descargando cada objeto ORIGINAL desde Storage."""
    storage = get_storage()
    buf = io.BytesIO()
    used: set[str] = set()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for entry in entries:
            data = await storage.download(entry.bucket, entry.object_path)
            zf.writestr(_dedupe(entry.arcname, used), data)
    return buf.getvalue()
