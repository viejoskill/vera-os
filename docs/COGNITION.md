# El Modelo Cognitivo de VERA

Esta es la arquitectura conceptual permanente de VERA. **No depende de inmobiliarias,
de Arturito ni de un modelo de IA concreto.** Puede mantenerse durante años aunque
cambien los modelos de IA o las integraciones. Es lo que hace de VERA un sistema
operativo comercial y no una herramienta más.

```
Knowledge   →  Lo que VERA sabe.        (del negocio: filosofía, arquitectura, cartera)
Memory      →  Lo que VERA aprendió.    (trabajando con este usuario: decisiones, preferencias…)
Goals       →  Lo que VERA intenta lograr.  (el objetivo actual del usuario)
Brain       →  Cómo VERA razona.        (orquesta Knowledge + Memory + Goals)
Insights    →  Lo que VERA descubre.    (oportunidades, riesgos, recomendaciones)
Actions     →  Lo que VERA propone.     (próximos pasos; nunca impone)
User        →  Quien decide y ejecuta.  (VERA sugiere, el usuario decide)
```

## Principios permanentes
- **Knowledge ≠ Memory.** Knowledge responde "¿qué sabe VERA?"; Memory responde "¿qué
  aprendió VERA?". Se mantienen separados siempre.
- **El razonamiento SIEMPRE es en función de un objetivo (Goals).** VERA no razona en el
  vacío: prioriza lo que acerca al objetivo actual del usuario.
- **Memory nunca guarda conversaciones completas** (eso es del ConversationProvider).
  Sólo guarda lo que tiene valor futuro: decisiones, preferencias, relaciones, contexto,
  patrones.
- **Memory visible debe sentirse como conocimiento útil**, no como un log técnico.
  Ejemplos válidos: "Prefiere WhatsApp", "Ya recibió info de esta propiedad", "Está
  comparando con otra opción", "Suele responder por la tarde". No mostrar recuerdos
  irrelevantes.
- **VERA propone, el usuario decide.** Siempre.

## Contratos que sostienen el modelo (drivers — ver PROVIDERS.md)
`AIProvider`, `KnowledgeSource`, `ConversationProvider`, `MessagingProvider`,
`StorageProvider`, `PropertyProvider`. VERA depende de estos contratos, nunca de una
marca concreta.

## App Personas (próximo gran paso)
Una Persona no es una ficha de contacto: es una **entidad completa** que reúne
conversaciones, propiedades, visitas, tareas, memoria, insights, historial y relación.
App Personas será el CENTRO de toda la relación comercial. La memoria por Persona ya está
habilitada vía `memory.for_subject(persona)`.
