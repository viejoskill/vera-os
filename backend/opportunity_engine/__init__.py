"""Opportunity Engine — primer módulo de inteligencia comercial de VERA.

VERA no toma decisiones: detecta oportunidades y SUGIERE acciones. El humano
siempre decide y aprueba. Nunca envía mensajes automáticamente.

Arquitectura desacoplada (crece por capacidades):
- OpportunityRule        → una regla de detección (transparente y configurable)
- ConversationRepository → fuente de conversaciones (hoy MOCK; mañana Arturito)
- OpportunityEngine      → corre las reglas sobre las fuentes y devuelve Opportunity[]
"""
