"""VERA Brain — el orquestador. Arma el contexto (Knowledge Hub + Memory + identidad),
delega el razonamiento al AIProvider y devuelve la respuesta como VERA.

Principio de producto inquebrantable: el usuario SIEMPRE habla con VERA, nunca con
Claude. El proveedor es un componente interno e invisible.
"""
from datetime import datetime, timedelta, timezone

from .ai_provider import active_provider
from .goals import goals
from .knowledge import hub
from .memory import memory
from .studio import STUDIO_IDENTITY

AR_TZ = timezone(timedelta(hours=-3))

IDENTITY = (
    "Sos VERA, el sistema operativo inteligente para profesionales inmobiliarios "
    "en Argentina. Tu misión es ser el único lugar desde donde el profesional trabaja "
    "todos los días.\n\n"
    "REGLAS DE PRODUCTO (obligatorias):\n"
    "1. SOS VERA. Nunca te presentes como Claude, ni menciones el modelo, proveedor o "
    "empresa que te impulsa. Si te preguntan qué modelo sos, respondé que sos la "
    "inteligencia de VERA. Para el usuario, la inteligencia SIEMPRE es VERA.\n"
    "2. Hablás en español rioplatense, cálido, claro y profesional. Sin relleno.\n"
    "3. VERA orquesta herramientas, no las reemplaza.\n"
    "4. Nunca inventes datos. Si algo no está en tu conocimiento o contexto, decilo con "
    "honestidad y, si corresponde, indicá qué integración lo habilitaría.\n"
    "5. VERA propone, el usuario decide. Ofrecé próximos pasos, no imposiciones.\n"
    "6. Razoná SIEMPRE en función del OBJETIVO actual del usuario (Goals): priorizá lo que "
    "lo acerca a ese objetivo. Si no hay objetivo definido, podés sugerir definir uno.\n"
)


async def _system(mode: str = "vera") -> str:
    identity = STUDIO_IDENTITY if mode == "studio" else IDENTITY
    extra = ""
    if mode == "studio":
        from .training import get_training

        training = await get_training()
        if training.strip():
            extra = (
                "\n\n===== ENTRENAMIENTO / PERSONALIZACIÓN (definido por el equipo, prioridad alta) =====\n"
                + training.strip()
            )
    return (
        identity
        + extra
        + "\n\n===== OBJETIVO ACTUAL DEL USUARIO (GOALS) =====\n"
        + goals.as_context()
        + "\n\n===== KNOWLEDGE HUB (tu conocimiento) =====\n"
        + await hub.knowledge()
        + "\n\n===== MEMORIA PROPIA DE VERA (lo que aprendió) =====\n"
        + memory.as_context()
    )


class VeraBrain:
    async def ask(self, question: str, session_id: str | None = None, mode: str = "vera") -> str:
        return await active_provider.reason(await _system(mode), question, session_id)

    async def ask_stream(self, question: str, session_id: str | None = None, mode: str = "vera"):
        system = await _system(mode)
        async for chunk in active_provider.stream(system, question, session_id):
            yield chunk

    async def today_briefing(self, business_context: str = "") -> str:
        now = datetime.now(AR_TZ)
        system = await _system()
        prompt = (
            f"Son las {now.strftime('%H:%M')} del {now.strftime('%d/%m/%Y')}. "
            "Generá un resumen de '¿Qué pasó hoy?' para el profesional inmobiliario, en "
            "4 a 6 bullets accionables y concretos. Usá SOLO el contexto disponible. "
            "Las fuentes de comunicación (Gmail, Meta, Arturito) todavía no están conectadas "
            "con datos reales: NO inventes cifras; en su lugar, mencioná brevemente qué te va a "
            "permitir cada integración cuando se conecte, y cerrá con una sugerencia de en qué "
            "enfocarse hoy según la filosofía de VERA y la cartera real de propiedades.\n\n"
            "## Contexto de negocio disponible\n" + (business_context or "(Ver Knowledge Hub arriba.)")
        )
        return await active_provider.reason(system, prompt)


brain = VeraBrain()
