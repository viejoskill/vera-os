"""Resolución automática de variables de un documento.

VERA completa la información desde las entidades existentes (Personas, Propiedades,
sistema) — NO se duplica lo que ya existe. Devuelve qué se resolvió y qué datos
obligatorios faltan para poder crear el documento.
"""
from datetime import date

from people.repository import people_repository
from property_repository import property_repository

# Alias de rutas → campo real de la entidad.
_PERSON_PATHS = {
    "full_name": "full_name", "name": "full_name",
    "document": "document", "dni": "document",
    "email": "primary_email", "primary_email": "primary_email",
    "phone": "primary_phone", "primary_phone": "primary_phone",
}
_PROPERTY_PATHS = {
    "address": "address", "formatted_address": "formatted_address",
    "price": "price", "type": "type", "operation": "operation",
    "city": "city", "neighborhood": "neighborhood",
    "bedrooms": "bedrooms", "bathrooms": "bathrooms", "rooms": "rooms",
    "code": "codigo", "codigo": "codigo",
}


def requirements(template: dict) -> dict:
    """Qué necesita el template según sus variables."""
    variables = template.get("variables") or []
    needs_property = any(v.get("source") == "property" for v in variables)
    person_roles = sorted({v.get("role") for v in variables
                           if v.get("source") == "person" and v.get("role")})
    input_fields = [v for v in variables if v.get("source") == "input"]
    return {
        "needsProperty": needs_property,
        "personRoles": person_roles,
        "inputFields": input_fields,
    }


async def resolve(template: dict, property_id: str | None,
                  persons: list[dict], inputs: dict) -> dict:
    """Resuelve cada variable del template. `persons` = [{personId, role}]."""
    variables = template.get("variables") or []
    prop = await property_repository.get(property_id) if property_id else None

    # Persona por rol (una por rol; el rol es el vínculo con el documento).
    persons_by_role: dict[str, dict] = {}
    for link in persons or []:
        person = await people_repository.get(link.get("personId") or link.get("person_id"))
        if person:
            persons_by_role[link.get("role")] = person

    resolved: dict = {}
    missing: list[str] = []
    for v in variables:
        key, source, path = v["key"], v.get("source", "input"), v.get("path")
        value = None
        if source == "system":
            value = date.today().isoformat() if key in ("date", "today") else None
        elif source == "input":
            value = (inputs or {}).get(key)
        elif source == "property" and prop:
            value = prop.get(_PROPERTY_PATHS.get(path, path)) if path else None
        elif source == "person":
            person = persons_by_role.get(v.get("role"))
            if person and path:
                value = person.get(_PERSON_PATHS.get(path, path))
        if value not in (None, "", []):
            resolved[key] = value
        elif v.get("required"):
            missing.append(key)

    return {
        "requirements": requirements(template),
        "resolved": resolved,
        "missing": missing,
        "ready": len(missing) == 0,
    }
