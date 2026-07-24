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
BG = (14, 14, 16)
GOLD = (242, 226, 60)
WHITE = (245, 241, 230)
GREY = (150, 150, 156)
LINE = (42, 43, 48)


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

    img = Image.new("RGB", (1080, 1350), BG)
    d = ImageDraw.Draw(img)

    # Marca
    _center(d, 90, "VARELA PROPIEDADES", _font(52, True), GOLD)
    _center(d, 158, "COSTA DEL ESTE · MAR DEL TUYÚ", _font(24), GREY)
    d.line([(140, 230), (940, 230)], fill=LINE, width=2)

    _center(d, 268, "TASACIÓN", _font(26), GREY)
    _center(d, 306, datetime.now().strftime("%d/%m/%Y"), _font(30, True), WHITE)

    # Inmueble
    y = 380
    if body.direccion:
        _center(d, y, body.direccion, _font(34, True), WHITE); y += 48
    _center(d, y, f"{r['tipoNombre']} · {r['zonaNombre']}", _font(26), GREY); y += 40
    metros = body.cubiertos if body.tipo == "depto" else (body.lote or body.cubiertos)
    if metros:
        _center(d, y, f"{int(metros)} m²", _font(24), GREY)

    # Precio Varela (protagonista)
    box_y = 560
    d.rounded_rectangle([(120, box_y), (960, box_y + 250)], radius=24, fill=(24, 24, 28), outline=GOLD, width=2)
    _center(d, box_y + 36, "PRECIO VARELA · VALOR RECOMENDADO", _font(24, True), GOLD)
    _center(d, box_y + 96, f"{_usd(r['cierreMin'])} – {_usd(r['cierreMax'])}", _font(50, True), WHITE)
    _center(d, box_y + 180, f"Coeficiente de cierre: {int(r['coef'] * 100)}%", _font(22), GREY)

    # Promedio portales (referencia)
    box2 = box_y + 300
    d.rounded_rectangle([(120, box2), (960, box2 + 190)], radius=24, fill=(20, 20, 24), outline=LINE, width=2)
    _center(d, box2 + 34, "PROMEDIO DE PORTALES · REFERENCIA", _font(22, True), GREY)
    _center(d, box2 + 86, f"{_usd(r['pubMin'])} – {_usd(r['pubMax'])}", _font(38, True), GREY)

    # Footer
    d.line([(140, 1180), (940, 1180)], fill=LINE, width=2)
    if body.propietario:
        _center(d, 1210, f"Preparada para {body.propietario}", _font(24), WHITE)
    _center(d, 1255, body.asesor or "Varela Propiedades", _font(22), GREY)

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=92)
    b64 = base64.b64encode(buf.getvalue()).decode()
    return {"image": f"data:image/jpeg;base64,{b64}", "result": r}
