"""Portada con sello VENDIDA/RESERVADA quemado (Pillow), misma estética que la web
+ logo Varela en blanco. Se usa para descargar/compartir y como portada del aviso ML."""
import io
import os

from PIL import Image, ImageDraw, ImageFont

from storage_service import get_storage

_ASSETS = os.path.dirname(__file__)
_FONT_B = os.path.join(_ASSETS, "assets", "fonts", "LiberationSans-Bold.ttf")
_FONT_R = os.path.join(_ASSETS, "assets", "fonts", "LiberationSans-Regular.ttf")
_LOGO = os.path.join(_ASSETS, "assets", "brand", "varela-logo.png")

# Fuentes Oswald (placa Historia) y placa base provista por la marca.
_OSWALD_BOLD = os.path.join(_ASSETS, "assets", "fonts", "Oswald-Bold.ttf")
_OSWALD_SEMIBOLD = os.path.join(_ASSETS, "assets", "fonts", "Oswald-SemiBold.ttf")
_OSWALD_MEDIUM = os.path.join(_ASSETS, "assets", "fonts", "Oswald-Medium.ttf")
_OSWALD_REGULAR = os.path.join(_ASSETS, "assets", "fonts", "Oswald-Regular.ttf")
_OSWALD_LIGHT = os.path.join(_ASSETS, "assets", "fonts", "Oswald-Light.ttf")
_STORY_BASE = os.path.join(_ASSETS, "assets", "brand", "story-base.jpg")
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


def render_stamped_cover(image_bytes: bytes, status: str, with_logo: bool = True) -> bytes:
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
    logo = _white_logo(int(W * 0.24)) if with_logo else None
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


# ---------------------------------------------------------------------------
# Formato HISTORIA (9:16, 1080x1920) para Instagram / WhatsApp / Facebook.
# Usa la placa base de marca (logo VARELA + línea + puntos ya incluidos) y
# tipografía Oswald. La foto va en 16:9 grande, protagonista.
# ---------------------------------------------------------------------------
_STORY_W, _STORY_H = 1080, 1920
_BG = (28, 28, 28)          # fallback si no está la placa
_ACCENT = (246, 230, 58)    # amarillo de marca (#F6E63A)
_LINE_Y = 1589              # línea amarilla de la placa
_PHOTO_TOP = 400            # debajo del logo (logo termina ~y=332)
_PHOTO_MARGIN = 40


def _wrap(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont, max_w: int, max_lines: int = 2) -> list[str]:
    lines, cur = [], ""
    for word in text.split():
        cand = (cur + " " + word).strip()
        if draw.textlength(cand, font=font) <= max_w:
            cur = cand
        else:
            if cur:
                lines.append(cur)
            cur = word
        if len(lines) >= max_lines:
            break
    if cur and len(lines) < max_lines:
        lines.append(cur)
    if len(lines) == max_lines and draw.textlength(lines[-1], font=font) > max_w:
        while lines[-1] and draw.textlength(lines[-1] + "…", font=font) > max_w:
            lines[-1] = lines[-1][:-1]
        lines[-1] += "…"
    return lines


def _cover_fit(img: Image.Image, w: int, h: int) -> Image.Image:
    """Escala + recorte central para llenar exactamente w×h (estilo object-fit: cover)."""
    scale = max(w / img.width, h / img.height)
    nw, nh = max(1, int(img.width * scale)), max(1, int(img.height * scale))
    img = img.resize((nw, nh), Image.LANCZOS)
    left, top = (nw - w) // 2, (nh - h) // 2
    return img.crop((left, top, left + w, top + h))


def render_story(image_bytes: bytes, status: str, *, title: str = "", price: str = "", address: str = "") -> bytes:
    """Placa vertical 9:16 lista para historias sobre la placa de marca:
    foto 16:9 grande (con sello), precio, título y dirección en Oswald."""
    if os.path.exists(_STORY_BASE):
        canvas = Image.open(_STORY_BASE).convert("RGB").resize((_STORY_W, _STORY_H), Image.LANCZOS)
    else:
        canvas = Image.new("RGB", (_STORY_W, _STORY_H), _BG)
    draw = ImageDraw.Draw(canvas)

    # Foto 16:9 grande (con sello VENDIDA/RESERVADA quemado, sin logo).
    stamped = render_stamped_cover(image_bytes, status, with_logo=False)
    photo = Image.open(io.BytesIO(stamped)).convert("RGB")
    card_w = _STORY_W - _PHOTO_MARGIN * 2
    card_h = round(card_w * 9 / 16)
    photo = _cover_fit(photo, card_w, card_h)
    mask = Image.new("L", (card_w, card_h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, card_w, card_h], radius=28, fill=255)
    canvas.paste(photo, (_PHOTO_MARGIN, _PHOTO_TOP), mask)

    # Panel de información en Oswald, debajo de la foto.
    x = 60
    y = _PHOTO_TOP + card_h + 60
    if price:
        f_price = ImageFont.truetype(_OSWALD_BOLD, 128)
        draw.text((x, y), f"USD {price}", font=f_price, fill=_ACCENT)
        y += 168
    if title:
        f_title = ImageFont.truetype(_OSWALD_MEDIUM, 58)
        for line in _wrap(draw, title.upper(), f_title, _STORY_W - 120, max_lines=2):
            draw.text((x, y), line, font=f_title, fill=(255, 255, 255))
            y += 70
        y += 10
    if address:
        f_addr = ImageFont.truetype(_OSWALD_LIGHT, 48)
        for line in _wrap(draw, address, f_addr, _STORY_W - 120, max_lines=1):
            draw.text((x, y), line, font=f_addr, fill=(185, 185, 185))
            y += 58

    # Pie de marca, debajo de la línea amarilla de la placa.
    f_foot = ImageFont.truetype(_OSWALD_REGULAR, 36)
    foot = "varelapropiedadescde.com.ar"
    fw = draw.textlength(foot, font=f_foot)
    draw.text(((_STORY_W - fw) / 2, _LINE_Y + 28), foot, font=f_foot, fill=(170, 170, 170))

    out = io.BytesIO()
    canvas.save(out, "JPEG", quality=90)
    return out.getvalue()


async def get_story_bytes(prop: dict, status: str) -> bytes | None:
    cover = cover_row(prop)
    if not cover:
        return None
    raw = await get_storage().download(cover["bucket"], cover["object_path"])
    price = prop.get("price")
    try:
        price_str = f"{int(float(price)):,}".replace(",", ".") if price else ""
    except (ValueError, TypeError):
        price_str = str(price or "")
    address = " · ".join([p for p in [prop.get("address"), prop.get("city")] if p])
    return render_story(raw, status, title=prop.get("title") or "", price=price_str, address=address)
