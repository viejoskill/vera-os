"""Endpoints de Tasación (`/api/tasacion`): cálculo, config y JPG para WhatsApp."""
from __future__ import annotations

import base64
import io
import os
import random
import uuid
from datetime import datetime, timezone

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
    cercaniaMar: bool = False


class JpgBody(CalcularBody):
    semicubiertos: float | None = None
    dormitorios: float | None = None
    banos: float | None = None
    propietario: str | None = None
    direccion: str | None = None
    telefono: str | None = None
    email: str | None = None
    asesor: str | None = None


class ConfigBody(BaseModel):
    values: dict[str, float]


@router.get("/config")
async def get_config():
    return {"values": await tasacion.get_config()}


@router.put("/config")
async def put_config(body: ConfigBody):
    return {"values": await tasacion.set_config(body.values)}


@router.get("/online-leads")
async def online_leads(limit: int = 200):
    """Bandeja de tasaciones recibidas desde el tasador online público."""
    from events.store import list_events
    from people.repository import people_repository
    evs = await list_events(event_type="TasacionSolicitada", limit=limit)
    out = []
    for e in evs:
        pid = e.get("personId")
        p = await people_repository.get(pid) if pid else None
        p = p or {}
        pl = e.get("payload") or {}
        out.append({
            "id": e.get("id"),
            "personId": pid,
            "nombre": p.get("full_name") or "Sin nombre",
            "telefono": p.get("primary_phone") or p.get("phone") or "",
            "email": p.get("primary_email") or p.get("email") or "",
            "tipo": pl.get("tipo"),
            "zona": pl.get("zona"),
            "estMin": pl.get("estMin"),
            "estMax": pl.get("estMax"),
            "area": pl.get("area"),
            "fecha": e.get("occurredAt") or e.get("createdAt"),
        })
    return {"leads": out}


@router.get("/manuales")
async def manuales(limit: int = 100):
    items = await tasacion.list_manuales(limit)
    for it in items:
        it["id"] = it.pop("_id")
    return {"items": items}


@router.delete("/manuales/{manual_id}")
async def eliminar_manual(manual_id: str):
    await tasacion.delete_manual(manual_id)
    return {"ok": True}


async def _persist_manual(body: "JpgBody", r: dict) -> None:
    """Guarda toda tasación manual con datos de propietario/dirección, para no
    perderla si el usuario solo genera el JPG sin tocar 'Guardar lead'."""
    if not (body.propietario or body.direccion):
        return
    await tasacion.save_manual({
        "_id": str(uuid.uuid4()),
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "propietario": body.propietario, "direccion": body.direccion,
        "telefono": body.telefono, "email": body.email,
        "tipo": body.tipo, "zona": body.zona,
        "zonaNombre": r["zonaNombre"], "tipoNombre": r["tipoNombre"],
        "lote": body.lote, "cubiertos": body.cubiertos,
        "dormitorios": getattr(body, "dormitorios", None), "banos": getattr(body, "banos", None),
        "cierreMin": r["cierreMin"], "cierreMax": r["cierreMax"],
        "asesor": getattr(body, "asesor", None),
    })


@router.post("/calcular")
async def calcular(body: JpgBody):
    cfg = await tasacion.get_config()
    r = tasacion.tasar(body.model_dump(), cfg)
    await _persist_manual(body, r)
    return r


def _usd(n: float) -> str:
    return "USD " + f"{n:,.0f}".replace(",", ".")


def _font(size: int, bold: bool = False):
    try:
        return ImageFont.truetype(_FONT_B if bold else _FONT, size)
    except Exception:
        return ImageFont.load_default()


def _left(d, x, y, text, font, fill):
    d.text((x, y), text, font=font, fill=fill)


def _right(d, x, y, text, font, fill):
    w = d.textlength(text, font=font)
    d.text((x - w, y), text, font=font, fill=fill)


def _cin(d, x0, x1, y, text, font, fill):
    w = d.textlength(text, font=font)
    d.text((x0 + (x1 - x0 - w) / 2, y), text, font=font, fill=fill)


def _fit(d, text, max_w, start, bold=True):
    size = start
    while size > 20 and d.textlength(text, font=_font(size, bold)) > max_w:
        size -= 2
    return _font(size, bold)


def _wrap(d, text, font, max_w):
    words, lines, cur = text.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if d.textlength(t, font=font) <= max_w:
            cur = t
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


# ---------------- Iconografía (line-art dibujado con PIL) ----------------
def _ic_pin(d, x, y, s, c, w=4):
    d.ellipse([(x, y), (x + s, y + s * 0.82)], outline=c, width=w)
    d.polygon([(x + s * 0.30, y + s * 0.62), (x + s * 0.70, y + s * 0.62), (x + s * 0.5, y + s * 1.02)], fill=c)
    d.ellipse([(x + s * 0.36, y + s * 0.26), (x + s * 0.64, y + s * 0.54)], fill=c)


def _ic_cal(d, x, y, s, c, w=4):
    d.rounded_rectangle([(x, y + s * 0.16), (x + s, y + s)], radius=s * 0.14, outline=c, width=w)
    d.line([(x, y + s * 0.40), (x + s, y + s * 0.40)], fill=c, width=w)
    d.line([(x + s * 0.26, y), (x + s * 0.26, y + s * 0.24)], fill=c, width=w)
    d.line([(x + s * 0.74, y), (x + s * 0.74, y + s * 0.24)], fill=c, width=w)


def _ic_home(d, x, y, s, c, w=5):
    d.line([(x, y + s * 0.46), (x + s * 0.5, y), (x + s, y + s * 0.46)], fill=c, width=w, joint="curve")
    d.line([(x + s * 0.14, y + s * 0.42), (x + s * 0.14, y + s)], fill=c, width=w)
    d.line([(x + s * 0.86, y + s * 0.42), (x + s * 0.86, y + s)], fill=c, width=w)
    d.line([(x + s * 0.14, y + s), (x + s * 0.86, y + s)], fill=c, width=w)
    d.rectangle([(x + s * 0.40, y + s * 0.66), (x + s * 0.60, y + s)], outline=c, width=max(2, w - 2))


def _ic_ware(d, x, y, s, c, w=5):
    d.line([(x, y + s * 0.42), (x + s * 0.5, y + s * 0.12), (x + s, y + s * 0.42)], fill=c, width=w, joint="curve")
    d.line([(x + s * 0.08, y + s * 0.42), (x + s * 0.08, y + s)], fill=c, width=w)
    d.line([(x + s * 0.92, y + s * 0.42), (x + s * 0.92, y + s)], fill=c, width=w)
    d.line([(x + s * 0.08, y + s), (x + s * 0.92, y + s)], fill=c, width=w)
    d.line([(x + s * 0.30, y + s * 0.64), (x + s * 0.70, y + s * 0.64)], fill=c, width=max(2, w - 2))


def _ic_land(d, x, y, s, c, w=5):
    seg = s * 0.30
    for cx, cy, dx, dy in [(x, y, 1, 1), (x + s, y, -1, 1), (x, y + s, 1, -1), (x + s, y + s, -1, -1)]:
        d.line([(cx, cy), (cx + dx * seg, cy)], fill=c, width=w)
        d.line([(cx, cy), (cx, cy + dy * seg)], fill=c, width=w)
    d.ellipse([(x + s * 0.42, y + s * 0.42), (x + s * 0.58, y + s * 0.58)], fill=c)


def _ic_bed(d, x, y, s, c, w=5):
    d.line([(x, y + s * 0.30), (x, y + s * 0.86)], fill=c, width=w)
    d.line([(x, y + s * 0.56), (x + s, y + s * 0.56)], fill=c, width=w)
    d.line([(x + s, y + s * 0.56), (x + s, y + s * 0.86)], fill=c, width=w)
    d.line([(x, y + s * 0.86), (x + s, y + s * 0.86)], fill=c, width=w)
    d.arc([(x + s * 0.10, y + s * 0.36), (x + s * 0.52, y + s * 0.58)], 180, 360, fill=c, width=max(2, w - 2))


def _ic_bath(d, x, y, s, c, w=5):
    d.line([(x + s * 0.22, y + s * 0.12), (x + s * 0.22, y + s * 0.34)], fill=c, width=w)
    d.arc([(x + s * 0.22, y + s * 0.12), (x + s * 0.50, y + s * 0.40)], 180, 270, fill=c, width=w)
    d.line([(x, y + s * 0.52), (x + s, y + s * 0.52)], fill=c, width=w)
    d.arc([(x + s * 0.04, y + s * 0.52), (x + s * 0.96, y + s * 0.94)], 0, 180, fill=c, width=w)
    d.line([(x + s * 0.22, y + s * 0.84), (x + s * 0.22, y + s * 0.96)], fill=c, width=max(2, w - 2))
    d.line([(x + s * 0.78, y + s * 0.84), (x + s * 0.78, y + s * 0.96)], fill=c, width=max(2, w - 2))


def _ic_bars(d, x, y, s, c, w=5):
    base = y + s
    d.line([(x + s * 0.20, base), (x + s * 0.20, y + s * 0.55)], fill=c, width=w)
    d.line([(x + s * 0.50, base), (x + s * 0.50, y + s * 0.22)], fill=c, width=w)
    d.line([(x + s * 0.80, base), (x + s * 0.80, y + s * 0.42)], fill=c, width=w)


def _ic_shield(d, x, y, s, c, w=5):
    pts = [(x + s * 0.5, y), (x + s, y + s * 0.22), (x + s, y + s * 0.55),
           (x + s * 0.5, y + s), (x, y + s * 0.55), (x, y + s * 0.22)]
    d.line(pts + [pts[0]], fill=c, width=w, joint="curve")
    d.line([(x + s * 0.32, y + s * 0.46), (x + s * 0.45, y + s * 0.60), (x + s * 0.70, y + s * 0.30)],
           fill=c, width=w, joint="curve")


def _ic_spark(d, x, y, s, c):
    cx, cy = x + s / 2, y + s / 2
    d.polygon([(cx, y), (cx + s * 0.13, cy - s * 0.13), (x + s, cy), (cx + s * 0.13, cy + s * 0.13),
               (cx, y + s), (cx - s * 0.13, cy + s * 0.13), (x, cy), (cx - s * 0.13, cy - s * 0.13)], fill=c)


@router.post("/jpg")
async def jpg(body: JpgBody):
    cfg = await tasacion.get_config()
    r = tasacion.tasar(body.model_dump(), cfg)
    await _persist_manual(body, r)

    W, H, MX = 1080, 1620, 72
    RX = W - MX
    img = Image.new("RGB", (W, H), CREAM)
    d = ImageDraw.Draw(img)

    def _i(val) -> int:
        try:
            return int(float(val))
        except (TypeError, ValueError):
            return 0

    # ---------------- Encabezado ----------------
    if os.path.exists(_LOGO):
        try:
            logo = Image.open(_LOGO).convert("RGBA")
            th = 96
            tw = int(logo.width * th / logo.height)
            logo = logo.resize((tw, th))
            img.paste(logo, (MX, 66), logo)
        except Exception:
            _left(d, MX, 78, "VARELA", _font(52, True), INK)
    else:
        _left(d, MX, 78, "VARELA", _font(52, True), INK)

    _right(d, RX, 70, "REPORTE DE TASACIÓN", _font(22, True), INK_SOFT)
    _right(d, RX, 108, "ID REPORTE", _font(15), INK_SOFT)
    rid = f"VR-{datetime.now():%Y-%m%d}-{random.randint(1000, 9999)}"
    _right(d, RX, 128, rid, _font(24, True), INK)
    flabel = "FECHA"
    _right(d, RX, 172, flabel, _font(15), INK_SOFT)
    _ic_cal(d, RX - d.textlength(flabel, font=_font(15)) - 28, 173, 18, GOLD, 3)
    _right(d, RX, 192, datetime.now().strftime("%d/%m/%Y"), _font(24, True), INK)

    d.line([(MX, 252), (RX, 252)], fill=GOLD, width=3)

    # ---------------- Propiedad + solicitante ----------------
    y = 292
    _left(d, MX, y, "PROPIEDAD", _font(16, True), INK_SOFT)
    d.rounded_rectangle([(MX, y + 26), (MX + 46, y + 31)], radius=3, fill=GOLD)
    y += 44
    direccion = (body.direccion or "Propiedad en Costa del Este").strip()
    afont = _fit(d, direccion, RX - MX, 70, True)
    _left(d, MX, y, direccion, afont, INK)
    y += afont.size + 18

    propietario = (body.propietario or "").strip()
    if propietario:
        _left(d, MX, y, "SOLICITANTE", _font(15, True), INK_SOFT)
        y += 24
        tel = (body.telefono or "").strip()
        sol = propietario + (f"   ·   {tel}" if tel else "")
        _left(d, MX, y, sol, _fit(d, sol, RX - MX, 30, True), INK)
        y += 48

    _ic_pin(d, MX, y + 2, 26, GOLD, 4)
    _left(d, MX + 40, y, "Costa del Este", _font(28), INK_SOFT)
    y += 52

    tipo = r["tipoNombre"].upper()
    bw = d.textlength(tipo, font=_font(22, True)) + 44
    d.rounded_rectangle([(MX, y), (MX + bw, y + 52)], radius=14, fill=CARD_REF)
    _left(d, MX + 22, y + 13, tipo, _font(22, True), GOLD_DEEP)

    # ---------------- Valor de cierre (protagonista) ----------------
    box_y = 620
    d.rounded_rectangle([(MX, box_y), (RX, box_y + 224)], radius=24, fill=CARD, outline=GOLD, width=3)
    _cin(d, MX, RX, box_y + 34, "VALOR DE CIERRE REAL ESTIMADO", _font(28, True), GOLD_DEEP)
    rango = f"{_usd(r['cierreMin'])} – {_usd(r['cierreMax'])}"
    _cin(d, MX, RX, box_y + 86, rango, _fit(d, rango, RX - MX - 60, 62, True), INK)
    _cin(d, MX, RX, box_y + 174, "RANGO ESTIMADO DE VALOR DE MERCADO", _font(22), INK_SOFT)

    # ---------------- Tarjetas: referencia + confianza ----------------
    cy = box_y + 264
    ch = 196
    gap = 30
    cw = (RX - MX - gap) / 2
    # Referencia de mercado
    lx = MX
    d.rounded_rectangle([(lx, cy), (lx + cw, cy + ch)], radius=18, fill=CARD_REF)
    d.ellipse([(lx + 30, cy + 30), (lx + 86, cy + 86)], fill=(236, 234, 226))
    _ic_bars(d, lx + 44, cy + 44, 28, INK_SOFT, 5)
    _left(d, lx + 104, cy + 34, "REFERENCIA DE MERCADO", _font(22, True), INK)
    _left(d, lx + 104, cy + 66, "Promedio de portales y comparables", _font(17), INK_SOFT)
    ref = f"{_usd(r['pubMin'])} – {_usd(r['pubMax'])}"
    _left(d, lx + 30, cy + 122, ref, _fit(d, ref, cw - 60, 34, True), INK)
    # Confianza IA (valor fijo)
    rx0 = MX + cw + gap
    d.rounded_rectangle([(rx0, cy), (rx0 + cw, cy + ch)], radius=18, fill=(240, 244, 234))
    d.ellipse([(rx0 + 30, cy + 30), (rx0 + 86, cy + 86)], fill=(226, 236, 214))
    _ic_shield(d, rx0 + 44, cy + 42, 28, (120, 150, 70), 5)
    _left(d, rx0 + 104, cy + 34, "CONFIANZA IA", _font(22, True), INK)
    _left(d, rx0 + 104, cy + 66, "Nivel de confianza del análisis", _font(17), INK_SOFT)
    _left(d, rx0 + 30, cy + 118, "94%", _font(44, True), INK)
    pw = d.textlength("ALTA", font=_font(20, True)) + 36
    d.rounded_rectangle([(rx0 + 150, cy + 128), (rx0 + 150 + pw, cy + 172)], radius=22, fill=(214, 233, 194))
    _left(d, rx0 + 168, cy + 138, "ALTA", _font(20, True), (86, 122, 44))

    # ---------------- Especificaciones (íconos) ----------------
    specs = []
    cub, semi, lote = _i(body.cubiertos), _i(body.semicubiertos), _i(body.lote)
    dorm, ban = _i(body.dormitorios), _i(body.banos)
    if body.tipo != "lote" and cub:
        specs.append((_ic_home, f"{cub} m²", "CUBIERTOS", INK))
    if semi:
        specs.append((_ic_ware, f"{semi} m²", "SEMICUBIERTOS", INK))
    if body.tipo != "depto" and lote:
        specs.append((_ic_land, f"{lote} m²", "TERRENO", INK))
    if body.tipo != "lote" and dorm:
        specs.append((_ic_bed, str(dorm), "DORMITORIOS", GOLD_DEEP))
    if body.tipo != "lote" and ban:
        specs.append((_ic_bath, str(ban), "BAÑOS", GOLD_DEEP))

    sy = cy + ch + 46
    if specs:
        d.line([(MX, sy - 24), (RX, sy - 24)], fill=HAIR, width=2)
        n = len(specs)
        colw = (RX - MX) / n
        for i, (fn, val, lab, col) in enumerate(specs):
            cxp = MX + colw * i + colw / 2
            fn(d, cxp - 27, sy, 54, col if col == GOLD_DEEP else INK, 5)
            _cin(d, cxp - 120, cxp + 120, sy + 72, val, _font(34, True), INK)
            _cin(d, cxp - 120, cxp + 120, sy + 116, lab, _font(16), INK_SOFT)
        sy += 156
    else:
        sy += 10

    # ---------------- Nota ----------------
    ntext = ("Esta valuación fue calculada mediante VERA OS utilizando operaciones comparables, "
             "características de la propiedad, comportamiento histórico del mercado y criterios "
             "profesionales de Varela Propiedades.")
    nfont = _font(21)
    nlines = _wrap(d, ntext, nfont, RX - MX - 150)
    nh = 44 + len(nlines) * 30
    d.rounded_rectangle([(MX, sy), (RX, sy + nh)], radius=18, fill=CARD_REF)
    _ic_spark(d, MX + 34, sy + 30, 30, GOLD)
    for i, ln in enumerate(nlines):
        _left(d, MX + 96, sy + 26 + i * 30, ln, nfont, INK_SOFT)

    # ---------------- Pie ----------------
    fy = H - 158
    d.line([(MX, fy), (RX, fy)], fill=HAIR, width=2)
    fy += 26
    _left(d, MX, fy, "POWERED BY", _font(15, True), INK_SOFT)
    _left(d, MX, fy + 22, "Varela Propiedades", _font(34, True), INK)
    _left(d, MX, fy + 72, "Sebastián Varela", _font(23, True), INK)
    _left(d, MX, fy + 104, "Asesor Inmobiliario · hace 20 años en Costa del Este", _font(18), INK_SOFT)

    _right(d, RX, fy, "VERA OS", _font(26, True), INK)
    _right(d, RX, fy + 38, "Real Estate Intelligence", _font(20), INK_SOFT)
    _right(d, RX, fy + 68, "Inteligencia que transforma datos en decisiones", _font(17), INK_SOFT)

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=92)
    b64 = base64.b64encode(buf.getvalue()).decode()
    return {"image": f"data:image/jpeg;base64,{b64}", "result": r}
