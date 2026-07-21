# VERA OS — Conversation Adapter Contract

## Qué es
El **Conversation Adapter Contract** es la interfaz permanente entre cualquier
motor conversacional y VERA Core. Es completamente **agnóstico del proveedor**:
VERA Core no conoce a Arturito, ni a WhatsApp, ni a Kommo. Sólo conoce eventos.

> Un adapter transforma conversaciones en eventos tipados y los envía a
> `POST /api/events`. Nada más. Toda la lógica de negocio vive en VERA Core.

Arturito es simplemente el **primer** adapter. Cualquier otro motor conversacional
futuro (WhatsApp Cloud, Kommo, HubSpot, un bot propio) debe poder enviar exactamente
los mismos eventos sin requerir ningún cambio en VERA Core.

## Responsabilidades (límite duro)
| Adapter conversacional | VERA Core |
|------------------------|-----------|
| Escuchar la conversación (WhatsApp/IG/web…) | Resolver la identidad de la persona (`PersonResolver`) |
| Interpretar intención y extraer datos | Persistir el evento inmutable (Event Store) |
| Emitir eventos tipados a `POST /api/events` | Ejecutar las proyecciones (Leads, Oportunidades, Tareas) |
| Identificarse con su `source` | Decidir qué acción sugerir (VERA propone, el humano decide) |

## El envelope (contrato)
```jsonc
{
  "type": "PropertyInquiry",          // uno de EVENT_TYPES
  "source": "arturito",               // id del adapter (arturito, whatsapp, kommo, website…)
  "occurredAt": "2026-06-01T12:00:00Z",
  "idempotencyKey": "wa-msg-123",     // dedupe: reenviar el mismo no duplica
  "contact": {                        // identificadores → PersonResolver
    "phone": "+54911...", "whatsapp": "...", "email": "...",
    "document": "...", "crmId": "...", "name": "María"
  },
  "subject": { "propertyId": "uuid", "propertyCode": "VAR-000123" },
  "payload": { "channel": "whatsapp", "scheduledAt": "..." }  // libre por tipo
}
```
- **camelCase** (también acepta snake_case).
- `event_version` lo agrega VERA (versionado del contrato).

## Tipos de evento (canónicos)
`PersonCreated`, `ConversationStarted`, `MessageReceived`, `PropertyInquiry`,
`VisitScheduled`, `PropertyVisited`, `OpportunityCreated`, `OfferSent`,
`PropertyReserved`, `PropertySold`.

## Qué hace VERA Core con cada evento (proyecciones)
Los eventos son inmutables; VERA construye entidades de negocio DERIVADAS
(read-models reconstruibles vía `POST /api/core/rebuild`):

| Evento | Lead | Oportunidad (persona+propiedad) | Tarea sugerida |
|--------|------|---------------------------------|----------------|
| `ConversationStarted` | crea/actualiza (nuevo) | — | — |
| `MessageReceived` | actualiza + suma mensaje | — | Responder a {persona} |
| `PropertyInquiry` | + interés en la propiedad | → `interes` | Contactar a {persona} por {propiedad} |
| `VisitScheduled` | → `calificado` | → `visita_agendada` | Confirmar visita con {persona} |
| `PropertyVisited` | → `calificado` | → `visitada` | Seguimiento post-visita |
| `OfferSent` | → `calificado` | → `oferta` | Seguir la oferta |
| `PropertyReserved` | → `convertido` | → `reserva` | — |
| `PropertySold` | → `convertido` | → `ganada` | — |

Reglas: los Leads sólo avanzan hacia adelante; las Oportunidades sólo avanzan de
etapa (nunca retroceden); las Tareas no se duplican (una pendiente por tipo,
persona y propiedad). Todo referencia a la persona por `person_id`.

## Endpoints
- `POST /api/events` — punto ÚNICO de ingesta (cualquier adapter).
- `GET  /api/events` — Event Log (stream técnico).
- `GET  /api/events/contract` — tipos + orígenes + versión vigentes.
- `GET  /api/core/leads | /api/core/opportunities | /api/core/tasks` — proyecciones.
- `PATCH /api/core/tasks/{id}` — el humano marca hecha/descartada.
- `PATCH /api/core/opportunities/{id}` — el humano mueve la etapa.
- `POST /api/core/rebuild` — reconstruye las proyecciones desde el stream.

## Cómo se conecta un adapter nuevo (sin tocar VERA Core)
1. El adapter escucha su canal y arma el envelope.
2. Se identifica con su `source` (si es nuevo, se agrega a `EVENT_SOURCES`).
3. Hace `POST /api/events`. Listo — VERA resuelve persona, persiste y proyecta.
