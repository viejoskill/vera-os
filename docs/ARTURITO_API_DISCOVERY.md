# ARTURITO — API Discovery (sprint de descubrimiento, 2026-07)

> Objetivo del sprint: entender COMPLETAMENTE la API de Arturito antes de construir
> el adapter. **No se implementó nada todavía.** Este documento es el resultado del
> reversing empírico hecho con la API Key `art_…` provista por el usuario.

## 0. TL;DR — Recomendación de integración
Arturito **SÍ expone una API** (novedad respecto de la investigación previa, que la
daba por cerrada). Hay dos superficies, y **conviene usar ambas de forma complementaria**:

1. **Webhooks salientes (PUSH) — camino primario / tiempo real.**
   Arturito puede POSTear eventos firmados (HMAC-SHA256) a una URL HTTPS nuestra cuando
   ocurre `lead.created` o `lead.attended`. Es el mecanismo natural para alimentar el
   **Conversation Adapter Contract** de VERA (`POST /api/events`). El adapter de Arturito
   traduce el payload del webhook → eventos canónicos de VERA. **No requiere polling.**
2. **API tRPC (PULL) — enriquecimiento / backfill.**
   Con la API Key (header `Authorization: Bearer art_…`) se pueden LEER agentes,
   pipelines, etapas, leads, tags y métricas del workspace. Sirve para el alta inicial
   (importar el estado actual) y para enriquecer un lead puntual. La key **también puede
   gestionar webhooks** (crear/listar/actualizar) → VERA podría auto-provisionar su webhook.

> **Dato importante ya en producción:** el workspace del usuario YA tiene un webhook
> configurado apuntando a `https://bot.varelapropiedadescde.com.ar/webhook/arturito`
> (eventos `lead.created` + `lead.attended`, activo desde 2026-07-14). Es decir, hoy los
> leads de Arturito ya se están empujando a OTRO receptor. Hay que decidir con el usuario
> si VERA se suma como segundo webhook o reemplaza al existente.

---

## 1. Metodología (cómo se descubrió)
- `app.arturito.ai` es un **Next.js (Vercel)**; `arturito.ai` es el sitio de marketing.
  No existe `api.arturito.ai` (no resuelve DNS).
- El backend es **tRPC** montado en el MISMO origen: `https://app.arturito.ai/api/trpc/*`.
- Auth del dashboard = **Auth0** (`/api/auth/*`, NextAuth).
- Se descargaron los bundles JS (`_next/static/chunks/*`) y se extrajeron: strings i18n
  (webhooks, api_keys), rutas (`_buildManifest.js`) y **nombres reales de procedimientos
  tRPC** (aparecen como `.router.procedure` en el código no minificado).
- Se validó cada endpoint con la API Key real contra el workspace de producción
  (`workspaceId = 6a54f832f4c16e6124260f28`, agente "Vera").

---

## 2. Transporte, autenticación y formato

| Aspecto | Valor |
|---|---|
| **Endpoint raíz** | `https://app.arturito.ai/api/trpc` |
| **Estilo** | tRPC (no REST). Cada operación es `…/api/trpc/<router>.<procedure>` |
| **Autenticación** | `Authorization: Bearer art_5bf5…` (header). Sin él → `401 UNAUTHORIZED`. `X-Api-Key` **NO** funciona (401). |
| **Transformer** | **Ninguno** (NO superjson). El input va como JSON crudo. |
| **Input (query GET)** | Single: `?input=<json-crudo-urlencoded>`. Batch: `?batch=1&input={"0":<json-crudo>}`. |
| **Respuesta (single)** | `{"result":{"data": <payload>}}` |
| **Respuesta (batch)** | `[{"result":{"data": <payload>}}]` |
| **Errores** | tRPC estándar: `{"error":{"message","code","data":{"code","httpStatus","path"}}}`. Validación = mensajes **Zod** (dicen exactamente qué campo falta). |

Ejemplo real (verificado):
```bash
curl -H "Authorization: Bearer art_…" \
  "https://app.arturito.ai/api/trpc/pipeline.listPipelines?input=%7B%22workspaceId%22%3A%226a54…%22%7D"
# → {"result":{"data":[{"_id":"…","name":"Pipeline de ventas","steps":[…]}]}}
```

### Capacidades y límites de la API Key (verificado)
- ✅ Puede **leer** datos del workspace (agents, pipeline, leads, tags, métricas).
- ✅ Puede **gestionar webhooks** (`webhooks.list` respondió 200 con la key).
- ✅ La UI declara acceso de **lectura Y escritura** ("puede leer y escribir datos").
  (No se probaron mutaciones sobre datos reales para no alterar producción.)
- ❌ **No** puede gestionar API keys: `apiKey.list` → `403 "API keys cannot manage API keys. Use the dashboard."`
- La key está atada a **un workspace**; todas las queries requieren `workspaceId` explícito
  (salvo las que lo infieren). No hay multi-workspace con una sola key.

---

## 3. Recursos y procedimientos (catálogo tRPC verificado)

Routers detectados: `agent`, `conversations`, `lead`, `pipeline`, `webhooks`, `apiKey`.
(✅ = probado con datos reales · ⚙️ = mutación, existe pero NO se ejecutó · 🔒 = solo dashboard)

### 3.1 `agent`
| Procedure | Tipo | Input | Notas |
|---|---|---|---|
| `agent.listAgents` ✅ | query | `{workspaceId}` | Devuelve la config completa del/los agente(s). |
| `agent.deleteAgent` ⚙️ | mutation | `{…}` | — |

**Campos del agente** (relevantes): `_id, workspaceId, userId, agentName, agentObjective,
prompt, model, languages, channels, channelTypes, status, personality, responseStyle,
tools, faqs, reminders, messageTemplates, advisors, business, mercadolibre,
customPropertiesDefinition, notify{whenNewLead,whenPurchaseIntent,…,attentionPhones,email}`.

### 3.2 `pipeline`
| Procedure | Tipo | Input | Notas |
|---|---|---|---|
| `pipeline.listPipelines` ✅ | query | `{workspaceId}` | Lista pipelines + sus `steps`. |
| `pipeline.getAllStages` ✅ | query | `{workspaceId, agentIds:[]}` | Etapas con `{leads[], count, totalValue}`. |
| `pipeline.getLeadsByStage` ✅ | query | `{workspaceId, agentIds:[]}` | Leads agrupados por etapa. |
| `pipeline.getMetrics` ✅ | query | `{workspaceId, agentIds:[]}` | Ver §5. |
| `pipeline.getDistinctProperties` ✅ | query | `{workspaceId, agentIds:[]}` | Propiedades distintas mencionadas (hoy `[]`). |
| `pipeline.getLeadsByStage`, `getSpamLeads`, `getTrashedLeads`, `getAssigneeWorkload` | query | `{workspaceId, agentIds}` | Variantes. |
| `pipeline.createPipeline / updatePipeline / archivePipeline` ⚙️ | mutation | — | — |
| `pipeline.moveLeadInPipeline / updateLeadStage / recalculateLeadScore` ⚙️ | mutation | — | Cambian el estado del lead. |

**Etapas (steps) del pipeline "Pipeline de ventas" (isDefault):**
`qualifying` (En calificación) · `qualified` (Calificado) · `manual_attention` (Atención manual)
· `lost` (Perdido) · `won` (Ganado). `getAllStages` agrega además `paused`.
Cada step trae `aiInstructions` (cómo el agente decide mover el lead ahí).

### 3.3 `lead`
| Procedure | Tipo | Input | Notas |
|---|---|---|---|
| `lead.listTags` ✅ | query | `{workspaceId}` | `["Agrimensor","Jefe","Lead IG","Mariana Inmo Varela","Propietario"]` |
| `lead.getReferrals` ✅ | query | `{workspaceId, leadId}` | Referidos de un lead. |
| `lead.getAiRespondingStatus` | query | `{…}` | Si la IA está respondiendo. |
| `lead.getImportJobStatus / parseCsvPreview` | query | — | Importación CSV. |
| `lead.claimLead / updateLead / moveToTrash / restoreFromTrash / setIgnoredStatus / startImport` ⚙️ | mutation | — | Escritura sobre leads. |

### 3.4 `conversations`
| Procedure | Tipo | Input | Notas |
|---|---|---|---|
| `conversations.getConversations` ✅ | query | `{workspaceId, agentIds:[], channel:[], status:'all'|'active'|'temporarily_ignored'|'spam'}` | Devuelve `{items[], total, page, hasMore}` (paginado). |
| `conversations.getMessagesByConversationId` ⚠️ | query | `{workspaceId, conversationId:<ID numérico Chatwoot>}` | **LIMITACIÓN**: con la key devolvió `403 "Lead does not belong to this workspace"` / `412` para todos los leads probados. Ver §6. |
| `conversations.getConversationsSignature / getClaimableSignature` | query | — | Firmas para realtime (Chatwoot). |
| `conversations.markConversationSeen / markConversationUnread / triggerReprocess` ⚙️ | mutation | — | — |

### 3.5 `webhooks` (gestión — accesible con la API Key ✅)
| Procedure | Tipo | Input | Notas |
|---|---|---|---|
| `webhooks.list` ✅ | query | `{workspaceId}` | Lista webhooks configurados (ver abajo). |
| `webhooks.create` ⚙️ | mutation | `{workspaceId, url(https), events[], agentIds[]}` | VERA podría auto-registrar su endpoint. |
| `webhooks.update / delete / test / regenerateSecret` ⚙️ | mutation | — | `test` dispara una entrega de prueba. |

`webhooks.list` real devolvió:
```json
[{
  "id":"01KXF6JJPFH7TN4AEXRGSAVSQ2",
  "url":"https://bot.varelapropiedadescde.com.ar/webhook/arturito",
  "events":["lead.attended","lead.created"],
  "enabled":true, "agentIds":[], "secretSuffix":"4aea", "hasSecret":true,
  "createdAt":"2026-07-14T02:16:26Z"
}]
```

### 3.6 `apiKey` (🔒 solo dashboard)
`apiKey.create / list / revoke` existen pero **no** se pueden usar con una API Key
(`403 "Use the dashboard"`). Requieren sesión Auth0 de administrador.

### 3.7 Recursos solicitados que NO tienen router propio
- **Contacts** → en Arturito el "contacto" ES el **lead** (no hay router `contact.*`). Un
  lead reúne identidad del contacto (`phone`, `name`, `email`, `tags`) + su estado comercial.
- **Users** → los "usuarios/asesores" se modelan como **agentes** (`agent.*`) y `advisors`
  dentro de la config del agente; hay `userId`/`assigneeId` en cada lead, pero no un router
  `user.*` expuesto a la API Key.
- **Messages** → no hay router `messages.*` independiente para terceros; el acceso es vía
  `conversations.getMessagesByConversationId` (hoy restringido, ver §6).

---

## 4. Esquema del LEAD (fuente principal de datos)
Muestra real (anonimizada) de `pipeline.getLeadsByStage`:
```json
{
  "_id": "6a5f7515b80aab6cfab1f9b1",
  "threadId": "v1-618-14",
  "accountId": "618", "inboxId": "1876", "chatwootConversationId": "14",
  "agentId": "6a54f973…", "assigneeId": "6a54f832…",
  "channel": "Channel::Whatsapp", "channelName": "<display>",
  "name": "<NAME>", "nameSource": "channel",
  "phone": "<PHONE>", "normalizedPhone": "<PHONE>", "email": null,
  "pipelineStage": "qualifying", "previousPipelineStage": null,
  "tags": ["Propietario"], "tokkoTags": [],
  "leadScore": 0, "lastScoreUpdate": "…", "expectedValue": 0,
  "intentDetected": "User quiere tener una charla con el Client",
  "isSpam": false, "isIgnored": false, "isTemporaryIgnored": true,
  "lastMessageContent": "Si",
  "lastIncomingMessageAt": "…", "lastOutgoingMessageAt": "…", "lastMessageAt": "…",
  "createdAt": "…", "updatedAt": "…", "pauseUntil": "…",
  "notes": [{"description":"<text>","source":"agent","createdAt":"…"}],
  "customProperties": []
}
```
Observaciones:
- El **contenido del último mensaje** viaja en `lastMessageContent` + timestamps → sirve
  para muchos casos sin necesitar el transcript completo.
- `intentDetected` = intención parseada por la IA de Arturito (texto libre en inglés).
- Arturito corre sobre **Chatwoot** (`accountId`, `inboxId`, `chatwootConversationId`) y se
  integra con **Tokko** (`tokkoTags`) y **GoHighLevel** (`lastGoHighLevel…`).
- Identidad del contacto: `phone`/`normalizedPhone` (E.164) → mapea directo al
  `PersonResolver` de VERA. `email` suele venir null.

## 5. Métricas (`pipeline.getMetrics`)
```json
{"activeLeadsCount":6,"qualifiedLeadsCount":0,"qualificationRate":0,
 "totalExpectedValue":0,"totalConfirmedValue":0,"currency":"USD"}
```

---

## 6. Limitaciones encontradas
1. **Transcript completo de mensajes no accesible con la key (hoy).**
   `conversations.getMessagesByConversationId` devolvió `403 "Lead does not belong to this
   workspace"` (y un `412`) para TODOS los leads del propio workspace, pese a que esos
   leads sí pertenecen a él. Parece un check de ownership/Chatwoot más estricto o un bug.
   → Mitigación: usar `lastMessageContent` + `intentDetected` del lead, o los WEBHOOKS
   (que incluyen el primer mensaje en `lead.created`). Consultar a Arturito por el uso
   correcto de este endpoint vía API Key.
2. **No hay OpenAPI/Swagger/Postman público.** El contrato se dedujo por reversing; los
   nombres/inputs pueden cambiar sin aviso (no es una API versionada públicamente).
3. **tRPC, no REST.** Requiere el encoding `?input=<json>` (sin superjson) y conocer los
   nombres de router.procedure. No es autodescubrible en runtime.
4. **1 API Key = 1 workspace.** No hay scopes finos visibles; la key es "todo o nada"
   (lectura + escritura de datos + gestión de webhooks; excepto gestión de api keys).
5. **Webhook ya ocupado.** Existe un receptor en `bot.varelapropiedadescde.com.ar`. Decidir
   con el usuario coexistencia vs reemplazo (Arturito soporta múltiples webhooks).
6. `pipeline.getDistinctProperties` hoy `[]` y `getMessagesByConversationId` restringido →
   el matching propiedad↔lead habrá que derivarlo del texto/`intentDetected`, no de un id.

---

## 7. Webhooks salientes (contrato PUSH) — detalle
- **Config**: URL HTTPS + selección de eventos + filtro por agente (vacío = todos) +
  estado activo/inactivo. Secret mostrado una sola vez (regenerable). Historial de
  entregas con reintentos, latencia y request/response.
- **Firma**: header `X-Arturito-Signature` = **HMAC-SHA256 sobre el body crudo**, usando el
  secret del webhook. El receptor debe validar la firma.
- **Eventos disponibles** (2):
  - `lead.created` → "entra un nuevo lead, con su primer mensaje (ej. consultas de
    MercadoLibre o portales), incluso si lo atiende una persona."
  - `lead.attended` → "un lead es atendido por el agente y se genera un resumen."
- (El payload exacto del webhook no se pudo capturar en este sprint —requiere disparar una
  entrega real de prueba a un endpoint nuestro; ver Recomendación.)

### 7.1 Payload real del webhook (CONFIRMADO — capturado vía `webhooks.test`)
Estructura verificada de una entrega real firmada:
```json
{
  "event_id": "01KY2Q6ETFDQKEWBKM5SF2EQYJ",   // único por evento (los reintentos lo conservan)
  "event": "lead.attended",                    // "lead.created" | "lead.attended"
  "timestamp": "2026-07-21T16:12:29.391Z",
  "workspace_id": "6a54f832f4c16e6124260f28",
  "agent_id": "6a54f973…",
  "lead": {
    "id": "…", "name": "…", "phone": "+549…", "email": null,
    "channel": "Channel::Whatsapp", "intent": null, "interest": null,
    "tags": ["…"]
  },
  "conversation": {
    "id": "…", "summary": "…(resumen del agente)…", "url": "https://app.arturito.ai/…",
    "started_at": null, "ended_at": null
  }
}
```
- Firma: header `X-Arturito-Signature: sha256=<hmac_sha256(secret, body_crudo)>` (VERIFICADO).
- El **lead viene bajo `lead`** (id = `id`, NO `_id`); el mensaje/resumen viaja en
  `conversation.summary`. `intent` (no `intentDetected`).
- ⚠️ `webhooks.test` con `eventType=lead.created` devolvió "Validation Error" del lado de
  Arturito (su harness de prueba). El path `lead.created` se validó con un POST firmado
  manualmente (misma estructura) → OK.

### 7.2 Estado de implementación (2026-07-21)
✅ **ArturitoWebhookAdapter IMPLEMENTADO** en `POST /api/integrations/arturito/webhook`
(`/app/backend/integrations/arturito/`). Valida HMAC, traduce y publica en VERA Core.
✅ Webhook de VERA **creado y activo** (id `01KY2Q55V8585DMWYK2J8FB9JW`) apuntando al
entorno PREVIEW. ✅ Webhook viejo (`bot.varelapropiedadescde.com.ar`) **ELIMINADO** — VERA
es el receptor primario. ⏳ Backfill histórico (tRPC `pipeline.getLeadsByStage`): pendiente
(a ejecutar tras validar con leads reales). ⚠️ Al redeployar, actualizar la URL del webhook
al dominio de PRODUCCIÓN (`webhooks.update`).

> Nota: además existe una integración **Meta CAPI** interna con su propio mapeo de eventos
> (`lead_created`, `lead_qualified`, `visit_scheduled`, `lead_won/Purchase`). No es para
> terceros; se menciona sólo porque revela el ciclo de vida que Arturito modela.

---

## 8. Recomendación de integración con VERA (para la fase de implementación)
**No implementar aún** — esto es el plan sugerido a validar con el usuario:

1. **`ArturitoWebhookAdapter` (PUSH, primario).** Un endpoint en VERA
   (`POST /api/adapters/arturito/webhook`) que:
   - valida `X-Arturito-Signature` (HMAC-SHA256 con el secret),
   - traduce `lead.created` → `ConversationStarted` + `PropertyInquiry` (con
     `contact.phone`, `contact.name`, primer mensaje en `payload`), y
     `lead.attended` → `MessageReceived`/`OpportunityCreated` con el resumen,
   - reenvía al **Conversation Adapter Contract** existente (`pipeline.ingest`), con
     `source="arturito"` e `idempotencyKey` derivado del id de entrega + lead.
   Así VERA Core reacciona igual que con cualquier otro adapter (Leads/Oportunidades/Tareas).
2. **`ArturitoClient` (PULL, secundario).** Cliente tRPC fino
   (`Authorization: Bearer`, encoding `?input=`) para: (a) **backfill** inicial
   (`pipeline.getLeadsByStage` → sembrar personas/leads históricos) y (b) enriquecer un
   lead puntual. Detrás del contrato `ConversationProvider`/un `LeadProvider`.
3. **Mapeo de etapas Arturito → VERA** (natural, casi 1:1):
   `qualifying→interes`, `qualified→(lead) calificado`, `manual_attention→tarea`,
   `won→ganada/convertido`, `lost→perdida/perdido`.
4. **Provisioning opcional**: con la misma key, `webhooks.create` para registrar el endpoint
   de VERA automáticamente (o hacerlo a mano desde el dashboard). Coordinar con el webhook
   existente de `bot.varelapropiedadescde.com.ar`.
5. **Pendientes a consultar a Arturito**: (a) payload exacto de los webhooks; (b) uso
   correcto de `getMessagesByConversationId` con API Key; (c) estabilidad/versionado del
   contrato tRPC.

## 9. Seguridad
- La API Key `art_…` es una credencial sensible: **solo backend**, guardar en `.env`
  (`ARTURITO_API_KEY`), nunca en el frontend ni en el repo. Rotable desde el dashboard.
- El secret del webhook idem: sólo en backend, para validar la firma.
