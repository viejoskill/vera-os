"""Seed del template OFICIAL 'Recibo de Seña (Reserva)' (Varela Propiedades).

Fiel al modelo en PDF del usuario. Datos fijos del martillero (Jorge Oscar
Varela) y de la escribana (Nancy Cecilia Moal) quedan en el cuerpo; lo
completable son comprador, inmueble y montos. Idempotente: si ya existe la
clave, crea una nueva versión.

Uso: python -m scripts.seed_recibo_sena
"""
import asyncio
import os

import httpx

API = os.environ.get("SEED_API", "http://localhost:8001") + "/api/documents"
TEMPLATE_KEY = "recibo_sena_reserva"

VARIABLES = [
    {"key": "fecha", "label": "Fecha", "source": "system", "type": "date", "required": True},
    {"key": "ciudad", "label": "Ciudad", "source": "input", "type": "text", "required": True,
     "default": "Costa del Este"},
    {"key": "provincia", "label": "Provincia", "source": "input", "type": "text", "required": True,
     "default": "Buenos Aires"},
    {"key": "comprador_nombre", "label": "Nombre del comprador", "source": "person",
     "role": "comprador", "path": "full_name", "type": "text", "required": True},
    {"key": "comprador_dni", "label": "DNI del comprador", "source": "person",
     "role": "comprador", "path": "document", "type": "text", "required": True},
    {"key": "comprador_domicilio", "label": "Domicilio del comprador", "source": "person",
     "role": "comprador", "path": "address", "type": "text", "required": False},
    {"key": "comprador_telefono", "label": "Teléfono del comprador", "source": "person",
     "role": "comprador", "path": "phone", "type": "text", "required": False},
    {"key": "inmueble_ubicacion", "label": "Ubicación del inmueble", "source": "property",
     "path": "address", "type": "text", "required": True},
    {"key": "inmueble_descripcion", "label": "Descripción del inmueble", "source": "input",
     "type": "textarea", "required": False},
    {"key": "nomenclatura_catastral", "label": "Nomenclatura catastral", "source": "input",
     "type": "text", "required": False},
    {"key": "monto_sena", "label": "Monto de la seña (USD)", "source": "input",
     "type": "money", "required": True},
    {"key": "precio_total", "label": "Precio total de la operación (USD)", "source": "input",
     "type": "money", "required": True},
    {"key": "honorarios", "label": "Honorarios del martillero (USD)", "source": "input",
     "type": "money", "required": True},
]

BODY = {"blocks": [
    {"type": "heading", "value": "RECIBO DE SEÑA PROVISORIO"},
    {"type": "p", "value": "En la ciudad de {{ciudad}}, Provincia de {{provincia}}, a {{fecha}}, se "
     "extiende el presente Recibo de Seña, conforme a las siguientes condiciones:"},
    {"type": "p", "value": "DATOS DEL COMPRADOR. Nombre y Apellido: {{comprador_nombre}}. "
     "DNI: {{comprador_dni}}. Domicilio: {{comprador_domicilio}}. Teléfono: {{comprador_telefono}}."},
    {"type": "p", "value": "INMUEBLE OBJETO DE LA OPERACIÓN. Ubicado en: {{inmueble_ubicacion}}. "
     "Descripción: {{inmueble_descripcion}}. Nomenclatura Catastral: {{nomenclatura_catastral}}."},
    {"type": "p", "value": "MONTO DE LA SEÑA. Se recibe del COMPRADOR la suma de DÓLARES "
     "ESTADOUNIDENSES USD {{monto_sena}}, en concepto de SEÑA AD REFERENDUM, correspondiente al "
     "inmueble detallado precedentemente."},
    {"type": "p", "value": "PRECIO TOTAL DE LA OPERACIÓN. El precio total convenido para la presente "
     "operación asciende a la suma de DÓLARES ESTADOUNIDENSES USD {{precio_total}}."},
    {"type": "p", "value": "FORMA DE PAGO. A la firma de la escritura, la suma total del precio "
     "convenido."},
    {"type": "p", "value": "HONORARIOS Y GASTOS. Los gastos de escrituración, incluido el EP, son a "
     "cargo del comprador, previa aceptación del presupuesto."},
    {"type": "p", "value": "Interviene en esta venta el Martillero y Corredor Público JORGE OSCAR "
     "VARELA, con Matrícula T°III F°103 N°865 de la Prov. de Buenos Aires, siendo sus honorarios "
     "pactados con el COMPRADOR de DÓLARES ESTADOUNIDENSES BILLETES USD {{honorarios}}, pagaderos a la "
     "firma de la escritura."},
    {"type": "p", "value": "ESCRITURACIÓN. La Escritura Traslativa de Dominio del inmueble referenciado "
     "será otorgada por ante la Escribana NANCY CECILIA MOAL, en un plazo de 60 días a la firma de la "
     "presente, con oficina en Sánchez de Loria Nº341 - 6to. Piso, Depto. D, Lomas de Zamora, "
     "Tel 221-064868, siendo su designación de carácter esencial y necesario para la venta."},
    {"type": "p", "value": "CONDICIONES DE LA RESERVA. En caso de que el VENDEDOR no acepte la operación "
     "en las condiciones aquí establecidas, la suma entregada será reintegrada íntegramente al COMPRADOR, "
     "sin cargo alguno."},
    {"type": "p", "value": "En caso de desistimiento por parte del COMPRADOR, la suma entregada quedará "
     "a favor de la INMOBILIARIA interviniente, en concepto de gastos, gestión y honorarios, sin derecho "
     "a reclamo alguno."},
    {"type": "p", "value": "ENTREGA Y ESTADO DEL INMUEBLE. El inmueble será entregado libre de deudas, "
     "impuestos, tasas, servicios y gravámenes, al día de la posesión, en el estado en que fue visitado "
     "y aceptado por el COMPRADOR."},
    {"type": "p", "value": "JURISDICCIÓN. Para cualquier cuestión judicial derivada del presente, las "
     "partes se someten a la jurisdicción de los Tribunales Ordinarios de Dolores, renunciando a "
     "cualquier otro fuero o jurisdicción."},
    {"type": "p", "value": "En prueba de conformidad, se firman dos (2) ejemplares de un mismo tenor y a "
     "un solo efecto, en el lugar y fecha indicados al inicio."},
]}

PAYLOAD = {
    "templateKey": TEMPLATE_KEY,
    "name": "Recibo de Seña (Reserva)",
    "category": "reserva",
    "description": "Recibo de seña provisorio ad referéndum del vendedor: datos del comprador, inmueble, "
                   "monto de seña, precio total y honorarios. Firma del comprador y la inmobiliaria.",
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
