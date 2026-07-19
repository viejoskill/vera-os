"""Fuente de conversaciones para las reglas del Insights Engine.

DATOS DE EJEMPLO (MOCK): Arturito/WhatsApp aún no entregan conversaciones reales.
Cuando lo hagan, se implementa `ConversationRepository` contra esa fuente sin
tocar el motor ni las reglas.
"""
from abc import ABC, abstractmethod
from datetime import datetime, timedelta, timezone


class ConversationRepository(ABC):
    @abstractmethod
    def list_conversations(self) -> list[dict]:
        ...


def _ago(hours: float) -> str:
    return (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()


class MockConversationRepository(ConversationRepository):
    def list_conversations(self) -> list[dict]:
        return [
            {
                "id": "conv-juan", "contact_id": "c-juan", "contact_name": "Juan Pérez",
                "property_label": "el departamento de 3 ambientes en Costa del Este", "status": "open",
                "messages": [
                    {"sender": "client", "text": "Hola, me interesa. ¿Cuánto sale?", "at": _ago(56)},
                    {"sender": "agent", "text": "Hola Juan, sale US$ 145.000.", "at": _ago(55)},
                    {"sender": "client", "text": "Perfecto, me gustaría coordinar una visita", "at": _ago(50)},
                ],
            },
            {
                "id": "conv-maria", "contact_id": "c-maria", "contact_name": "María González",
                "property_label": "la casa con pileta cerca del mar", "status": "open",
                "messages": [
                    {"sender": "client", "text": "Buenas, ¿en qué zona/barrio está? Soy María", "at": _ago(60)},
                    {"sender": "agent", "text": "Hola María, está a 4 cuadras del mar.", "at": _ago(59)},
                    {"sender": "client", "text": "¿Tienen opciones de financiación en cuotas?", "at": _ago(54)},
                ],
            },
            {
                "id": "conv-sofia", "contact_id": "c-sofia", "contact_name": "Sofía Ramírez",
                "property_label": "el PH a estrenar", "status": "open",
                "messages": [
                    {"sender": "client", "text": "Hola, me llamo Sofía. Quiero visitar el PH", "at": _ago(80)},
                    {"sender": "agent", "text": "Genial, ¿te va bien el sábado?", "at": _ago(79)},
                    {"sender": "client", "text": "Te adjunto mi documentación para avanzar", "at": _ago(74)},
                ],
            },
            {
                "id": "conv-carlos", "contact_id": "c-carlos", "contact_name": "Carlos Díaz",
                "property_label": "un terreno", "status": "open",
                "messages": [{"sender": "client", "text": "hola", "at": _ago(70)}],
            },
            {
                "id": "conv-lucia", "contact_id": "c-lucia", "contact_name": "Lucía Fernández",
                "property_label": "el monoambiente céntrico", "status": "open",
                "messages": [{"sender": "client", "text": "¿Cuál es el precio? ¿Puedo visitarlo?", "at": _ago(3)}],
            },
        ]


conversation_repository: ConversationRepository = MockConversationRepository()
