# VERA OS — Providers & Contracts ("drivers" del sistema operativo)

## Principio permanente
VERA es un **sistema operativo comercial**, no una integración de herramientas.
Un sistema operativo no depende de una marca de impresora o de disco: **define una
interfaz y cualquier dispositivo compatible se conecta**. VERA aplica la misma idea.

> **Lo permanente es el CONTRATO, no la herramienta.**
> Las herramientas cambian, las APIs cambian, las empresas desaparecen. Por eso VERA
> nunca se diseña alrededor de un proveedor concreto. Se diseña alrededor de interfaces.

Los proveedores (Arturito, Gmail, Meta, Dropbox, WhatsApp, un CRM…) son **drivers**:
implementaciones intercambiables detrás de un contrato estable. VERA Brain y las Apps
consumen SÓLO el contrato; nunca conocen al driver concreto.

## Regla de oro
- **VERA Brain nunca conoce a Arturito** (ni a ningún proveedor). Sólo conoce contratos.
- Conectar/cambiar un proveedor = implementar la interfaz + cambiar 1 línea (el
  `active_*` correspondiente). NO se toca VERA Brain, ni el motor de insights, ni la UI.

## Catálogo de contratos (patrón de plataforma)
| Contrato | Rol | Estado | Punto de acoplamiento |
|----------|-----|--------|-----------------------|
| `AIProvider` | Razonamiento (LLM interno, invisible) | ✅ `ClaudeProvider` | `vera_brain/ai_provider.py` → `active_provider` |
| `KnowledgeSource` + `KnowledgeHub` | Conocimiento que consulta VERA Brain | ✅ Vera / Properties / Conversations | `vera_brain/knowledge.py` → `hub` |
| `ConversationProvider` | Fuente de conversaciones (contactos, mensajes, historial) | ⏳ Sólo contrato + `MockConversationProvider` (stand-in) | `conversations/provider.py` → `active_conversation_provider` |
| `MessagingProvider` | Lanzar/embeber la bandeja de mensajería (UI) | ✅ `arturitoProvider` (modo launch) | `app/vera-bot/provider.ts` |
| `StorageProvider` | Archivos/objetos (imágenes, documentos) | ✅ `SupabaseStorageService` | backend storage service |
| `PropertyProvider` | Cartera de propiedades (si algún día hay >1 CRM) | 🔭 Futuro (hoy repo Supabase directo) | `property_repository` |

## ConversationProvider (contrato de conversaciones)
Modelo de dominio canónico (`conversations/types.py`): `Conversation`, `Contact`,
`ConversationMessage` — vendor-agnóstico. Cualquier driver traduce su formato a estos
tipos.

Interfaz (`conversations/provider.py`):
- `list_conversations() -> list[Conversation]`
- `get_conversation(id) -> Conversation | None`
- `find_by_phone(phone) -> Conversation | None`

Drivers futuros posibles: `ArturitoProvider`, `WhatsAppCloudProvider`, `KommoProvider`,
`HubSpotProvider`, `TokkoProvider`, `EasyBrokerProvider`.

Hoy corre `MockConversationProvider` (datos de ejemplo). Es un **stand-in temporal**:
no representa a ningún proveedor real; sólo satisface el contrato para que VERA funcione
end-to-end. Cuando exista un proveedor real, se implementa la interfaz y se cambia
`active_conversation_provider` — sin tocar VERA Brain, el Insights Engine ni la UI.

## Nota sobre Arturito (investigación 2026-07)
Arturito es una plataforma **cerrada**: no expone API pública, ni webhooks a terceros,
ni docs de desarrollador (verificado: sin `api./docs./developers.` ni paths públicos).
Es el **destino** de integraciones (importa desde tu CRM/catálogo), no una fuente.
Por eso VERA NO se ata a Arturito: si habilita API/partner/webhooks/export construimos
`ArturitoProvider`; si no, elegimos otro driver (WhatsApp Cloud, un CRM, etc.). La
arquitectura no depende de esa decisión.
