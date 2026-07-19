"""RelationshipService — ensambla la vista 360° de cada Persona desde las fuentes.

Hoy las Personas se DERIVAN de las conversaciones (bridge hasta tener un PersonProvider
real / App Personas). Cruza cada relación con la cartera real (matching por tokens),
la memoria propia y los insights. VERA Brain consume esto vía RelationshipKnowledgeSource.
"""
from __future__ import annotations

import re

from conversations.types import Conversation
from properties.types import Property

from .types import Person, RelationshipSnapshot

_STOP = {
    "de", "el", "la", "en", "con", "un", "una", "que", "los", "las", "del", "para", "por",
    "hola", "cuanto", "sale", "interesa", "quiero", "busco", "sobre", "esta", "este", "mas",
}


def _tokens(s: str) -> set[str]:
    return {w for w in re.findall(r"[a-záéíóúñ0-9]+", (s or "").lower()) if len(w) > 2 and w not in _STOP}


def match_properties(conv_text: str, city_hint: str, props: list[Property], limit: int = 3) -> list[Property]:
    """Cruza lo que pidió la persona con la cartera real (matching liviano por tokens)."""
    want = _tokens(conv_text)
    hay_hint = conv_text.lower()
    scored: list[tuple[int, Property]] = []
    for p in props:
        hay = _tokens(f"{p.title} {p.type} {p.city} {p.neighborhood} {p.operation}")
        score = len(want & hay)
        if p.city and p.city.lower() in hay_hint:
            score += 2
        if score > 0:
            scored.append((score, p))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [p for _, p in scored[:limit]]


class RelationshipService:
    async def all_snapshots(self) -> list[RelationshipSnapshot]:
        # Import diferido: evita acoplar el módulo en import time.
        from conversations.provider import active_conversation_provider
        from insights_engine.engine import engine
        from properties.provider import active_property_provider
        from vera_brain.goals import goals
        from vera_brain.memory import memory

        convs = [c for c in await active_conversation_provider.list_conversations() if c.status == "open"]
        props = await active_property_provider.list_properties()
        try:
            insights = await engine.detect()
        except Exception:  # noqa: BLE001
            insights = []
        active_goals = goals.active()

        groups: dict[str, list[Conversation]] = {}
        for c in convs:
            key = c.contact.phone or c.contact.name or c.id
            groups.setdefault(key, []).append(c)

        snapshots: list[RelationshipSnapshot] = []
        for key, cs in groups.items():
            name = cs[0].contact.name
            person = Person(
                id=cs[0].contact.id or key,
                name=name,
                phone=cs[0].contact.phone,
                channels=sorted({c.channel for c in cs}),
                lead_status=cs[0].lead_status,
                tags=sorted({t for c in cs for t in c.tags}),
            )
            text = " ".join(f"{c.property_label} {c.client_text}" for c in cs)
            matched: dict[str, Property] = {}
            for p in match_properties(text, "", props):
                matched[p.id] = p
            mem = memory.for_subject(name) if name else []
            ins = [i.model_dump() for i in insights if name and name.lower() in (i.title or "").lower()]
            gls = [g for g in active_goals if name and name.lower() in f"{g.title} {g.subject}".lower()]
            snapshots.append(RelationshipSnapshot(
                person=person, conversations=cs, interested_properties=list(matched.values()),
                memory=mem, insights=ins, goals=gls,
            ))
        return snapshots

    async def snapshot(self, query: str) -> RelationshipSnapshot | None:
        q = (query or "").strip().lower()
        if not q:
            return None
        for s in await self.all_snapshots():
            if q in s.person.name.lower() or (s.person.phone and q == s.person.phone):
                return s
        return None


relationship_service = RelationshipService()
