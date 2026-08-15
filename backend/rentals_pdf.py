"""Recibo PDF de liquidación al propietario (reportlab).

Reutiliza el logo Varela (negro) del generador de documentos. Muestra el detalle
de movimientos del período y el neto a liquidar destacado.
"""
from __future__ import annotations

import io
from datetime import datetime, timezone

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
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


def _fd(s) -> str:
    """YYYY-MM-DD -> DD/MM/YYYY (deja el valor tal cual si no matchea)."""
    if not s or not isinstance(s, str) or s.count("-") != 2:
        return s or ""
    y, m, d = s.split("-")
    return f"{d}/{m}/{y}"


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
    h = data.get("huesped") or {}
    if h.get("nombre"):
        story.append(Paragraph("Huésped", st["sec"]))
        hx = " · ".join(x for x in [h.get("telefono"), (f"DNI {h.get('dni')}" if h.get("dni") else None)] if x)
        story.append(Paragraph(f"<b>{h.get('nombre')}</b>" + (f"<br/>{hx}" if hx else ""), st["body"]))
    story.append(Paragraph("Estadía" if h.get("nombre") else "Período", st["sec"]))
    story.append(Paragraph(f"{_fd(per.get('desde'))} → {_fd(per.get('hasta'))}", st["body"]))

    # Detalle de movimientos
    story.append(Paragraph("Detalle de movimientos", st["sec"]))
    rows = [["Fecha", "Concepto", "Descripción", "Monto"]]
    for m in data.get("movimientos") or []:
        rows.append([
            _fd(m.get("fecha")),
            TIPO_LABEL.get(m.get("tipo"), m.get("tipo") or ""),
            (m.get("descripcion") or "")[:60],
            _fmt(m.get("monto"), mon),
        ])
    if len(rows) == 1:
        rows.append(["—", "Sin movimientos", "", ""])
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



def _brand(story, st):
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


def build_recibo_sena_pdf(data: dict) -> bytes:
    """Recibo de la seña para enviarle al huésped."""
    st = _styles()
    prop = data.get("propiedad") or {}
    h = data.get("huesped") or {}
    pago = data.get("pago") or {}
    mon = data.get("moneda", "ARS")
    cod = prop.get("codigo") or ""
    pagada = pago.get("estado") == "pagado"

    story: list = []
    _brand(story, st)
    story.append(Paragraph("Recibo de seña", st["h1"]))
    emitido = datetime.now(timezone.utc).astimezone().strftime("%d/%m/%Y")
    story.append(Paragraph(f"Emitido el {emitido}", st["sub"]))
    story.append(Spacer(1, 0.4 * cm))

    quien = h.get("nombre") or "—"
    if h.get("dni"):
        quien += f" (DNI {h.get('dni')})"
    story.append(Paragraph(
        f"Recibimos de <b>{quien}</b> la suma de <b>{_fmt(pago.get('monto'), 'ARS')}</b> "
        "en concepto de <b>seña</b> por la siguiente reserva:", st["body"]))
    story.append(Spacer(1, 0.2 * cm))

    story.append(Paragraph("Propiedad", st["sec"]))
    story.append(Paragraph(f"<b>{cod}</b> · {prop.get('titulo') or '—'}", st["body"]))
    story.append(Paragraph("Estadía", st["sec"]))
    story.append(Paragraph(f"{_fd(data.get('checkIn'))} → {_fd(data.get('checkOut'))} · {data.get('noches')} noches", st["body"]))

    story.append(Paragraph("Detalle", st["sec"]))
    filas = [["Total de la reserva", _fmt(data.get("montoEstimado"), mon)],
             ["Seña abonada", _fmt(pago.get("monto"), "ARS")]]
    if mon == "ARS":
        saldo = round(float(data.get("montoEstimado") or 0) - float(pago.get("monto") or 0))
        filas.append(["Saldo pendiente (al ingreso)", _fmt(saldo, "ARS")])
    t = Table(filas, colWidths=[11.5 * cm, 4 * cm])
    t.setStyle(TableStyle([
        ("FONT", (0, 0), (-1, -1), "Helvetica", 10),
        ("FONT", (0, 1), (-1, 1), "Helvetica-Bold", 11),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("LINEBELOW", (0, 0), (-1, -2), 0.3, colors.HexColor("#eeeeee")),
        ("BACKGROUND", (0, 1), (-1, 1), colors.HexColor("#f6f6e8")),
        ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(t)
    story.append(Spacer(1, 0.3 * cm))

    medio = "Mercado Pago"
    if pago.get("paymentId"):
        medio += f" · operación {pago.get('paymentId')}"
    estado_txt = "PAGADA ✓" if pagada else "PENDIENTE DE ACREDITACIÓN"
    story.append(Paragraph(f"Medio de pago: {medio}", st["small"]))
    story.append(Paragraph(f"Estado de la seña: <b>{estado_txt}</b>", st["small"]))
    if mon != "ARS":
        story.append(Paragraph("El saldo se coordina con la inmobiliaria al momento del ingreso.", st["small"]))

    story.append(Spacer(1, 1.4 * cm))
    story.append(Paragraph("____________________________________", st["body"]))
    story.append(Paragraph("<b>INMOBILIARIA VARELA COSTA DEL ESTE</b>", st["body"]))
    story.append(Paragraph("Jorge Oscar Varela · Mat. T°III F°103 N°865", st["small"]))

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=2 * cm, bottomMargin=2 * cm,
                            leftMargin=2.2 * cm, rightMargin=2.2 * cm,
                            title=f"Recibo seña {cod}")
    doc.build(story)
    return buf.getvalue()


METODO_LABEL = {"efectivo": "Efectivo", "transferencia": "Transferencia", "mercadopago": "Mercado Pago", "otro": "Otro", "dueño": "En poder del propietario"}


def build_recibo_saldo_pdf(data: dict) -> bytes:
    """Recibo de un cobro de saldo para enviarle al huésped."""
    st = _styles()
    prop = data.get("propiedad") or {}
    h = data.get("huesped") or {}
    saldo = data.get("saldo") or {}
    mon = data.get("moneda", "ARS")
    cod = prop.get("codigo") or ""

    story: list = []
    _brand(story, st)
    story.append(Paragraph("Recibo de saldo", st["h1"]))
    emitido = datetime.now(timezone.utc).astimezone().strftime("%d/%m/%Y")
    story.append(Paragraph(f"Emitido el {emitido}", st["sub"]))
    story.append(Spacer(1, 0.4 * cm))

    quien = h.get("nombre") or "—"
    if h.get("dni"):
        quien += f" (DNI {h.get('dni')})"
    story.append(Paragraph(
        f"Recibimos de <b>{quien}</b> la suma de <b>{_fmt(saldo.get('monto'), mon)}</b> "
        "en concepto de <b>pago de saldo</b> por la siguiente reserva:", st["body"]))
    story.append(Spacer(1, 0.2 * cm))

    story.append(Paragraph("Propiedad", st["sec"]))
    story.append(Paragraph(f"<b>{cod}</b> · {prop.get('titulo') or '—'}", st["body"]))
    story.append(Paragraph("Estadía", st["sec"]))
    story.append(Paragraph(f"{_fd(data.get('checkIn'))} → {_fd(data.get('checkOut'))} · {data.get('noches')} noches", st["body"]))

    story.append(Paragraph("Detalle", st["sec"]))
    filas = [["Total de la reserva", _fmt(data.get("montoEstimado"), mon)],
             ["Total cobrado a la fecha", _fmt(data.get("totalCobrado"), mon)],
             ["Este pago (saldo)", _fmt(saldo.get("monto"), mon)],
             ["Saldo pendiente", _fmt(data.get("saldoPendiente"), mon)]]
    t = Table(filas, colWidths=[11.5 * cm, 4 * cm])
    t.setStyle(TableStyle([
        ("FONT", (0, 0), (-1, -1), "Helvetica", 10),
        ("FONT", (0, 2), (-1, 2), "Helvetica-Bold", 11),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("LINEBELOW", (0, 0), (-1, -2), 0.3, colors.HexColor("#eeeeee")),
        ("BACKGROUND", (0, 2), (-1, 2), colors.HexColor("#f6f6e8")),
        ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(t)
    story.append(Spacer(1, 0.3 * cm))

    story.append(Paragraph(f"Medio de pago: {METODO_LABEL.get(saldo.get('metodo'), saldo.get('metodo') or '—')}", st["small"]))
    story.append(Paragraph(f"Fecha del cobro: {_fd(saldo.get('fecha'))}", st["small"]))

    story.append(Spacer(1, 1.4 * cm))
    story.append(Paragraph("____________________________________", st["body"]))
    story.append(Paragraph("<b>INMOBILIARIA VARELA COSTA DEL ESTE</b>", st["body"]))
    story.append(Paragraph("Jorge Oscar Varela · Mat. T°III F°103 N°865", st["small"]))

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=2 * cm, bottomMargin=2 * cm,
                            leftMargin=2.2 * cm, rightMargin=2.2 * cm,
                            title=f"Recibo saldo {cod}")
    doc.build(story)
    return buf.getvalue()



# ===== Números a letras (pesos, enteros) =====
_UNI = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez",
        "once", "doce", "trece", "catorce", "quince", "dieciseis", "diecisiete", "dieciocho", "diecinueve", "veinte"]
_DEC = ["", "", "veinti", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"]
_CEN = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos",
        "seiscientos", "setecientos", "ochocientos", "novecientos"]


def _decenas(n: int) -> str:
    if n <= 20:
        return _UNI[n]
    if n < 30:
        return "veinti" + _UNI[n - 20]
    d, u = n // 10, n % 10
    return _DEC[d] + (" y " + _UNI[u] if u else "")


def _centenas(n: int) -> str:
    if n == 0:
        return ""
    if n == 100:
        return "cien"
    c, r = n // 100, n % 100
    out = _CEN[c]
    return (out + (" " if out and r else "") + _decenas(r)) if r else out


def _grupo(n: int, singular: bool = False) -> str:
    s = _centenas(n)
    if singular and s.endswith("uno"):
        s = s[:-3] + "un"
    return s


def pesos_en_letras(n) -> str:
    n = int(round(float(n or 0)))
    if n == 0:
        return "CERO"
    millones, resto = divmod(n, 1_000_000)
    miles, cientos = divmod(resto, 1000)
    parts = []
    if millones:
        parts.append("un millon" if millones == 1 else _grupo(millones, True) + " millones")
    if miles:
        parts.append("mil" if miles == 1 else _grupo(miles, True) + " mil")
    if cientos:
        parts.append(_centenas(cientos))
    return " ".join(parts).upper()


# ===== Datos de la inmobiliaria =====
LOCADOR_NOMBRE = "ADMINISTRACION VARELA"
LOCADOR_DOM = "Av. Interbalnearia 162, Costa del Este, Pdo. de la Costa"
WEB = "www.varelapropiedades.com.ar"


def _doc_header(story, st, titulo: str, numero: str | None = None):
    _brand(story, st)
    story.append(Paragraph(titulo, st["h1"]))
    if numero:
        story.append(Paragraph(numero, st["sub"]))
    emitido = datetime.now(timezone.utc).astimezone().strftime("%d/%m/%Y")
    story.append(Paragraph(f"Emitido el {emitido}", st["sub"]))
    story.append(Spacer(1, 0.35 * cm))


def _num_or_blank(v) -> str:
    return str(v) if v not in (None, "") else "________________"


def build_reserva_pdf(data: dict) -> bytes:
    """Documento de RESERVA DE ALQUILER TEMPORARIO (se envía al formalizar la seña)."""
    st = _styles()
    just = ParagraphStyle("just", parent=st["body"], alignment=TA_JUSTIFY, spaceAfter=5)
    small = ParagraphStyle("smallj", parent=st["small"], alignment=TA_JUSTIFY, spaceAfter=3)
    prop = data.get("propiedad") or {}
    h = data.get("huesped") or {}
    mon = data.get("moneda", "ARS")
    nro = data.get("nroReserva")

    total = float(data.get("montoEstimado") or 0)
    sena = float(data.get("sena") or 0)
    deposito = float(data.get("depositoGarantia") or 0)
    saldo = float(data.get("saldoPendiente") if data.get("saldoPendiente") is not None else max(0.0, total - sena))
    total_ingreso = saldo + deposito

    story: list = []
    _doc_header(story, st, "Reserva de alquiler temporario", f"Reserva N° {nro}" if nro else None)

    dom = h.get("domicilio") or ""
    tel = h.get("telefono") or ""
    email = h.get("email") or ""
    story.append(Paragraph(
        f"Recibimos del Señor/a <b>{h.get('nombre') or '________'}</b>, DNI N° {_num_or_blank(h.get('dni'))}, "
        f"con domicilio legal y a todos los efectos en {dom or '________________'}, Tel {tel or '________'} "
        f"Email {email or '________'}, la suma de PESOS <b>{pesos_en_letras(sena)}</b> ({_fmt(sena, mon)}), "
        f"en concepto de RESERVA POR ALQUILER TEMPORARIO de la vivienda <b>{prop.get('codigo') or ''}</b> "
        f"ubicada en {prop.get('direccion') or '________'} de la localidad de {prop.get('localidad') or 'COSTA DEL ESTE'}, "
        f"siendo el valor total del mismo la cantidad de PESOS <b>{pesos_en_letras(total)}</b> ({_fmt(total, mon)}) "
        f"por el periodo comprendido desde el día <b>{_fd(data.get('checkIn'))}</b> (a partir de las {prop.get('checkInHora') or '11:30 hs'}), "
        f"hasta el día <b>{_fd(data.get('checkOut'))}</b> ({prop.get('checkOutHora') or '10:00 hs'}).", just))
    story.append(Spacer(1, 0.15 * cm))

    story.append(Paragraph(
        "El contrato de locación se firmará antes del ingreso a la propiedad, en cuyo acto deberá abonar "
        "los siguientes importes:", just))
    filas = [["Saldo de alquiler", _fmt(saldo, mon)],
             ["Depósito de garantía", _fmt(deposito, mon)],
             ["TOTAL a abonar en el ingreso", _fmt(total_ingreso, mon)]]
    t = Table(filas, colWidths=[11.5 * cm, 4 * cm])
    t.setStyle(TableStyle([
        ("FONT", (0, 0), (-1, -1), "Helvetica", 10),
        ("FONT", (0, 2), (-1, 2), "Helvetica-Bold", 11),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("LINEBELOW", (0, 0), (-1, -2), 0.3, colors.HexColor("#eeeeee")),
        ("BACKGROUND", (0, 2), (-1, 2), colors.HexColor("#f6f6e8")),
        ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(t)
    story.append(Spacer(1, 0.2 * cm))
    story.append(Paragraph(
        "Se deja constancia que si el Locatario no se presentara el día del ingreso con los importes antes "
        "detallados o cancelare dicho contrato por propia voluntad, perderá automáticamente la reserva "
        "efectuada, sin notificación alguna, judicial y/o extrajudicial.", small))

    pax = prop.get("capacidad")
    mascotas = "SÍ" if prop.get("aceptaMascotas") else "NO"
    ropa = ("La unidad cuenta con ropa blanca." if prop.get("ropaBlanca")
            else "La unidad NO cuenta con ropa blanca (sábanas y toallas); deberán ser provistas por el inquilino.")
    story.append(Paragraph("Otros datos a tener en cuenta:", st["sec"]))
    story.append(Paragraph(
        f"• Máximo personas por ocupación (Pax): {_num_or_blank(pax)}<br/>"
        f"• Mascotas: {mascotas}<br/>"
        "• Gas: a cargo del Propietario<br/>"
        "• Luz: a cargo del Propietario", small))
    story.append(Paragraph(
        "• Limpieza: LA PROPIEDAD SE ENTREGA LIMPIA Y EN ÓPTIMAS CONDICIONES. SI EN LA DEVOLUCIÓN NO SE "
        "ENCONTRARA EN EL MISMO ESTADO SE COBRARÁ UN ADICIONAL DE $ 40.000 EN CONCEPTO DE LIMPIEZA Y "
        "PRODUCTOS DE LIMPIEZA.", small))
    story.append(Paragraph(f"• {ropa}", small))
    story.append(Paragraph(
        "• Los horarios de Check-in / Check-out se efectúan en los horarios pactados en la presente reserva. "
        "Si surge un eventual cambio, los ingresos y egresos se realizan dentro del horario de atención.", small))

    story.append(Paragraph("Cargos por cancelación, modificación de fechas, no presentación o salida anticipada:", st["sec"]))
    story.append(Paragraph(
        "• Si la cancelación o modificación de fechas ocurriera dentro de los 60 días previos a la fecha de "
        "ingreso, el reintegro del importe abonado en concepto de seña quedará sujeto a la reserva de igual "
        "estadía por parte de un tercero.<br/>"
        "• En el caso de no presentación o salida anticipada, no se reintegrarán los importes abonados.<br/>"
        "• En el caso de no poder llevarse a cabo el alquiler por alguna eventualidad/problema con la propiedad "
        "de fuerza mayor, la inmobiliaria solo reintegrará el mismo importe abonado por seña.<br/>"
        "• El depósito en garantía será devuelto al finalizar el alquiler en la misma moneda e importe entregados "
        "al momento del ingreso.", small))
    story.append(Paragraph(
        "Horario de oficina a partir de Enero, todos los días de 09:30 hs a 13:30 hs y de 17:00 hs a 20:30 hs. "
        "SIN EXCEPCIONES.", small))

    story.append(Spacer(1, 1.2 * cm))
    story.append(Paragraph("En prueba de conformidad, se firman dos (2) ejemplares de un mismo tenor y a un solo efecto.", st["body"]))
    story.append(Spacer(1, 1.0 * cm))
    firmas = Table([["______________________", "______________________"],
                    ["Locatario", LOCADOR_NOMBRE]], colWidths=[7.5 * cm, 7.5 * cm])
    firmas.setStyle(TableStyle([("FONT", (0, 0), (-1, -1), "Helvetica", 9), ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                                ("TOPPADDING", (0, 1), (-1, 1), 2)]))
    story.append(firmas)
    story.append(Spacer(1, 0.3 * cm))
    story.append(Paragraph(WEB, st["sub"]))

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=1.8 * cm, bottomMargin=1.8 * cm,
                            leftMargin=2.2 * cm, rightMargin=2.2 * cm, title=f"Reserva {nro or ''}")
    doc.build(story)
    return buf.getvalue()


def build_contrato_pdf(data: dict) -> bytes:
    """CONTRATO DE LOCACIÓN TEMPORARIA (se firma en la oficina al ingreso)."""
    st = _styles()
    just = ParagraphStyle("cj", parent=st["body"], alignment=TA_JUSTIFY, fontSize=9, leading=12.5, spaceAfter=5)
    prop = data.get("propiedad") or {}
    h = data.get("huesped") or {}
    mon = data.get("moneda", "ARS")
    nro = data.get("nroContrato")

    total = float(data.get("montoEstimado") or 0)
    deposito = float(data.get("depositoGarantia") or 0)
    noches = int(data.get("noches") or 1) or 1
    penalidad = round(total / noches)
    pax = prop.get("capacidad") or "____"
    tipo = prop.get("tipo") or "vivienda"
    dorm = prop.get("dormitorios")
    tipo_desc = f"{tipo}" + (f" de {dorm} dormitorio(s)" if dorm else "")

    story: list = []
    _doc_header(story, st, "Contrato de locación temporaria", f"CONTRATO N° {nro}" if nro else None)

    dom = h.get("domicilio") or "________________"
    story.append(Paragraph(
        f"Entre <b>{LOCADOR_NOMBRE}</b>, con domicilio en {LOCADOR_DOM}, en adelante EL LOCADOR, y el Señor/a "
        f"<b>{h.get('nombre') or '________'}</b>, DNI N° {_num_or_blank(h.get('dni'))}, con domicilio en {dom}, "
        "en adelante EL LOCATARIO, convienen en celebrar el presente CONTRATO DE LOCACIÓN TEMPORARIA CON FINES "
        "DE VERANEO, TURISMO Y ESPARCIMIENTO, que se regirá por las siguientes cláusulas.", just))

    clausulas = [
        ("PRIMERA", f"EL LOCATARIO alquila una propiedad tipo {tipo_desc} con todas sus dependencias, ubicada en "
                    f"{prop.get('direccion') or '________'}, de la localidad de {prop.get('localidad') or 'COSTA DEL ESTE'}, "
                    f"por una temporada de veraneo, turismo y esparcimiento. La presente locación se conviene por el período "
                    f"desde el {_fd(data.get('checkIn'))} hasta su vencimiento el {_fd(data.get('checkOut'))} a las "
                    f"{prop.get('checkOutHora') or '10:00 hs'}, plazo determinado e improrrogable. En caso contrario, EL "
                    f"LOCATARIO indemnizará a EL LOCADOR con la suma de {_fmt(penalidad, mon)} por cada día que transcurra "
                    "desde la fecha pactada hasta la entrega de la propiedad completamente desocupada, sin que ello signifique "
                    "conformidad de EL LOCADOR, quedando facultado para tomar posesión de la propiedad sin previo aviso."),
        ("SEGUNDA", f"El precio total convenido por la presente locación es de PESOS <b>{pesos_en_letras(total)}</b> "
                    f"({_fmt(total, mon)}), sirviendo el presente de eficaz recibo y carta de pago."),
        ("TERCERA", "Los impuestos, tasas, contribuciones, gas y electricidad de la propiedad estarán a cargo de EL LOCADOR, "
                    "salvo situaciones específicas que se detallen en las observaciones. Si la propiedad utiliza gas envasado "
                    "y se agotara, EL LOCATARIO deberá solicitar su reposición."),
        ("CUARTA", f"EL LOCADOR entrega la propiedad en perfecto estado de uso y conservación, con todos sus ambientes limpios. "
                   f"EL LOCATARIO se obliga a devolverla en el mismo estado, salvo el desgaste natural del buen uso. Al finalizar, "
                   f"se realizará una revisión de la propiedad y del mobiliario; lo faltante o deteriorado deberá reponerse o abonarse "
                   f"a precio de plaza, abonando además la suma de $ 50.000 por la limpieza si no se encontrara en perfecto estado. "
                   f"En garantía del fiel cumplimiento, EL LOCATARIO deposita en la Oficina interviniente la suma de {_fmt(deposito, mon)}, "
                   "importe que será devuelto al finalizar el contrato una vez abonadas las facturas pendientes (si las hubiere). "
                   "El depósito se devuelve en la misma moneda e importe entregados al ingreso."),
        ("QUINTA", f"La propiedad se alquila para ser ocupada por {pax} personas (el Locatario y su familia), no pudiéndose alterar "
                   "el uso actual, ni subarrendarla, cederla, donarla o transferirla de modo alguno sin autorización escrita."),
        ("SEXTA", "El ingreso a la propiedad se realiza, sin excepción, en horario de oficina de 09:30 a 13:00 hs y de 17:00 a 20:00 hs. "
                  "La devolución se realiza entre las 09:30 y las 10:00 hs de la fecha pactada, acercándose personal de la administración "
                  "a verificar el estado de la propiedad y proceder a su cierre."),
        ("SEPTIMA", "A todos los efectos legales derivados del presente Contrato, las partes se someten a la Jurisdicción Ordinaria de "
                    "los Tribunales de la ciudad de Dolores, renunciando a cualquier otro fuero y constituyendo domicilio legal en los "
                    "mencionados al inicio del presente."),
        ("OCTAVA", "EL LOCATARIO declara bajo juramento que alquila la propiedad objeto de este Contrato para temporada de veraneo, "
                   "turismo y esparcimiento y por el período establecido. EL LOCADOR queda autorizado a cancelar el presente contrato "
                   "en caso de falsedad de los datos declarados, devolviendo el depósito previa deducción de gastos, sin derecho a reclamo."),
        ("NOVENA", "SERVICIOS: ante inconvenientes en la prestación de servicios externos a la administración (energía eléctrica, cable, "
                   "internet, etc.), la administración realizará los reclamos pertinentes, no siendo responsable por demoras en su resolución. "
                   "No se reintegrará dinero por desperfecto de dichos servicios."),
        ("DECIMA", "ALARMAS: si la propiedad cuenta con sistema de alarma monitoreada, será responsabilidad de EL LOCATARIO activarla al "
                   "retirarse, siendo responsable por los daños causados por su no activación en caso de robo y/o hurto."),
        ("DECIMA PRIMERA", "LLAVES: EL LOCATARIO recibe un juego de llaves en perfecto funcionamiento. En caso de pérdida o daño de las "
                           "llaves o cerraduras, será responsable de los gastos ocasionados."),
        ("DECIMA SEGUNDA", "EL LOCADOR no será responsable por desperfectos que se produzcan por culpa y/o negligencia de EL LOCATARIO, "
                           "ni por hechos de terceros, ni por daños por robo o hurto que EL LOCATARIO pudiera sufrir."),
        ("DECIMA TERCERA", "La Administración Varela tomará las medidas necesarias para resolver los imprevistos que surjan en la propiedad "
                           "durante la estadía, según los tiempos razonables de las empresas tercerizadas para la resolución del conflicto."),
    ]
    for titulo, texto in clausulas:
        story.append(Paragraph(f"<b>{titulo}:</b> {texto}", just))

    story.append(Spacer(1, 0.3 * cm))
    story.append(Paragraph(
        f"En prueba de conformidad, se firman dos (2) ejemplares de un mismo tenor y a un solo efecto en Costa del Este, "
        f"a los {_fd(data.get('checkIn'))}.", st["body"]))
    story.append(Paragraph("Observaciones: ______________________________________________________________", st["small"]))
    story.append(Spacer(1, 1.1 * cm))
    firmas = Table([["______________________", "______________________"],
                    ["Locatario", LOCADOR_NOMBRE],
                    [f"{h.get('nombre') or ''} · DNI {h.get('dni') or ''}", ""]],
                   colWidths=[7.5 * cm, 7.5 * cm])
    firmas.setStyle(TableStyle([("FONT", (0, 0), (-1, -1), "Helvetica", 9), ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                                ("FONT", (0, 2), (0, 2), "Helvetica", 8)]))
    story.append(firmas)
    story.append(Spacer(1, 0.25 * cm))
    story.append(Paragraph(WEB, st["sub"]))

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=1.7 * cm, bottomMargin=1.7 * cm,
                            leftMargin=2 * cm, rightMargin=2 * cm, title=f"Contrato {nro or ''}")
    doc.build(story)
    return buf.getvalue()
