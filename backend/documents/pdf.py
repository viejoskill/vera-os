"""Generación de PDF a demanda (reportlab).

El PDF es una REPRESENTACIÓN del documento (que se firma como entidad, no como
archivo). Reusa el contrato de render del motor de firmas: presencial → líneas de
firma manuscrita (o imagen si se dibujó/escaneó); digital → bloque de certificación.
"""
from __future__ import annotations

import base64
import io
import os
import re

from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    HRFlowable, Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
)
from reportlab.lib import colors
from PIL import Image as PILImage

from documents import signatures

_VAR_RE = re.compile(r"\{\{\s*([\w.]+)\s*\}\}")

# Glyphs que Helvetica (reportlab) no puede dibujar → salen como ■. Emojis,
# símbolos, banderas, selectores de variación y ZWJ. Se limpian en el PDF.
_EMOJI_RE = re.compile(
    "[\U0001F000-\U0001FAFF\U00002600-\U000027BF\U0001F1E6-\U0001F1FF"
    "\U00002B00-\U00002BFF\U00002190-\U000021FF\uFE00-\uFE0F\u200D\u20E3]"
)


def _clean(text):
    """Quita emojis/glyphs no soportados por Helvetica. No-strings se devuelven igual."""
    if not isinstance(text, str):
        return text
    return re.sub(r"\s{2,}", " ", _EMOJI_RE.sub("", text)).strip()

# Logo oficial de Varela. Se muestra SIEMPRE en negro puro (los documentos casi
# siempre se imprimen en blanco y negro).
_LOGO_SRC = os.path.join(os.path.dirname(os.path.dirname(__file__)), "assets", "brand", "varela-logo.png")
_black_logo_cache: bytes | None = None


def _black_logo_bytes() -> bytes | None:
    """Logo Varela convertido a negro puro (silueta), cacheado en memoria."""
    global _black_logo_cache
    if _black_logo_cache is None:
        if not os.path.exists(_LOGO_SRC):
            return None
        try:
            im = PILImage.open(_LOGO_SRC).convert("RGBA")
            alpha = im.getchannel("A")
            black = PILImage.new("RGBA", im.size, (0, 0, 0, 0))
            black.putalpha(alpha)  # RGB queda en 0 → negro con el alpha original
            buf = io.BytesIO()
            black.save(buf, format="PNG")
            _black_logo_cache = buf.getvalue()
        except Exception:  # noqa: BLE001
            return None
    return _black_logo_cache
_MONEDAS = {
    "USD": "dólares estadounidenses USD",
    "ARS": "pesos argentinos ARS",
}
# Variables monetarias: se muestran con separador de miles.
_MONEY_KEYS = {"precio", "precio_minimo"}


def _fmt_miles(value) -> str:
    """129000 → 129.000 (formato argentino: punto como separador de miles)."""
    s = str(value).strip()
    if re.fullmatch(r"\d+", s):
        return f"{int(s):,}".replace(",", ".")
    if re.fullmatch(r"\d+\.\d+", s):
        entero, dec = s.split(".")
        return f"{int(entero):,}".replace(",", ".") + "," + dec
    return s


def _display_vars(resolved: dict, variables: list | None = None) -> dict:
    """Valores listos para mostrar: moneda con nombre completo + miles.

    Toda variable declarada como `money` en el template se muestra con separador
    de miles (formato argentino), además de las claves legacy en `_MONEY_KEYS`.
    """
    money_keys = set(_MONEY_KEYS)
    for v in (variables or []):
        if v.get("type") == "money" and v.get("key"):
            money_keys.add(v["key"])
    out = {}
    for k, v in (resolved or {}).items():
        if k == "moneda":
            out[k] = _MONEDAS.get(str(v), str(v))
        elif k in money_keys:
            out[k] = _fmt_miles(v)
        else:
            out[k] = v
    return out


def _interpolate(text: str, vars: dict) -> str:
    """Interpola {{var}} en <b>negrita</b> (los datos importantes resaltan)."""
    def repl(m):
        v = _clean(vars.get(m.group(1)))
        return "" if v in (None, "") else f"<b>{v}</b>"
    return _VAR_RE.sub(repl, text)


_LABEL_RE = re.compile(r"^([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ /—-]{1,40})\.")


def _emphasize(text: str) -> str:
    """Resalta el rótulo de la cláusula (PRECIO., MODALIDAD — …) y AUTORIZANTE/AUTORIZADO."""
    m = _LABEL_RE.match(text)
    if m:
        text = f"<b>{m.group(1)}</b>" + text[m.end() - 1:]
    for word in ("AUTORIZANTE", "AUTORIZADO"):
        text = text.replace(word, f"<b>{word}</b>")
    return text


def _visible(block: dict, vars: dict) -> bool:
    c = block.get("condition")
    if not c:
        return True
    value = vars.get(c["var"])
    if c.get("notEmpty"):
        return value not in (None, "")
    if "in" in c:
        return str(value) in [str(x) for x in c["in"]]
    if "equals" in c:
        return str(value) == str(c["equals"])
    return True


def _styles():
    ss = getSampleStyleSheet()
    body = ParagraphStyle("veraBody", parent=ss["Normal"], fontName="Helvetica",
                          fontSize=10.5, leading=16, alignment=TA_JUSTIFY, spaceAfter=8)
    h1 = ParagraphStyle("veraH1", parent=ss["Title"], fontName="Helvetica-Bold",
                        fontSize=16, alignment=TA_CENTER, spaceAfter=18)
    small = ParagraphStyle("veraSmall", parent=ss["Normal"], fontName="Helvetica",
                           fontSize=8.5, leading=12, textColor=colors.HexColor("#666666"))
    cert = ParagraphStyle("veraCert", parent=ss["Normal"], fontName="Helvetica",
                          fontSize=9.5, leading=14)
    brand = ParagraphStyle("veraBrand", parent=ss["Normal"], fontName="Helvetica-Bold",
                           fontSize=13, textColor=colors.HexColor("#1a1a1a"), leading=15,
                           spaceAfter=0)
    brandsub = ParagraphStyle("veraBrandSub", parent=ss["Normal"], fontName="Helvetica",
                              fontSize=7.5, textColor=colors.HexColor("#888888"), leading=10)
    return {"body": body, "h1": h1, "small": small, "cert": cert,
            "brand": brand, "brandsub": brandsub}


def _header_flowables(st: dict) -> list:
    """Encabezado de marca (logo Varela en negro; si no está, wordmark)."""
    flow = []
    logo = _black_logo_bytes()
    if logo:
        try:
            img = Image(io.BytesIO(logo), width=3.4 * cm, height=1.2 * cm, kind="proportional")
            img.hAlign = "LEFT"
            flow.append(img)
        except Exception:  # noqa: BLE001
            flow.append(Paragraph("VARELA <font color='#888888'>PROPIEDADES</font>", st["brand"]))
    else:
        flow.append(Paragraph("VARELA <font color='#888888'>PROPIEDADES</font>", st["brand"]))
        flow.append(Paragraph("Inmobiliaria", st["brandsub"]))
    flow.append(Spacer(1, 0.15 * cm))
    flow.append(HRFlowable(width="100%", thickness=0.8, color=colors.HexColor("#d8d8d8"),
                           spaceBefore=2, spaceAfter=14))
    return flow


def _decode_data_url(data_url: str):
    try:
        b64 = data_url.split(",", 1)[1]
        return io.BytesIO(base64.b64decode(b64))
    except Exception:  # noqa: BLE001
        return None


def _signature_flowables(document: dict, participants: list[dict], st: dict) -> list:
    """Bloque de firma según el método (contrato SignatureRenderStrategy)."""
    flow = [Spacer(1, 0.8 * cm)]
    method = document.get("signature_method")
    for p in participants:
        strategy = signatures.render_strategy(p.get("signature_method") or method)
        block = strategy.block(p) if strategy else {}
        name = _clean(p.get("person_name")) or "________________________"
        role = (p.get("role") or "").capitalize()

        if block.get("kind") == "certification":
            rows = [["Firmante", _clean(block.get("name")) or name]]
            if role:
                rows.append(["Rol", role])
            rows.append(["Método", "Firma electrónica (VERA)"])
            if block.get("signedAt"):
                rows.append(["Fecha", str(block["signedAt"])])
            if block.get("hash"):
                rows.append(["Hash de integridad", block["hash"]])
            t = Table(rows, colWidths=[4 * cm, 11 * cm])
            t.setStyle(TableStyle([
                ("FONT", (0, 0), (-1, -1), "Helvetica", 9),
                ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#777777")),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cccccc")),
                ("INNERGRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#e5e5e5")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]))
            flow.append(Paragraph("<b>Certificado de firma · VERA</b>", st["cert"]))
            flow.append(Spacer(1, 0.2 * cm))
            flow.append(t)
        else:
            # Presencial: firma manuscrita (imagen si existe) + línea + aclaración.
            img = _decode_data_url(block.get("image") or "")
            if img is not None:
                try:
                    flow.append(Image(img, width=6 * cm, height=2 * cm))
                except Exception:  # noqa: BLE001
                    flow.append(Spacer(1, 1.6 * cm))
            else:
                flow.append(Spacer(1, 1.4 * cm))
            flow.append(Paragraph("____________________________________", st["cert"]))
            flow.append(Paragraph(f"{name}{(' · ' + role) if role else ''}", st["small"]))
        flow.append(Spacer(1, 0.7 * cm))
    return flow


def _advisor_signature(st: dict) -> list:
    """Línea de firma fija del asesor de venta (solo Recibo de Seña)."""
    return [
        Spacer(1, 1.0 * cm),
        Paragraph("____________________________________", st["cert"]),
        Paragraph("Asesor de venta: Sebastian Varela", st["small"]),
    ]


def _inmobiliaria_signature(st: dict) -> list:
    """Bloque de firma fijo de la inmobiliaria (Aceptación de Oferta)."""
    return [
        Spacer(1, 1.0 * cm),
        Paragraph("____________________________________", st["cert"]),
        Paragraph("<b>INMOBILIARIA VARELA COSTA DEL ESTE</b>", st["cert"]),
        Paragraph("Jorge Oscar Varela · Mat. T°III F°103 N°865", st["small"]),
    ]


_FIXED_SIGNATURES = {
    "recibo_sena_reserva": _advisor_signature,
    "aceptacion_oferta": _inmobiliaria_signature,
}


def build_document_pdf(document: dict, participants: list[dict]) -> bytes:
    st = _styles()
    raw_vars = document.get("resolved_variables") or {}
    snapshot = document.get("template_snapshot") or {}
    disp_vars = _display_vars(raw_vars, snapshot.get("variables"))
    blocks = (snapshot.get("body") or {}).get("blocks", [])

    story = _header_flowables(st)
    for b in blocks:
        if not _visible(b, raw_vars):
            continue
        if b.get("type") == "heading":
            story.append(Paragraph(_interpolate(b.get("value", ""), disp_vars), st["h1"]))
        else:
            story.append(Paragraph(_emphasize(_interpolate(b.get("value", ""), disp_vars)), st["body"]))

    story += _signature_flowables(document, participants, st)
    fixed = _FIXED_SIGNATURES.get(document.get("template_key"))
    if fixed:
        story += fixed(st)

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=2 * cm, bottomMargin=2 * cm,
                            leftMargin=2.2 * cm, rightMargin=2.2 * cm,
                            title=document.get("title") or "Documento")
    doc.build(story)
    return buf.getvalue()
