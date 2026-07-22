"""Generación de PDF a demanda (reportlab).

El PDF es una REPRESENTACIÓN del documento (que se firma como entidad, no como
archivo). Reusa el contrato de render del motor de firmas: presencial → líneas de
firma manuscrita (o imagen si se dibujó/escaneó); digital → bloque de certificación.
"""
from __future__ import annotations

import base64
import io
import re

from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
)
from reportlab.lib import colors

from documents import signatures

_VAR_RE = re.compile(r"\{\{\s*([\w.]+)\s*\}\}")


def _interpolate(text: str, vars: dict) -> str:
    def repl(m):
        v = vars.get(m.group(1))
        return "" if v in (None, "") else str(v)
    return _VAR_RE.sub(repl, text)


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
    return {"body": body, "h1": h1, "small": small, "cert": cert}


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
        name = p.get("person_name") or "________________________"
        role = (p.get("role") or "").capitalize()

        if block.get("kind") == "certification":
            rows = [["Firmante", block.get("name") or name]]
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


def build_document_pdf(document: dict, participants: list[dict]) -> bytes:
    st = _styles()
    vars_ = document.get("resolved_variables") or {}
    snapshot = document.get("template_snapshot") or {}
    blocks = (snapshot.get("body") or {}).get("blocks", [])

    story = []
    for b in blocks:
        if not _visible(b, vars_):
            continue
        text = _interpolate(b.get("value", ""), vars_)
        story.append(Paragraph(text, st["h1"] if b.get("type") == "heading" else st["body"]))

    story += _signature_flowables(document, participants, st)

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=2 * cm, bottomMargin=2 * cm,
                            leftMargin=2.2 * cm, rightMargin=2.2 * cm,
                            title=document.get("title") or "Documento")
    doc.build(story)
    return buf.getvalue()
