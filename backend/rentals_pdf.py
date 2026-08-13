"""Recibo PDF de liquidación al propietario (reportlab).

Reutiliza el logo Varela (negro) del generador de documentos. Muestra el detalle
de movimientos del período y el neto a liquidar destacado.
"""
from __future__ import annotations

import io
from datetime import datetime, timezone

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    HRFlowable, Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
)

from documents.pdf import _black_logo_bytes

TIPO_LABEL = {
    "ingreso": "Seña / Ingreso",
    "gasto_prop": "Gasto propietario",
    "gasto_nuestro": "Gasto agencia",
    "comision": "Comisión",
}


def _fmt(n, moneda="ARS") -> str:
    s = f"{round(float(n or 0)):,}".replace(",", ".")
    return f"USD {s}" if moneda == "USD" else f"$ {s}"


def _styles():
    ss = getSampleStyleSheet()
    return {
        "h1": ParagraphStyle("h1", parent=ss["Title"], fontName="Helvetica-Bold",
                             fontSize=16, alignment=TA_CENTER, spaceAfter=4),
        "sub": ParagraphStyle("sub", parent=ss["Normal"], fontName="Helvetica",
                              fontSize=9.5, alignment=TA_CENTER, textColor=colors.HexColor("#666666"), spaceAfter=2),
        "sec": ParagraphStyle("sec", parent=ss["Normal"], fontName="Helvetica-Bold",
                              fontSize=11, textColor=colors.HexColor("#1a1a1a"), spaceBefore=10, spaceAfter=6),
        "body": ParagraphStyle("body", parent=ss["Normal"], fontName="Helvetica",
                               fontSize=10, leading=15, alignment=TA_LEFT),
        "small": ParagraphStyle("small", parent=ss["Normal"], fontName="Helvetica",
                                fontSize=8.5, leading=12, textColor=colors.HexColor("#777777")),
        "brand": ParagraphStyle("brand", parent=ss["Normal"], fontName="Helvetica-Bold",
                                fontSize=13, textColor=colors.HexColor("#1a1a1a")),
    }


def build_liquidacion_pdf(data: dict) -> bytes:
    st = _styles()
    prop = data.get("propiedad") or {}
    dueno = data.get("propietario") or {}
    per = data.get("periodo") or {}
    mon = prop.get("moneda", "ARS")

    story: list = []

    # Encabezado de marca
    logo = _black_logo_bytes()
    if logo:
        try:
            img = Image(io.BytesIO(logo), width=3.4 * cm, height=1.2 * cm, kind="proportional")
            img.hAlign = "LEFT"
            story.append(img)
        except Exception:  # noqa: BLE001
            story.append(Paragraph("VARELA <font color='#888888'>PROPIEDADES</font>", st["brand"]))
    else:
        story.append(Paragraph("VARELA <font color='#888888'>PROPIEDADES</font>", st["brand"]))
    story.append(Spacer(1, 0.15 * cm))
    story.append(HRFlowable(width="100%", thickness=0.8, color=colors.HexColor("#d8d8d8"), spaceAfter=12))

    story.append(Paragraph("Liquidación al propietario", st["h1"]))
    emitido = datetime.now(timezone.utc).astimezone().strftime("%d/%m/%Y")
    story.append(Paragraph(f"Emitido el {emitido}", st["sub"]))
    story.append(Spacer(1, 0.4 * cm))

    # Datos propiedad + propietario
    cod = prop.get("codigo") or ""
    story.append(Paragraph("Propiedad", st["sec"]))
    story.append(Paragraph(f"<b>{cod}</b> · {prop.get('titulo') or '—'}", st["body"]))
    story.append(Paragraph("Propietario", st["sec"]))
    linea = dueno.get("nombre") or "—"
    extra = " · ".join(x for x in [dueno.get("telefono"), dueno.get("email"), (f"DNI {dueno.get('dni')}" if dueno.get("dni") else None)] if x)
    story.append(Paragraph(f"<b>{linea}</b>" + (f"<br/>{extra}" if extra else ""), st["body"]))
    story.append(Paragraph("Período", st["sec"]))
    story.append(Paragraph(f"{per.get('desde')} → {per.get('hasta')}", st["body"]))

    # Detalle de movimientos
    story.append(Paragraph("Detalle de movimientos", st["sec"]))
    rows = [["Fecha", "Concepto", "Descripción", "Monto"]]
    for m in data.get("movimientos") or []:
        rows.append([
            m.get("fecha") or "",
            TIPO_LABEL.get(m.get("tipo"), m.get("tipo") or ""),
            (m.get("descripcion") or "")[:60],
            _fmt(m.get("monto"), mon),
        ])
    if len(rows) == 1:
        rows.append(["—", "Sin movimientos en el período", "", ""])
    t = Table(rows, colWidths=[2.5 * cm, 3.5 * cm, 6.5 * cm, 3 * cm])
    t.setStyle(TableStyle([
        ("FONT", (0, 0), (-1, 0), "Helvetica-Bold", 9),
        ("FONT", (0, 1), (-1, -1), "Helvetica", 9),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#333333")),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f2f2f2")),
        ("LINEBELOW", (0, 0), (-1, 0), 0.6, colors.HexColor("#cccccc")),
        ("LINEBELOW", (0, 1), (-1, -1), 0.3, colors.HexColor("#eeeeee")),
        ("ALIGN", (3, 0), (3, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(t)
    story.append(Spacer(1, 0.5 * cm))

    # Resumen
    resumen = [
        ["Alquileres cobrados", _fmt(data.get("ingresos"), mon)],
        ["− Comisión", "-" + _fmt(data.get("comision"), mon)],
        ["− Gastos del propietario", "-" + _fmt(data.get("gastosPropietario"), mon)],
        ["Neto a liquidar", _fmt(data.get("netoPropietario"), mon)],
    ]
    rt = Table(resumen, colWidths=[11.5 * cm, 4 * cm])
    rt.setStyle(TableStyle([
        ("FONT", (0, 0), (-1, -2), "Helvetica", 10),
        ("FONT", (0, -1), (-1, -1), "Helvetica-Bold", 12),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("LINEABOVE", (0, -1), (-1, -1), 0.8, colors.HexColor("#1a1a1a")),
        ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#f6f6e8")),
        ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(rt)
    story.append(Spacer(1, 0.3 * cm))
    story.append(Paragraph(
        f"Gastos a cargo de la agencia en el período: {_fmt(data.get('gastosNuestros'), mon)} "
        "(no se descuentan al propietario).", st["small"]))

    # Firma inmobiliaria
    story.append(Spacer(1, 1.6 * cm))
    story.append(Paragraph("____________________________________", st["body"]))
    story.append(Paragraph("<b>INMOBILIARIA VARELA COSTA DEL ESTE</b>", st["body"]))
    story.append(Paragraph("Jorge Oscar Varela · Mat. T°III F°103 N°865", st["small"]))

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=2 * cm, bottomMargin=2 * cm,
                            leftMargin=2.2 * cm, rightMargin=2.2 * cm,
                            title=f"Liquidación {cod}")
    doc.build(story)
    return buf.getvalue()
