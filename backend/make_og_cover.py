"""Genera la portada OpenGraph (1200x630) para varelapropiedadescde.com.ar
con el logo VARELA original (escudo/óvalo) en amarillo de marca."""
import os

from PIL import Image, ImageDraw, ImageFont

_ASSETS = os.path.dirname(__file__)
_LOGO = os.path.join(_ASSETS, "assets", "brand", "varela-logo.png")
_FONT_B = os.path.join(_ASSETS, "assets", "fonts", "Oswald-Bold.ttf")
_FONT_M = os.path.join(_ASSETS, "assets", "fonts", "Oswald-Medium.ttf")

_ACCENT = (246, 230, 58)  # amarillo de marca #F6E63A
_W, _H = 1200, 630
_BG_SRC = "/tmp/og_bg.jpg"
_OUT = os.path.join(_ASSETS, "..", "frontend", "public", "og-cover.jpg")


def _cover_fit(img, w, h):
    scale = max(w / img.width, h / img.height)
    nw, nh = int(img.width * scale), int(img.height * scale)
    img = img.resize((nw, nh), Image.LANCZOS)
    left, top = (nw - w) // 2, (nh - h) // 2
    return img.crop((left, top, left + w, top + h))


def _yellow_logo(target_w):
    logo = Image.open(_LOGO).convert("RGBA")
    alpha = logo.getchannel("A")
    yellow = Image.new("RGBA", logo.size, _ACCENT + (0,))
    yellow.putalpha(alpha)
    ratio = target_w / yellow.width
    return yellow.resize((target_w, int(yellow.height * ratio)), Image.LANCZOS)


def main():
    base = _cover_fit(Image.open(_BG_SRC).convert("RGB"), _W, _H).convert("RGBA")
    overlay = Image.new("RGBA", (_W, _H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    # Degradado oscuro abajo-izquierda para legibilidad del logo.
    grad = Image.new("L", (1, _H), 0)
    for y in range(_H):
        t = y / _H
        grad.putpixel((0, y), int(200 * max(0, (t - 0.35) / 0.65) ** 1.4))
    grad = grad.resize((_W, _H))
    shade = Image.new("RGBA", (_W, _H), (10, 12, 14, 0))
    shade.putalpha(grad)
    overlay = Image.alpha_composite(overlay, shade)
    draw = ImageDraw.Draw(overlay)

    # Logo VARELA amarillo (original), abajo a la izquierda.
    margin = 70
    logo = _yellow_logo(int(_W * 0.30))
    logo_y = _H - margin - logo.height - 44
    # sombra sutil
    shadow = Image.new("RGBA", logo.size, (0, 0, 0, 0))
    shadow.putalpha(logo.getchannel("A").point(lambda a: int(a * 0.5)))
    overlay.alpha_composite(shadow, (margin + 3, logo_y + 3))
    overlay.alpha_composite(logo, (margin, logo_y))

    # Tagline debajo del logo.
    f_tag = ImageFont.truetype(_FONT_M, 40)
    tag = "COSTA DEL ESTE · MAR DEL TUYÚ"
    draw.text((margin + 2, logo_y + logo.height + 12), tag, font=f_tag, fill=(255, 255, 255, 235))

    # URL arriba a la derecha (con sombra para legibilidad sobre el cielo).
    f_url = ImageFont.truetype(_FONT_B, 34)
    url = "varelapropiedadescde.com.ar"
    uw = draw.textlength(url, font=f_url)
    ux, uy = _W - uw - margin, 44
    draw.text((ux + 2, uy + 2), url, font=f_url, fill=(0, 0, 0, 160))
    draw.text((ux, uy), url, font=f_url, fill=_ACCENT + (255,))

    result = Image.alpha_composite(base, overlay).convert("RGB")
    result.save(os.path.abspath(_OUT), "JPEG", quality=90)
    print("saved:", os.path.abspath(_OUT), result.size)


if __name__ == "__main__":
    main()
