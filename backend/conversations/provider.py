"""ConversationProvider — el CONTRATO permanente (driver) de conversaciones.

VERA sólo conoce esta interfaz. NUNCA conoce a Arturito, WhatsApp Cloud, Kommo,
HubSpot, Tokko ni EasyBroker. Conectar un proveedor real = implementar esta
interfaz y cambiar `active_conversation_provider` (1 línea). VERA Brain, el Insights
Engine y la UI no se tocan.

Implementaciones futuras posibles (drivers):
  - ArturitoProvider          (si Arturito habilita API/webhooks/export)
  - WhatsAppCloudProvider     (Meta WhatsApp Business Cloud API)
  - KommoProvider / HubSpotProvider   (CRMs con inbox)
  - TokkoProvider / EasyBrokerProvider (CRMs inmobiliarios)
"""
from abc import ABC, abstractmethod
from datetime import datetime, timedelta, timezone

from .types import Contact, Conversation, ConversationMessage


class ConversationProvider(ABC):
    id: str
    label: str

    @abstractmethod
    async def list_conversations(self) -> list[Conversation]:
        """Todas las conversaciones disponibles del proveedor (traducidas al dominio)."""

    @abstractmethod
    async def get_conversation(self, conversation_id: str) -> Conversation | None:
        """Historial completo de una conversación por su id, o None si no existe."""

    @abstractmethod
    async def find_by_phone(self, phone: str) -> Conversation | None:
        """Ubica una conversación por teléfono del contacto, o None."""


def _ago(hours: float) -> str:
    return (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()


class MockConversationProvider(ConversationProvider):
    """STAND-IN temporal (driver de prueba). Datos de EJEMPLO — no representa a ningún
    proveedor real. Sólo satisface el contrato para que VERA funcione end-to-end hasta
    conectar un proveedor real. Se descarta implementando la interfaz, sin tocar nada más.
    """

    id = "mock"
    label = "Conversaciones (datos de ejemplo)"

    def _seed(self) -> list[Conversation]:
        return [
            Conversation(
                id="conv-juan", channel="whatsapp", property_label="el departamento de 3 ambientes en Costa del Este",
                status="open", lead_status="calificado", tags=["visita", "precio"],
                contact=Contact(id="c-juan", name="Juan Pérez", phone="5492255401234"),
                messages=[
                    ConversationMessage(sender="client", text="Hola, me interesa. ¿Cuánto sale?", at=_ago(56)),
                    ConversationMessage(sender="agent", text="Hola Juan, sale US$ 145.000.", at=_ago(55)),
                    ConversationMessage(sender="client", text="Perfecto, me gustaría coordinar una visita", at=_ago(50)),
                ],
            ),
            Conversation(
                id="conv-maria", channel="whatsapp", property_label="la casa con pileta cerca del mar",
                status="open", lead_status="nuevo", tags=["financiación", "ubicación"],
                contact=Contact(id="c-maria", name="María González", phone="5492255405678"),
                messages=[
                    ConversationMessage(sender="client", text="Buenas, ¿en qué zona/barrio está? Soy María", at=_ago(60)),
                    ConversationMessage(sender="agent", text="Hola María, está a 4 cuadras del mar.", at=_ago(59)),
                    ConversationMessage(sender="client", text="¿Tienen opciones de financiación en cuotas?", at=_ago(54)),
                ],
            ),
            Conversation(
                id="conv-sofia", channel="instagram", property_label="el PH a estrenar",
                status="open", lead_status="calificado", tags=["visita", "documentación"],
                contact=Contact(id="c-sofia", name="Sofía Ramírez", phone="5492255409012"),
                messages=[
                    ConversationMessage(sender="client", text="Hola, me llamo Sofía. Quiero visitar el PH", at=_ago(80)),
                    ConversationMessage(sender="agent", text="Genial, ¿te va bien el sábado?", at=_ago(79)),
                    ConversationMessage(sender="client", text="Te adjunto mi documentación para avanzar", at=_ago(74)),
                ],
            ),
            Conversation(
                id="conv-carlos", channel="web", property_label="un terreno", status="open", lead_status="frío",
                contact=Contact(id="c-carlos", name="Carlos Díaz"),
                messages=[ConversationMessage(sender="client", text="hola", at=_ago(70))],
            ),
            Conversation(
                id="conv-lucia", channel="whatsapp", property_label="el monoambiente céntrico", status="open",
                lead_status="nuevo", contact=Contact(id="c-lucia", name="Lucía Fernández"),
                messages=[ConversationMessage(sender="client", text="¿Cuál es el precio? ¿Puedo visitarlo?", at=_ago(3))],
            ),
        ]

    async def list_conversations(self) -> list[Conversation]:
        return self._seed()

    async def get_conversation(self, conversation_id: str) -> Conversation | None:
        return next((c for c in self._seed() if c.id == conversation_id), None)

    async def find_by_phone(self, phone: str) -> Conversation | None:
        return next((c for c in self._seed() if c.contact.phone == phone), None)


# Punto ÚNICO de acoplamiento del proveedor (como `active_provider` de AI).
# Cambiar de driver = cambiar SÓLO esta línea.
active_conversation_provider: ConversationProvider = MockConversationProvider()
