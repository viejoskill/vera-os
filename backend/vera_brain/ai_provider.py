"""AIProvider — detalle INTERNO de implementación de VERA Brain.

El sistema nunca depende de Claude directamente: depende de esta interfaz.
Cambiar de proveedor (Claude → OpenAI/Gemini/OpenRouter) es implementar
`AIProvider` y cambiar `active_provider`. Nada más del sistema se toca.
"""
import uuid
from abc import ABC, abstractmethod

from emergentintegrations.llm.chat import LlmChat, UserMessage

import config


class AIProvider(ABC):
    @abstractmethod
    async def reason(self, system: str, prompt: str, session_id: str | None = None) -> str:
        """Razona sobre un prompt con un contexto (system) y devuelve texto."""


class ClaudeProvider(AIProvider):
    """Proveedor inicial: Claude Sonnet vía Emergent LLM Key. INTERNO — el usuario
    nunca sabe que por detrás hay Claude; para el usuario, la inteligencia es VERA."""

    provider = "anthropic"
    model = "claude-sonnet-4-6"

    async def reason(self, system: str, prompt: str, session_id: str | None = None) -> str:
        chat = LlmChat(
            api_key=config.EMERGENT_LLM_KEY,
            session_id=session_id or f"vera-brain-{uuid.uuid4()}",
            system_message=system,
        ).with_model(self.provider, self.model)
        return await chat.send_message(UserMessage(text=prompt))


# Único punto de acoplamiento del proveedor. Cambiarlo = cambiar esta línea.
active_provider: AIProvider = ClaudeProvider()
