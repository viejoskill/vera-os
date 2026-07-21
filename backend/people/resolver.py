"""PersonResolver — identidad única de VERA Core.

Contrato genérico e independiente del canal: hoy resuelve por teléfono/email,
mañana por whatsapp/instagram/document/crm_id, SIN cambiar la interfaz. Cualquier
módulo que detecte a un ser humano (Arturito, web, CRM) debe resolverlo acá y
referenciarlo por `person_id`. Nunca duplicar datos de la persona en otros módulos.
"""
from __future__ import annotations

import config
from people import events
from people.repository import people_repository

# Orden de preferencia de los identificadores para ubicar a la persona.
# (columna en `people`, clave del request)
_LOOKUP = [
    ("primary_phone", "phone"),
    ("primary_phone", "whatsapp"),
    ("phone", "phone"),
    ("primary_email", "email"),
    ("email", "email"),
    ("document", "document"),
]


class PersonResolver:
    async def resolve(self, identifiers: dict) -> dict:
        """Busca la persona por los identificadores disponibles; si no existe la crea.
        Devuelve (person_row, created: bool)."""
        for column, key in _LOOKUP:
            value = (identifiers.get(key) or "").strip()
            if not value:
                continue
            found = await people_repository.find_one(column, value)
            if found:
                return {"person": found, "created": False}

        phone = (identifiers.get("phone") or identifiers.get("whatsapp") or "").strip()
        email = (identifiers.get("email") or "").strip()
        role = (identifiers.get("role") or "").strip()
        payload = {
            "full_name": (identifiers.get("full_name") or "").strip() or (phone or email or "Sin nombre"),
            "primary_phone": phone,
            "primary_email": email,
            "phones": [phone] if phone else [],
            "emails": [email] if email else [],
            "document": (identifiers.get("document") or "").strip(),
            "roles": [role] if role else ["contacto"],
            "status": "active",
        }
        person = await people_repository.create(payload, config.DEFAULT_WORKSPACE_ID)
        await events.record(person["id"], events.PERSON_CREATED, {"source": "resolver"})
        return {"person": person, "created": True}


person_resolver = PersonResolver()
