"""OpportunityEngine — corre las reglas sobre las conversaciones y devuelve las
oportunidades sugeridas, ordenadas por prioridad. Desacoplado del proveedor de IA
y de la fuente de datos."""
from abc import ABC, abstractmethod

from .repository import ConversationRepository, conversation_repository
from .rules import FollowUpRule, OpportunityRule
from .types import Opportunity

_PRIORITY_ORDER = {"high": 0, "medium": 1, "low": 2}


class OpportunityEngine(ABC):
    @abstractmethod
    def detect(self) -> list[Opportunity]:
        ...


class RuleBasedOpportunityEngine(OpportunityEngine):
    def __init__(self, repository: ConversationRepository, rules: list[OpportunityRule]):
        self.repository = repository
        self.rules = rules

    def detect(self) -> list[Opportunity]:
        found: list[Opportunity] = []
        for conversation in self.repository.list_conversations():
            for rule in self.rules:
                opp = rule.evaluate(conversation)
                if opp:
                    found.append(opp)
        found.sort(key=lambda o: (_PRIORITY_ORDER.get(o.priority, 9), -o.hours_since_last))
        return found


# Motor activo. Sumar capacidades = registrar más reglas acá (roadmap):
# nuevas propiedades compatibles, vendedores sin seguimiento, publicaciones con
# bajo rendimiento, propietarios esperando tasación, tareas pendientes.
engine: OpportunityEngine = RuleBasedOpportunityEngine(
    repository=conversation_repository,
    rules=[FollowUpRule()],
)
