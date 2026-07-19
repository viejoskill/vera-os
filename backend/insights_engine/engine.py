"""InsightsEngine — corre las reglas y devuelve los insights ordenados por
prioridad. Desacoplado del proveedor de IA y de las fuentes de datos."""
from abc import ABC, abstractmethod

from .repository import conversation_repository
from .rules import FollowUpRule, InsightRule, PropertyHealthRule
from .types import Insight

_PRIORITY_ORDER = {"high": 0, "medium": 1, "low": 2}
_TYPE_ORDER = {"priority": 0, "risk": 1, "opportunity": 2, "recommendation": 3, "reminder": 4, "task": 5}


class InsightsEngine(ABC):
    @abstractmethod
    async def detect(self) -> list[Insight]:
        ...


class RuleBasedInsightsEngine(InsightsEngine):
    def __init__(self, rules: list[InsightRule]):
        self.rules = rules

    async def detect(self) -> list[Insight]:
        found: list[Insight] = []
        for rule in self.rules:
            found.extend(await rule.detect())
        found.sort(key=lambda i: (_PRIORITY_ORDER.get(i.priority, 9), _TYPE_ORDER.get(i.type, 9)))
        return found


# Motor activo. Roadmap = registrar más reglas (nuevas propiedades compatibles,
# vendedores sin seguimiento, publicaciones con bajo rendimiento, tasaciones, tareas).
engine: InsightsEngine = RuleBasedInsightsEngine(
    rules=[FollowUpRule(conversation_repository), PropertyHealthRule()],
)
