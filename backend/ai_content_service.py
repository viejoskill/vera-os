"""VERA content intelligence (LLM behind an abstraction).

Single reusable entry point `generate_content(mode, data)` for all content tasks:
- title       → 3 SEO titles (list)
- description → 1 professional description (text)
- highlights  → 4-6 concrete strength bullets (list)
- portal      → title + description adapted to a portal (mercadolibre / zonaprop)

The frontend never talks to the LLM — it only knows this backend service.
Product rule: VERA PROPONE, el profesional decide — this service only returns
SUGGESTIONS; it never mutates or auto-fills the property.
"""
import json
import logging
import uuid

from emergentintegrations.llm.chat import LlmChat, UserMessage

import config

logger = logging.getLogger("vera")

MODEL_PROVIDER = "gemini"
MODEL_NAME = "gemini-3-flash-preview"

SUPPORTED_MODES = ("title", "description", "highlights", "portal")
PORTALS = ("mercadolibre", "zonaprop")

TYPE_LABELS = {
    "departamento": "departamento",
    "casa": "casa",
    "ph": "PH",
    "terreno": "terreno",
    "oficina": "oficina",
    "local": "local",
}

ORIENTATION_LABELS = {
    "N": "orientación norte", "S": "orientación sur", "E": "orientación este",
    "O": "orientación oeste", "NE": "orientación noreste", "NO": "orientación noroeste",
    "SE": "orientación sudeste", "SO": "orientación sudoeste",
}

CONDITION_LABELS = {
    "a-estrenar": "a estrenar", "excelente": "estado excelente",
    "muy-bueno": "muy buen estado", "bueno": "buen estado", "a-reciclar": "a reciclar",
}


def _num(p: dict, *keys):
    for k in keys:
        v = p.get(k)
        try:
            n = float(v)
            if n > 0:
                return n
        except (TypeError, ValueError):
            continue
    return None


def _known_facts(p: dict) -> list[str]:
    """Only facts we actually have. VERA never invents data."""
    facts: list[str] = []
    ptype = TYPE_LABELS.get((p.get("type") or "").strip().lower())
    if ptype:
        facts.append(f"Tipo: {ptype}")
    operation = (p.get("operation") or "").strip().lower()
    if operation in ("venta", "alquiler"):
        facts.append(f"Operación: {'Venta' if operation == 'venta' else 'Alquiler'}")
    if (p.get("city") or "").strip():
        facts.append(f"Ciudad: {p['city'].strip()}")
    if (p.get("neighborhood") or "").strip():
        facts.append(f"Barrio: {p['neighborhood'].strip()}")
    if (p.get("address") or "").strip():
        facts.append(f"Dirección: {p['address'].strip()}")

    rooms = _num(p, "rooms")
    if rooms:
        facts.append(f"Ambientes: {int(rooms)}")
    bedrooms = _num(p, "bedrooms")
    if bedrooms:
        facts.append(f"Dormitorios: {int(bedrooms)}")
    bathrooms = _num(p, "bathrooms")
    if bathrooms:
        facts.append(f"Baños: {int(bathrooms)}")
    toilettes = _num(p, "toilettes")
    if toilettes:
        facts.append(f"Toilettes: {int(toilettes)}")

    covered = _num(p, "areaM2", "area_m2")
    if covered:
        facts.append(f"Superficie cubierta: {int(covered)} m²")
    semi = _num(p, "semiCoveredAreaM2", "semi_covered_area_m2")
    if semi:
        facts.append(f"Superficie semicubierta: {int(semi)} m²")
    lot = _num(p, "lotAreaM2", "lot_area_m2")
    if lot:
        facts.append(f"Superficie de lote: {int(lot)} m²")

    floors = _num(p, "floors")
    if floors:
        facts.append(f"Plantas: {int(floors)}")
    floor_number = _num(p, "floorNumber", "floor_number")
    if floor_number:
        facts.append(f"Piso: {int(floor_number)}")

    pc = _num(p, "parkingCovered", "parking_covered")
    if pc:
        facts.append(f"Cocheras cubiertas: {int(pc)}")
    pu = _num(p, "parkingUncovered", "parking_uncovered")
    if pu:
        facts.append(f"Cocheras descubiertas: {int(pu)}")

    orientation = ORIENTATION_LABELS.get((p.get("orientation") or "").strip().upper())
    if orientation:
        facts.append(f"Orientación: {orientation}")
    condition = CONDITION_LABELS.get((p.get("condition") or "").strip().lower())
    if condition:
        facts.append(f"Estado de conservación: {condition}")

    year = (p.get("yearBuilt") or p.get("year_built") or "").strip()
    if year:
        facts.append(f"Año de construcción: {year}")

    amenities = [a for a in (p.get("amenities") or []) if isinstance(a, str) and a.strip()]
    if amenities:
        facts.append(f"Amenities: {', '.join(amenities)}")

    if p.get("nearSea") or p.get("near_sea"):
        facts.append("Cercanía al mar: sí")

    return facts


def _facts_block(p: dict) -> str:
    facts = _known_facts(p)
    return "\n".join(f"- {f}" for f in facts) if facts else "- (Sin datos suficientes)"


# --------------------------- System messages ----------------------------- #

_COMMON = (
    "Sos VERA, un asistente experto en marketing inmobiliario para Argentina. "
    "Escribís en español rioplatense, natural y profesional. "
    "NUNCA inventes datos: si algo no está en la información provista, no lo menciones. "
    "PROHIBIDO usar frases genéricas vacías como 'hermosa', 'excelente oportunidad', "
    "'imperdible', 'soñada', 'única'. Priorizá información concreta y útil."
)

_SYS = {
    "title": (
        _COMMON + "\n\nGenerás títulos de publicación para portales. REGLAS: 3 títulos "
        "DISTINTOS entre sí (no el mismo cambiando una palabra), máximo 70 caracteres cada uno, "
        "sin mayúsculas innecesarias, priorizá tipo + operación + ciudad + ambientes + "
        "diferencial. Respondé SOLO con un array JSON de 3 strings, sin markdown."
    ),
    "description": (
        _COMMON + "\n\nRedactás la DESCRIPCIÓN de la publicación. Un solo texto de entre 600 y "
        "900 caracteres, en 2-3 párrafos cortos. Estructura: (1) presentación de la propiedad "
        "(tipo, ambientes, superficies), (2) comodidades y amenities relevantes, (3) entorno/"
        "ubicación y cierre invitando a coordinar una visita. Tono profesional y cálido. "
        "Respondé SOLO con el texto de la descripción, sin títulos, sin comillas, sin markdown."
    ),
    "highlights": (
        _COMMON + "\n\nGenerás DESTACADOS: entre 4 y 6 bullets cortos (máx. 60 caracteres cada "
        "uno) con las fortalezas concretas de la propiedad, derivados de sus características y "
        "amenities. Cada bullet es un beneficio puntual (ej.: 'Parrilla y quincho para recibir', "
        "'A metros del mar', '3 dormitorios amplios'). Respondé SOLO con un array JSON de strings."
    ),
}

_PORTAL_SYS = {
    "mercadolibre": (
        _COMMON + "\n\nAdaptás la publicación al formato de MERCADO LIBRE Inmuebles. "
        "El título: claro y directo, máximo 60 caracteres. La descripción: estructurada, "
        "fácil de escanear, en párrafos cortos; NO incluyas teléfonos, emails, links ni datos "
        "de contacto (están prohibidos por la política de ML). Destacá ambientes, superficies, "
        "amenities y ubicación. Respondé SOLO con un objeto JSON: "
        '{"title": "...", "description": "..."} sin markdown.'
    ),
    "zonaprop": (
        _COMMON + "\n\nAdaptás la publicación al formato de ZONAPROP. El título: atractivo y "
        "profesional, máximo 70 caracteres. La descripción: fluida y bien redactada, destacando "
        "ubicación, diferenciales y estilo de vida, en 2-3 párrafos. Respondé SOLO con un objeto "
        'JSON: {"title": "...", "description": "..."} sin markdown.'
    ),
}


def _user_message(mode: str, p: dict) -> str:
    block = _facts_block(p)
    if mode in ("title", "description", "highlights"):
        return f"Datos disponibles de la propiedad (usá solo estos):\n{block}\n\nGenerá el contenido siguiendo las reglas."
    if mode == "portal":
        current_title = (p.get("title") or "").strip()
        current_desc = (p.get("description") or "").strip()
        extra = ""
        if current_title:
            extra += f"\nTítulo actual: {current_title}"
        if current_desc:
            extra += f"\nDescripción actual: {current_desc}"
        return (
            f"Datos disponibles de la propiedad (usá solo estos):\n{block}{extra}\n\n"
            "Adaptá título y descripción al portal indicado."
        )
    raise ValueError(f"Modo no soportado: {mode}")


# ------------------------------ Parsing ---------------------------------- #

def _strip_fences(text: str) -> str:
    t = (text or "").strip()
    if t.startswith("```"):
        t = t.strip("`")
        if t.lower().startswith("json"):
            t = t[4:]
    return t.strip()


def _parse_list(raw: str, limit: int) -> list[str]:
    text = _strip_fences(raw)
    items: list[str] = []
    try:
        data = json.loads(text)
        if isinstance(data, list):
            items = [str(x) for x in data]
    except (json.JSONDecodeError, ValueError):
        start, end = text.find("["), text.rfind("]")
        if start != -1 and end > start:
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
    cleaned, seen = [], set()
    for it in items:
        t = it.strip().strip('"').strip()
        if t and t.lower() not in seen:
            seen.add(t.lower())
            cleaned.append(t)
    return cleaned[:limit]


def _parse_portal(raw: str) -> dict:
    text = _strip_fences(raw)
    try:
        data = json.loads(text)
    except (json.JSONDecodeError, ValueError):
        start, end = text.find("{"), text.rfind("}")
        data = {}
        if start != -1 and end > start:
            try:
                data = json.loads(text[start : end + 1])
            except (json.JSONDecodeError, ValueError):
                data = {}
    if isinstance(data, dict):
        return {
            "title": str(data.get("title", "")).strip(),
            "body": str(data.get("description", data.get("body", ""))).strip(),
        }
    return {"title": "", "body": text.strip()}


# ------------------------------ Entry ------------------------------------ #

async def generate_content(mode: str, data: dict) -> dict:
    """Returns {suggestions: list[str], title: str, body: str}."""
    if mode not in SUPPORTED_MODES:
        raise ValueError(f"Modo no soportado: {mode}")
    if not config.ai_configured():
        raise RuntimeError("La IA de VERA no está configurada.")

    if mode == "portal":
        portal = (data.get("portal") or "").strip().lower()
        if portal not in PORTALS:
            raise ValueError(f"Portal no soportado: {portal}")
        system_message = _PORTAL_SYS[portal]
    else:
        system_message = _SYS[mode]

    chat = LlmChat(
        api_key=config.EMERGENT_LLM_KEY,
        session_id=f"vera-{mode}-{uuid.uuid4()}",
        system_message=system_message,
    ).with_model(MODEL_PROVIDER, MODEL_NAME)

    response = await chat.send_message(UserMessage(text=_user_message(mode, data)))

    result = {"suggestions": [], "title": "", "body": ""}
    if mode == "title":
        result["suggestions"] = _parse_list(response, 3)
    elif mode == "highlights":
        result["suggestions"] = _parse_list(response, 6)
    elif mode == "description":
        text = _strip_fences(response).strip().strip('"').strip()
        result["suggestions"] = [text] if text else []
    elif mode == "portal":
        parsed = _parse_portal(response)
        result["title"] = parsed["title"]
        result["body"] = parsed["body"]

    logger.info("VERA %s: generated", mode)
    return result
