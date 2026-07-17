"""VERA content intelligence (LLM behind an abstraction).

Single reusable entry point `generate_content(mode, property_data)` designed to grow:
today it powers `title`; the same endpoint/prompt scaffolding will later serve
`description`, `highlights`, and portal-specific variants (Mercado Libre, Zonaprop).
The frontend never talks to the LLM — it only knows this backend service.

Product rule (Regla): VERA PROPONE, el profesional decide. This service only
returns SUGGESTIONS; it never mutates or auto-fills the property.
"""
import json
import logging
import uuid

from emergentintegrations.llm.chat import LlmChat, UserMessage

import config

logger = logging.getLogger("vera")

MODEL_PROVIDER = "gemini"
MODEL_NAME = "gemini-3-flash-preview"

SUPPORTED_MODES = ("title",)  # description / highlights / portals: future sprints

TYPE_LABELS = {
    "departamento": "departamento",
    "casa": "casa",
    "ph": "PH",
    "terreno": "terreno",
    "oficina": "oficina",
    "local": "local",
}


def _known_facts(p: dict) -> list[str]:
    """Only facts we actually have. VERA never invents data (Regla)."""
    facts: list[str] = []
    ptype = TYPE_LABELS.get((p.get("type") or "").strip().lower())
    if ptype:
        facts.append(f"Tipo de propiedad: {ptype}")
    operation = (p.get("operation") or "").strip().lower()
    if operation in ("venta", "alquiler"):
        facts.append(f"Operación: {'Venta' if operation == 'venta' else 'Alquiler'}")
    if (p.get("city") or "").strip():
        facts.append(f"Ciudad: {p['city'].strip()}")
    if (p.get("neighborhood") or "").strip():
        facts.append(f"Barrio: {p['neighborhood'].strip()}")

    def _num(key: str):
        v = p.get(key)
        try:
            n = float(v)
            return n if n > 0 else None
        except (TypeError, ValueError):
            return None

    bedrooms = _num("bedrooms")
    if bedrooms:
        facts.append(f"Dormitorios: {int(bedrooms)}")
    bathrooms = _num("bathrooms")
    if bathrooms:
        facts.append(f"Baños: {int(bathrooms)}")
    area = _num("areaM2") or _num("area_m2")
    if area:
        facts.append(f"Superficie: {int(area)} m²")
    year = (p.get("yearBuilt") or p.get("year_built") or "").strip()
    if year:
        facts.append(f"Año de construcción: {year}")

    amenities = p.get("amenities") or []
    amenities = [a for a in amenities if isinstance(a, str) and a.strip()]
    if amenities:
        facts.append(f"Comodidades: {', '.join(amenities)}")

    if p.get("nearSea") or p.get("near_sea"):
        facts.append("Cercanía al mar: sí")

    return facts


def _title_system_message() -> str:
    return (
        "Sos VERA, un asistente experto en marketing inmobiliario para Argentina. "
        "Generás títulos de publicación para portales inmobiliarios (Google, Zonaprop, "
        "Mercado Libre). Escribís en español rioplatense, natural y profesional.\n\n"
        "REGLAS ESTRICTAS:\n"
        "1. Devolvé EXACTAMENTE 3 títulos DISTINTOS entre sí (no el mismo cambiando una palabra).\n"
        "2. Cada título: máximo 70 caracteres.\n"
        "3. Sin MAYÚSCULAS innecesarias ni gritos; capitalización natural.\n"
        "4. Naturales, no robóticos; que suenen escritos por un buen agente.\n"
        "5. Incluí la ciudad cuando aporte valor.\n"
        "6. Priorizá lo que realmente vende la propiedad; variá la estructura entre los 3.\n"
        "7. NUNCA inventes datos. Si un dato no está, no lo menciones.\n\n"
        "Orden de prioridad de la información: 1) Tipo de propiedad, 2) Operación, "
        "3) Ciudad, 4) Cantidad de ambientes/dormitorios, 5) Diferencial principal, "
        "6) Característica única.\n\n"
        "Respondé SOLO con un array JSON de 3 strings, sin texto adicional, sin markdown. "
        'Ejemplo de formato: ["Título uno", "Título dos", "Título tres"]'
    )


def _build_user_message(mode: str, p: dict) -> str:
    facts = _known_facts(p)
    facts_block = "\n".join(f"- {f}" for f in facts) if facts else "- (Sin datos suficientes)"
    if mode == "title":
        return (
            "Datos disponibles de la propiedad (usá solo estos, no inventes):\n"
            f"{facts_block}\n\n"
            "Generá los 3 títulos siguiendo todas las reglas."
        )
    raise ValueError(f"Modo no soportado: {mode}")


def _parse_titles(raw: str) -> list[str]:
    """Robustly extract up to 3 clean, deduped title strings from the model output."""
    text = (raw or "").strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:]
        text = text.strip()

    items: list[str] = []
    try:
        data = json.loads(text)
        if isinstance(data, list):
            items = [str(x) for x in data]
    except (json.JSONDecodeError, ValueError):
        start, end = text.find("["), text.rfind("]")
        if start != -1 and end != -1 and end > start:
            try:
                data = json.loads(text[start : end + 1])
                if isinstance(data, list):
                    items = [str(x) for x in data]
            except (json.JSONDecodeError, ValueError):
                items = []
        if not items:
            for line in text.splitlines():
                line = line.strip().lstrip("-•*0123456789.").strip().strip('"').strip()
                if line:
                    items.append(line)

    cleaned: list[str] = []
    seen = set()
    for it in items:
        t = it.strip().strip('"').strip()
        if t and t.lower() not in seen:
            seen.add(t.lower())
            cleaned.append(t[:80])
    return cleaned[:3]


async def generate_content(mode: str, property_data: dict) -> list[str]:
    if mode not in SUPPORTED_MODES:
        raise ValueError(f"Modo no soportado: {mode}")
    if not config.ai_configured():
        raise RuntimeError("La IA de VERA no está configurada.")

    chat = LlmChat(
        api_key=config.EMERGENT_LLM_KEY,
        session_id=f"vera-{mode}-{uuid.uuid4()}",
        system_message=_title_system_message(),
    ).with_model(MODEL_PROVIDER, MODEL_NAME)

    user_message = UserMessage(text=_build_user_message(mode, property_data))
    response = await chat.send_message(user_message)
    suggestions = _parse_titles(response)
    logger.info("VERA %s: generated %d suggestions", mode, len(suggestions))
    return suggestions
