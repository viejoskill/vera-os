"""Genera copias livianas WebP de una foto de propiedad para la web pública.
Pillow puro, en memoria — nunca se sube ni se reemplaza el archivo original (VERA
Studio, Mercado Libre y los portales siguen usando el original en alta)."""
import io
import logging

from PIL import Image, ImageOps

logger = logging.getLogger("vera")

# Anchos de las variantes públicas y su calidad WebP. No se agranda una foto más
# chica que el ancho pedido (esa variante se omite).
VARIANT_WIDTHS = [480, 960, 1600]
WEBP_QUALITY = 75


def generate_webp_variants(content: bytes) -> dict[int, bytes]:
    """Devuelve {ancho: bytes_webp} para cada ancho <= ancho original. Respeta la
    orientación EXIF (exif_transpose) y no copia metadatos (save sin exif=)."""
    try:
        im = Image.open(io.BytesIO(content))
        im.load()
        im = ImageOps.exif_transpose(im)
    except Exception:  # noqa: BLE001
        logger.warning("No se pudo abrir la imagen para generar variantes públicas (se omite).")
        return {}

    if im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info):
        im = im.convert("RGBA")
    else:
        im = im.convert("RGB")

    orig_w, orig_h = im.size
    out: dict[int, bytes] = {}
    for width in VARIANT_WIDTHS:
        if width >= orig_w:
            continue
        height = max(1, round(orig_h * (width / orig_w)))
        resized = im.resize((width, height), Image.LANCZOS)
        buf = io.BytesIO()
        resized.save(buf, format="WEBP", quality=WEBP_QUALITY, method=6)
        out[width] = buf.getvalue()
    return out
