"""Endpoints de Tasación (`/api/tasacion`): cálculo, config y JPG para WhatsApp."""
from __future__ import annotations

import base64
import io
import os
from datetime import datetime

from fastapi import APIRouter
from pydantic import BaseModel
from PIL import Image, ImageDraw, ImageFont

import tasacion

router = APIRouter(prefix="/tasacion", tags=["tasacion"])

# Fuentes incluidas en el repo → viajan al deploy (el contenedor de producción no
# garantiza tener Liberation en /usr/share, lo que rompía acentos/²/– en el JPG).
_FONT_DIR = os.path.join(os.path.dirname(__file__), "assets", "fonts")
_FONT = os.path.join(_FONT_DIR, "LiberationSans-Regular.ttf")
_FONT_B = os.path.join(_FONT_DIR, "LiberationSans-Bold.ttf")
# Logo de Varela (opcional): si el usuario sube su PNG a esta ruta, se usa en el
# encabezado; si no existe, cae al wordmark tipográfico "VARELA PROPIEDADES".
_LOGO = os.path.join(os.path.dirname(__file__), "assets", "brand", "varela-logo.png")

# Paleta clara/crema · acento amarillo Varela (ficha de tasación premium).
CREAM = (250, 248, 242)
INK = (30, 30, 32)
INK_SOFT = (122, 118, 110)
GOLD = (240, 201, 42)       # amarillo de marca (barras/bordes)
GOLD_DEEP = (166, 128, 12)  # dorado legible para texto sobre crema
HAIR = (223, 220, 210)      # divisores finos
CARD = (255, 255, 255)
CARD_REF = (243, 241, 234)


class CalcularBody(BaseModel):
    tipo: str
    zona: str
    cubiertos: float | None = None
    lote: float | None = None
    calidad: str | None = None
    estado: str | None = None
    antiguedad: str | None = None
    ambientes: str | None = None
    vista: str | None = None
    antDepto: str | None = None
    gas: bool = False
    cloacas: bool = False
    pileta: bool = False
    quincho: bool = False
    deck: bool = False
    estacCub: bool = False
    estacDesc: bool = False
    galeria: bool = False


class JpgBody(CalcularBody):
    semicubiertos: float | None = None
    dormitorios: float | None = None
    banos: float | None = None
    propietario: str | None = None
    direccion: str | None = None
    asesor: str | None = None


class ConfigBody(BaseModel):
    values: dict[str, float]


@router.get("/config")
async def get_config():
    return {"values": await tasacion.get_config()}


@router.put("/config")
async def put_config(body: ConfigBody):
    return {"values": await tasacion.set_config(body.values)}


@router.post("/calcular")
async def calcular(body: CalcularBody):
    cfg = await tasacion.get_config()
    return tasacion.tasar(body.model_dump(), cfg)


def _usd(n: float) -> str:
    return "USD " + f"{n:,.0f}".replace(",", ".")


def _font(size: int, bold: bool = False):
    try:
        return ImageFont.truetype(_FONT_B if bold else _FONT, size)
    except Exception:
        return ImageFont.load_default()


def _center(draw, y, text, font, fill):
    w = draw.textlength(text, font=font)
    draw.text(((1080 - w) / 2, y), text, font=font, fill=fill)


@router.post("/jpg")
async def jpg(body: JpgBody):
    cfg = await tasacion.get_config()
    r = tasacion.tasar(body.model_dump(), cfg)

    img = Image.new("RGB", (1080, 1350), CREAM)
    d = ImageDraw.Draw(img)

    # --- Encabezado: logo de Varela si existe, si no wordmark tipográfico ---
    if os.path.exists(_LOGO):
        try:
            logo = Image.open(_LOGO).convert("RGBA")
            target_w = 400
            ratio = target_w / logo.width
            logo = logo.resize((target_w, int(logo.height * ratio)))
            img.paste(logo, ((1080 - target_w) // 2, 74), logo)
            y = 74 + logo.height + 14
        except Exception:
            _center(d, 96, "VARELA PROPIEDADES", _font(50, True), INK)
            d.rounded_rectangle([(490, 158), (590, 164)], radius=3, fill=GOLD)
            y = 190
    else:
        _center(d, 96, "VARELA PROPIEDADES", _font(50, True), INK)
        d.rounded_rectangle([(490, 158), (590, 164)], radius=3, fill=GOLD)
        y = 190

    _center(d, y, "COSTA DEL ESTE · MAR DEL TUYÚ", _font(22), INK_SOFT)
    d.line([(150, y + 52), (930, y + 52)], fill=HAIR, width=2)

    # --- Tasación + fecha (cursor que fluye hacia abajo) ---
    cur = y + 90
    _center(d, cur, "TASACIÓN", _font(22), INK_SOFT); cur += 34
    _center(d, cur, datetime.now().strftime("%d/%m/%Y"), _font(30, True), INK); cur += 70

    # --- Inmueble ---
    if body.direccion:
        _center(d, cur, body.direccion, _font(34, True), INK); cur += 50
    _center(d, cur, r["tipoNombre"].upper(), _font(23, True), GOLD_DEEP); cur += 42

    def _i(val) -> int:
        try:
            return int(float(val))
        except (TypeError, ValueError):
            return 0

    cub, semi, lote = _i(body.cubiertos), _i(body.semicubiertos), _i(body.lote)
    dorm, ban = _i(body.dormitorios), _i(body.banos)
    lineas: list[str] = []
    sup = []
    if body.tipo != "lote" and cub:
        sup.append(f"{cub} m² cubiertos")
    if semi:
        sup.append(f"{semi} m² semicubiertos")
    if sup:
        lineas.append(" · ".join(sup))
    if body.tipo != "depto" and lote:
        lineas.append(f"{lote} m² de terreno")
    amb = []
    if dorm:
        amb.append(f"{dorm} dormitorio" + ("s" if dorm != 1 else ""))
    if ban:
        amb.append(f"{ban} baño" + ("s" if ban != 1 else ""))
    if amb:
        lineas.append(" · ".join(amb))
    for ln in lineas:
        _center(d, cur, ln, _font(24), INK_SOFT); cur += 34

    # --- Precio Varela (protagonista) · posición dinámica bajo los datos ---
    box_y = max(580, cur + 24)
    d.rounded_rectangle([(120, box_y), (960, box_y + 210)], radius=24, fill=CARD, outline=GOLD, width=3)
    _center(d, box_y + 34, "VALOR RECOMENDADO VARELA", _font(24, True), GOLD_DEEP)
    _center(d, box_y + 96, f"{_usd(r['cierreMin'])} – {_usd(r['cierreMax'])}", _font(52, True), INK)

    # --- Promedio portales (referencia) ---
    box2 = box_y + 250
    d.rounded_rectangle([(120, box2), (960, box2 + 160)], radius=24, fill=CARD_REF, outline=HAIR, width=2)
    _center(d, box2 + 32, "PROMEDIO DE PORTALES · REFERENCIA", _font(22, True), INK_SOFT)
    _center(d, box2 + 84, f"{_usd(r['pubMin'])} – {_usd(r['pubMax'])}", _font(38, True), INK_SOFT)

    # --- Nota + footer (fluyen bajo la referencia) ---
    nf = box2 + 208
    _center(d, nf, "Valores orientativos sujetos a verificación in situ.", _font(18), INK_SOFT)
    d.line([(150, nf + 44), (930, nf + 44)], fill=HAIR, width=2)
    if body.propietario:
        _center(d, nf + 76, f"Preparada para {body.propietario}", _font(24, True), INK)
    _center(d, nf + 120, body.asesor or "Varela Propiedades", _font(22), INK_SOFT)

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=92)
    b64 = base64.b64encode(buf.getvalue()).decode()
    return {"image": f"data:image/jpeg;base64,{b64}", "result": r}
