"""Seed del template OFICIAL 'Autorización de Venta' (Varela Propiedades).

No es un mock: es el primer template real del motor documental. Idempotente:
si ya existe la clave, crea una nueva versión con el contenido actual.

Uso: python -m scripts.seed_autorizacion_venta
"""
import asyncio
import os

import httpx

API = os.environ.get("SEED_API", "http://localhost:8001") + "/api/documents"
TEMPLATE_KEY = "autorizacion_venta"

VARIABLES = [
    {"key": "fecha", "label": "Fecha", "source": "system", "type": "date", "required": True},
    {"key": "propietario_nombre", "label": "Nombre del propietario", "source": "person",
     "role": "propietario", "path": "full_name", "type": "text", "required": True},
    {"key": "propietario_dni", "label": "DNI del propietario", "source": "person",
     "role": "propietario", "path": "document", "type": "text", "required": True},
    {"key": "propiedad_direccion", "label": "Dirección del inmueble", "source": "property",
     "path": "address", "type": "text", "required": True},
    {"key": "propiedad_ciudad", "label": "Localidad", "source": "property", "path": "city",
     "type": "text", "required": False},
    {"key": "propiedad_tipo", "label": "Tipo de inmueble", "source": "property", "path": "type",
     "type": "text", "required": False},
    {"key": "inmobiliaria", "label": "Inmobiliaria", "source": "input", "type": "text",
     "required": True, "default": "Varela Propiedades"},
    {"key": "modalidad", "label": "Modalidad", "source": "input", "type": "select", "required": True,
     "default": "exclusiva",
     "options": [{"value": "exclusiva", "label": "Exclusiva"},
                 {"value": "no_exclusiva", "label": "No exclusiva"}]},
    {"key": "moneda", "label": "Moneda", "source": "input", "type": "select", "required": True,
     "default": "USD",
     "options": [{"value": "USD", "label": "Dólares (USD)"}, {"value": "ARS", "label": "Pesos (ARS)"}]},
    {"key": "precio", "label": "Precio de publicación", "source": "input", "type": "number", "required": True},
    {"key": "precio_minimo", "label": "Precio mínimo de aceptación", "source": "input",
     "type": "number", "required": False},
    {"key": "vigencia_dias", "label": "Vigencia (días)", "source": "input", "type": "number",
     "required": True, "default": 180},
    {"key": "renovacion_automatica", "label": "Renovación automática", "source": "input",
     "type": "select", "required": True, "default": "si",
     "options": [{"value": "si", "label": "Sí"}, {"value": "no", "label": "No"}]},
    {"key": "comision_pct", "label": "Comisión (%)", "source": "input", "type": "number",
     "required": True, "default": 3},
    {"key": "comision_pago", "label": "Pago de la comisión", "source": "input", "type": "select",
     "required": True, "default": "boleto",
     "options": [{"value": "boleto", "label": "A la firma del boleto"},
                 {"value": "escritura", "label": "A la escritura"}]},
    {"key": "admite_reserva", "label": "Faculta a recibir reserva/seña", "source": "input",
     "type": "select", "required": True, "default": "si",
     "options": [{"value": "si", "label": "Sí"}, {"value": "no", "label": "No"}]},
    {"key": "observaciones", "label": "Observaciones", "source": "input", "type": "textarea", "required": False},
]

BODY = {"blocks": [
    {"type": "heading", "value": "AUTORIZACIÓN DE VENTA"},
    {"type": "p", "value": "En {{propiedad_ciudad}}, con fecha {{fecha}}, {{propietario_nombre}}, "
     "DNI {{propietario_dni}} (en adelante, el AUTORIZANTE), autoriza a {{inmobiliaria}} "
     "(en adelante, el AUTORIZADO) a promover la venta del inmueble sito en {{propiedad_direccion}}, "
     "en las condiciones que se detallan a continuación."},
    {"type": "p", "value": "PRECIO. El inmueble será ofrecido en la suma de {{moneda}} {{precio}}."},
    {"type": "p", "condition": {"var": "precio_minimo", "notEmpty": True},
     "value": "PRECIO MÍNIMO. El AUTORIZANTE fija como valor mínimo de aceptación la suma de "
     "{{moneda}} {{precio_minimo}}, quedando el AUTORIZADO facultado a negociar por encima de dicho "
     "importe, ad referéndum del AUTORIZANTE."},
    {"type": "p", "condition": {"var": "modalidad", "equals": "exclusiva"},
     "value": "MODALIDAD — EXCLUSIVIDAD. El AUTORIZANTE confiere la comercialización del inmueble en "
     "forma EXCLUSIVA, obligándose a no encomendar la venta a terceros ni a realizar gestiones directas "
     "por fuera del AUTORIZADO durante la vigencia de la presente."},
    {"type": "p", "condition": {"var": "modalidad", "equals": "no_exclusiva"},
     "value": "MODALIDAD — NO EXCLUSIVA. El AUTORIZANTE confiere la comercialización del inmueble en "
     "forma NO EXCLUSIVA, pudiendo encomendar la venta a otros intermediarios."},
    {"type": "p", "value": "VIGENCIA. La presente autorización tendrá una vigencia de {{vigencia_dias}} "
     "días corridos contados desde su firma."},
    {"type": "p", "condition": {"var": "renovacion_automatica", "equals": "si"},
     "value": "RENOVACIÓN. Vencido el plazo, la autorización se renovará automáticamente por períodos "
     "iguales, salvo revocación fehaciente notificada con anterioridad a su vencimiento."},
    {"type": "p", "condition": {"var": "admite_reserva", "equals": "si"},
     "value": "RESERVA / SEÑA. El AUTORIZADO queda facultado para recibir reservas o señas ad referéndum "
     "del AUTORIZANTE, debiendo notificarle su recepción a la brevedad."},
    {"type": "p", "condition": {"var": "comision_pago", "equals": "boleto"},
     "value": "COMISIÓN / HONORARIOS. Concretada la operación, el AUTORIZANTE abonará al AUTORIZADO, en "
     "concepto de honorarios, el {{comision_pct}}% del precio de venta más los impuestos que correspondan, "
     "pagaderos a la firma del boleto de compraventa."},
    {"type": "p", "condition": {"var": "comision_pago", "equals": "escritura"},
     "value": "COMISIÓN / HONORARIOS. Concretada la operación, el AUTORIZANTE abonará al AUTORIZADO, en "
     "concepto de honorarios, el {{comision_pct}}% del precio de venta más los impuestos que correspondan, "
     "pagaderos al momento de la escritura traslativa de dominio."},
    {"type": "p", "value": "DECLARACIONES. El AUTORIZANTE declara bajo juramento ser titular del inmueble, "
     "que el mismo se encuentra libre de gravámenes, deudas y ocupantes, y que los datos consignados son "
     "verídicos, asumiendo la responsabilidad por su exactitud."},
    {"type": "p", "condition": {"var": "observaciones", "notEmpty": True},
     "value": "OBSERVACIONES. {{observaciones}}"},
    {"type": "p", "value": "En prueba de conformidad, el AUTORIZANTE firma la presente."},
]}

PAYLOAD = {
    "templateKey": TEMPLATE_KEY,
    "name": "Autorización de Venta",
    "category": "autorizacion",
    "description": "Autorización para promover la venta de un inmueble (exclusiva o no exclusiva), "
                   "con vigencia, precio, comisión y facultad de recibir reservas.",
    "variables": VARIABLES,
    "signatureMethods": ["digital", "presencial"],
    "body": BODY,
    "status": "active",
}


async def main():
    async with httpx.AsyncClient(timeout=30) as client:
        existing = (await client.get(f"{API}/templates")).json()
        match = next((t for t in existing if t["templateKey"] == TEMPLATE_KEY), None)
        if match is None:
            r = await client.post(f"{API}/templates", json=PAYLOAD)
            r.raise_for_status()
            print("CREADO:", r.json()["id"], "v", r.json()["version"])
        else:
            r = await client.post(f"{API}/templates/{match['id']}/versions", json={
                "name": PAYLOAD["name"], "description": PAYLOAD["description"],
                "variables": VARIABLES, "signatureMethods": PAYLOAD["signatureMethods"], "body": BODY,
            })
            r.raise_for_status()
            print("NUEVA VERSIÓN:", r.json()["id"], "v", r.json()["version"])


if __name__ == "__main__":
    asyncio.run(main())
