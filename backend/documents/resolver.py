"""Resolución automática de variables de un documento.

VERA completa la información desde las entidades existentes (Personas, Propiedades,
sistema) — NO se duplica lo que ya existe. Devuelve, por variable, qué se resolvió
(y desde dónde), qué datos OBLIGATORIOS faltan (requieren al usuario) y qué datos
opcionales no se pudieron completar (advertencias, no bloquean la creación).
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

_EMPTY = (None, "", [])


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
    """Resuelve cada variable del template. `persons` = [{personId, role}].

    Devuelve tres categorías para la Revisión del wizard:
      - `resolved`  → ✅ lo que VERA completó (origen: property/person/system/input)
      - `missing`   → ✏️ obligatorios sin valor (requieren intervención del usuario)
      - `warnings`  → ⚠️ opcionales que VERA no pudo completar (no bloquean)
    """
    variables = template.get("variables") or []
    inputs = inputs or {}
    prop = await property_repository.get(property_id) if property_id else None

    # Personas por rol. Puede haber MÁS DE UNA por rol (p.ej. 2 compradores):
    # sus valores se agregan con " y " en cada variable.
    persons_by_role: dict[str, list[dict]] = {}
    for link in persons or []:
        person = await people_repository.get(link.get("personId") or link.get("person_id"))
        if person:
            persons_by_role.setdefault(link.get("role"), []).append(person)

    resolved: dict = {}
    missing: list[str] = []
    warnings: list[str] = []
    fields: list[dict] = []

    for v in variables:
        key, source, path = v["key"], v.get("source", "input"), v.get("path")
        required = bool(v.get("required"))
        value = None
        origin = None

        if source == "system":
            if key in ("date", "today", "fecha"):
                value, origin = date.today().isoformat(), "system"
        elif source == "property" and prop and path:
            raw = prop.get(_PROPERTY_PATHS.get(path, path))
            if raw not in _EMPTY:
                value, origin = raw, "property"
        elif source == "person":
            plist = persons_by_role.get(v.get("role")) or []
            if plist and path:
                field = _PERSON_PATHS.get(path, path)
                vals = [str(p.get(field)) for p in plist if p.get(field) not in _EMPTY]
                if vals:
                    value, origin = " y ".join(vals), "person"

        # Un valor tipeado por el usuario (override) siempre puede completar / corregir.
        if value in _EMPTY and inputs.get(key) not in _EMPTY:
            value, origin = inputs[key], "input"
        # Valor por defecto (editable) para variables de entrada sin dato.
        if value in _EMPTY and v.get("default") not in (None, ""):
            value, origin = v["default"], "default"

        empty = value in _EMPTY
        if source == "input":
            status = "input"              # siempre editable por el usuario
        elif not empty:
            status = "resolved"           # ✅ completado por VERA
        elif required:
            status = "missing"            # ✏️ obligatorio faltante (override)
        else:
            status = "warning"            # ⚠️ opcional que VERA no pudo completar
            warnings.append(key)

        if required and empty:
            missing.append(key)
        if not empty:
            resolved[key] = value

        fields.append({
            "key": key,
            "label": v.get("label", key),
            "type": v.get("type", "text"),
            "source": source,
            "role": v.get("role"),
            "required": required,
            "options": v.get("options", []),
            "value": value,
            "origin": origin,
            "status": status,
        })

    return {
        "requirements": requirements(template),
        "resolved": resolved,
        "missing": missing,
        "warnings": warnings,
        "fields": fields,
        "ready": len(missing) == 0,
    }
