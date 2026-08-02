"""Seed del template OFICIAL 'Aceptación de Oferta' (Varela Propiedades).

Fiel al modelo en PDF del usuario. El propietario/vendedor se toma de la base
(o se agrega en el momento desde el wizard). Editables: precio, escrituración,
honorarios y observaciones. Idempotente: si ya existe la clave, crea una nueva
versión.

Uso: python -m scripts.seed_aceptacion_oferta
"""
import asyncio
import os

import httpx

API = os.environ.get("SEED_API", "http://localhost:8001") + "/api/documents"
TEMPLATE_KEY = "aceptacion_oferta"

ESCRITURACION_DEFAULT = (
    "La Escritura Traslativa de Dominio del inmueble referenciado será otorgada por ante la "
    "Escribana NANCY CECILIA MOAL, con oficina en Sánchez de Loria Nº341 - 6to. Piso, Depto. D, "
    "Lomas de Zamora, Tel 221-064868, siendo su designación de carácter esencial y necesario para "
    "la venta, siendo el plazo de firma dentro de los 60 días, contados a partir de la fecha de "
    "suscripción del presente acuerdo."
)
HONORARIOS_DEFAULT = (
    "Interviene en esta venta el Martillero y Corredor Público JORGE OSCAR VARELA, con Matrícula "
    "T°III F°103 N°865 de la Prov. de Buenos Aires, siendo sus honorarios pactados en su totalidad "
    "con el COMPRADOR."
)

VARIABLES = [
    {"key": "fecha", "label": "Fecha", "source": "system", "type": "date", "required": True},
    {"key": "vendedor_nombre", "label": "Nombre del vendedor (propietario)", "source": "person",
     "role": "propietario", "path": "full_name", "type": "text", "required": True},
    {"key": "vendedor_dni", "label": "DNI del vendedor", "source": "person",
     "role": "propietario", "path": "document", "type": "text", "required": True},
    {"key": "vendedor_domicilio", "label": "Domicilio del vendedor", "source": "person",
     "role": "propietario", "path": "address", "type": "text", "required": False},
    {"key": "inmueble_ubicacion", "label": "Ubicación del inmueble", "source": "property",
     "path": "address", "type": "text", "required": True},
    {"key": "nomenclatura_catastral", "label": "Nomenclatura catastral", "source": "input",
     "type": "text", "required": False},
    {"key": "monto_reserva", "label": "Monto de la reserva (USD)", "source": "input",
     "type": "money", "required": True},
    {"key": "precio_convenido", "label": "Precio convenido (USD)", "source": "input",
     "type": "money", "required": True},
    {"key": "pago_escritura", "label": "Monto a la firma de la escritura (USD)", "source": "input",
     "type": "money", "required": True},
    {"key": "escrituracion", "label": "Escrituración (editable)", "source": "input",
     "type": "textarea", "required": False, "default": ESCRITURACION_DEFAULT},
    {"key": "honorarios", "label": "Honorarios del martillero (editable)", "source": "input",
     "type": "textarea", "required": False, "default": HONORARIOS_DEFAULT},
    {"key": "observaciones", "label": "Observaciones", "source": "input",
     "type": "textarea", "required": False},
]

BODY = {"blocks": [
    {"type": "heading", "value": "ACEPTACIÓN DE OFERTA"},
    {"type": "p", "value": "Costa del Este, {{fecha}}."},
    {"type": "p", "value": "Quien suscribe: {{vendedor_nombre}}, DNI N° {{vendedor_dni}}, con "
     "domicilio en {{vendedor_domicilio}}, y en su carácter de titular del inmueble ubicado en "
     "{{inmueble_ubicacion}}, con la siguiente Nomenclatura Catastral: {{nomenclatura_catastral}}, "
     "viene por la presente y dice que ACEPTA LA RESERVA AD REFERENDUM tomada por INMOBILIARIA "
     "VARELA, de DÓLARES ESTADOUNIDENSES BILLETES USD {{monto_reserva}}, en concepto de reserva del "
     "inmueble."},
    {"type": "p", "value": "PRECIO CONVENIDO. El precio convenido para la presente proposición de "
     "compra asciende a la suma de DÓLARES ESTADOUNIDENSES BILLETES USD {{precio_convenido}}, libre "
     "de gastos para el VENDEDOR, pagaderos de la siguiente forma: a la firma de la escritura, el "
     "monto de DÓLARES ESTADOUNIDENSES BILLETES USD {{pago_escritura}}."},
    {"type": "p", "value": "ESCRITURACIÓN. {{escrituracion}}"},
    {"type": "p", "value": "HONORARIOS. {{honorarios}}"},
    {"type": "p", "value": "La presente ACEPTACIÓN DE OFERTA será mantenida por un plazo de 7 días "
     "hábiles de firmado este documento, fecha en la que deberá comparecer la parte compradora para "
     "efectuar la reserva."},
    {"type": "p", "value": "La propiedad se entregará libre de deudas, con todos los impuestos, "
     "tasas, obras, servicios y consumos al día de la posesión."},
    {"type": "p", "value": "De existir algún tipo de arrepentimiento por parte del vendedor, éste "
     "reintegrará el doble de la suma entregada por el comprador, más los gastos que se generen por "
     "el acto."},
    {"type": "p", "value": "OBSERVACIONES. {{observaciones}}",
     "condition": {"var": "observaciones", "notEmpty": True}},
    {"type": "p", "value": "En todo de acuerdo con lo pactado, se firman 2 ejemplares de un mismo "
     "tenor y a un solo efecto, en la ciudad de Costa del Este, Provincia de Buenos Aires."},
]}

PAYLOAD = {
    "templateKey": TEMPLATE_KEY,
    "name": "Aceptación de Oferta",
    "category": "oferta",
    "description": "Aceptación de oferta ad referéndum del vendedor: datos del propietario, inmueble, "
                   "monto de reserva, precio convenido, escrituración y honorarios. Editables precio, "
                   "escrituración, honorarios y observaciones. Firma del vendedor y la inmobiliaria.",
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
