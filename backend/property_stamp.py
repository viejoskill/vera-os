"""Portada con sello VENDIDA/RESERVADA quemado (Pillow), misma estética que la web
+ logo Varela en blanco. Se usa para descargar/compartir y como portada del aviso ML."""
import io
import os

from PIL import Image, ImageDraw, ImageFont

from storage_service import get_storage

_FONT_B = os.path.join(os.path.dirname(__file__), "assets", "fonts", "LiberationSans-Bold.ttf")
_LOGO = os.path.join(os.path.dirname(__file__), "assets", "brand", "varela-logo.png")
_STAMP_TTL = 10 * 365 * 24 * 3600  # URL que no caduca (para ML)

_STAMP = {
    "sold": {"label": "VENDIDA", "color": (251, 224, 0)},        # amarillo (como la web)
    "reserved": {"label": "RESERVADA", "color": (239, 68, 68)},  # rojo
}


def _white_logo(target_w: int) -> Image.Image | None:
    """Logo Varela en blanco (silueta) para superponer sobre la foto."""
    if not os.path.exists(_LOGO):
        return None
    try:
        logo = Image.open(_LOGO).convert("RGBA")
        alpha = logo.getchannel("A")
        white = Image.new("RGBA", logo.size, (255, 255, 255, 0))
        white.putalpha(alpha)  # RGB=255 con el alpha original → blanco
        ratio = target_w / white.width
        return white.resize((target_w, int(white.height * ratio)), Image.LANCZOS)
    except Exception:  # noqa: BLE001
        return None


def render_stamped_cover(image_bytes: bytes, status: str) -> bytes:
    """Devuelve la portada (JPEG) con el sello diagonal + logo Varela quemados."""
    base = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    W, H = base.size
    cfg = _STAMP.get(status)
    if cfg is None:
        out = io.BytesIO()
        base.save(out, "JPEG", quality=88)
        return out.getvalue()

    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    color = cfg["color"]
    label = cfg["label"]

    fs = max(30, int(W * 0.10))
    font = ImageFont.truetype(_FONT_B, fs)
    tmp = ImageDraw.Draw(overlay)
    bbox = tmp.textbbox((0, 0), label, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    pad_x, pad_y = int(fs * 0.55), int(fs * 0.32)
    bw, bh = tw + pad_x * 2, th + pad_y * 2

    stamp = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
    sd = ImageDraw.Draw(stamp)
    border = max(4, int(fs * 0.12))
    sd.rounded_rectangle([0, 0, bw - 1, bh - 1], radius=int(fs * 0.22),
                         fill=(0, 0, 0, 90), outline=color + (255,), width=border)
    sd.text((pad_x - bbox[0], pad_y - bbox[1]), label, font=font, fill=color + (255,))
    stamp = stamp.rotate(11, expand=True, resample=Image.BICUBIC)
    overlay.alpha_composite(stamp, ((W - stamp.width) // 2, (H - stamp.height) // 2))

    # Logo Varela (blanco) arriba a la izquierda, con sombra sutil para legibilidad.
    logo = _white_logo(int(W * 0.24))
    if logo is not None:
        margin = int(W * 0.035)
        shadow = Image.new("RGBA", logo.size, (0, 0, 0, 0))
        shadow.putalpha(logo.getchannel("A").point(lambda a: int(a * 0.45)))
        overlay.alpha_composite(shadow, (margin + 2, margin + 2))
        overlay.alpha_composite(logo, (margin, margin))

    result = Image.alpha_composite(base.convert("RGBA"), overlay).convert("RGB")
    out = io.BytesIO()
    result.save(out, "JPEG", quality=88)
    return out.getvalue()


def cover_row(prop: dict) -> dict | None:
    imgs = prop.get("property_images") or []
    if not imgs:
        return None
    cover = next((i for i in imgs if i.get("is_cover")), None)
    return cover or sorted(imgs, key=lambda x: x.get("position", 0))[0]


async def get_stamped_cover_bytes(prop: dict, status: str) -> bytes | None:
    """Descarga la portada original y devuelve la versión con sello (o None si no hay foto)."""
    cover = cover_row(prop)
    if not cover:
        return None
    raw = await get_storage().download(cover["bucket"], cover["object_path"])
    return render_stamped_cover(raw, status)


async def stamped_cover_url(prop: dict, status: str) -> str | None:
    """Genera la portada con sello, la sube al storage (path determinístico) y devuelve
    una URL firmada de larga duración (apta para usar como foto en Mercado Libre)."""
    cover = cover_row(prop)
    if not cover:
        return None
    data = await get_stamped_cover_bytes(prop, status)
    if not data:
        return None
    bucket = cover["bucket"]
    path = f"stamped/{prop['id']}-{status}.jpg"
    await get_storage().upload(bucket, path, data, "image/jpeg", upsert=True)
    return await get_storage().signed_url(bucket, path, _STAMP_TTL)
