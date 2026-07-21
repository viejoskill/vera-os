"""Knowledge Extractor — usa VERA Brain (LLM) para transformar un resumen de
conversación en HECHOS estructurados. Devuelve SOLO datos útiles y permanentes;
nunca frases textuales, saludos ni la conversación."""
from __future__ import annotations

import json
import logging

from vera_brain.ai_provider import active_provider

logger = logging.getLogger("vera")

_ALLOWED_TYPES = [
    "role", "relationship", "intent", "profession", "company", "business_context",
    "property_type", "location", "budget", "bedrooms", "payment_method",
    "accepts_credit", "preference", "restriction", "next_step", "decision_maker",
    "involved_person", "fact", "tag",
]

_SYSTEM = (
    "Sos el Knowledge Extractor de VERA, un sistema inmobiliario. Analizás el RESUMEN "
    "de una conversación y extraés CONOCIMIENTO ESTRUCTURADO, útil y PERMANENTE sobre la "
    "persona. Reglas estrictas:\n"
    "- Devolvé EXCLUSIVAMENTE un JSON válido, sin texto adicional ni markdown.\n"
    "- NO copies frases textuales, NO incluyas saludos ni la conversación.\n"
    "- Extraé sólo datos reutilizables a futuro (rol, relación, intención, profesión, "
    "empresa, presupuesto, zonas, tipo de propiedad, dormitorios, forma de pago, si acepta "
    "crédito, preferencias, restricciones, próximos pasos, quién decide, contexto de negocio).\n"
    "- Si un dato no está claro, NO lo inventes.\n"
    "- Cada hecho lleva una confianza entre 0 y 1.\n"
    'Roles posibles: Comprador, Propietario, Inversor, Agrimensor, Arquitecto, Escribano, '
    'Constructor, Proveedor, Inquilino, Otro.\n'
    'Relación posible: Cliente, Cliente potencial, Propietario, Proveedor, Colaborador, '
    'Contacto comercial.\n'
    'Intención posible: Comprar, Vender, Alquilar, Tasar, Servicio profesional, Consulta general.'
)

_INSTR = (
    'Formato EXACTO de salida:\n'
    '{"facts":[{"type":"<uno de: ' + ", ".join(_ALLOWED_TYPES) + '>","value":<string o número>,'
    '"currency":"USD","confidence":<0..1>}]}\n'
    'Usá "currency" sólo en type=budget. Devolvé [] si no hay conocimiento útil.'
)


def _parse(text: str) -> list[dict]:
    raw = (text or "").strip()
    if raw.startswith("```"):
        raw = raw.strip("`")
        raw = raw[raw.find("{"):] if "{" in raw else raw
    start, end = raw.find("{"), raw.rfind("}")
    if start < 0 or end < 0:
        return []
    try:
        data = json.loads(raw[start:end + 1])
    except json.JSONDecodeError:
        logger.warning("Knowledge Extractor: JSON inválido del LLM")
        return []
    facts = data.get("facts") if isinstance(data, dict) else None
    if not isinstance(facts, list):
        return []
    clean = []
    for f in facts:
        if isinstance(f, dict) and f.get("type") in _ALLOWED_TYPES and f.get("value") not in (None, "", []):
            clean.append(f)
    return clean


async def extract(summary: str, person_name: str = "") -> list[dict]:
    prompt = (
        f"Persona: {person_name or 'desconocida'}\n"
        f"Resumen de la conversación:\n\"\"\"\n{summary.strip()}\n\"\"\"\n\n{_INSTR}"
    )
    try:
        text = await active_provider.reason(_SYSTEM, prompt, session_id="knowledge-extractor")
    except Exception as exc:  # noqa: BLE001
        logger.warning("Knowledge Extractor: fallo del LLM: %s", exc)
        return []
    return _parse(text)
