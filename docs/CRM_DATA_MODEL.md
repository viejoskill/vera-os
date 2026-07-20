# CRM Varela — Modelo de Datos (fuente para la migración a VERA)

> **Objetivo**: documentar el esquema real del CRM Varela (`varela-propiedades`) para
> diseñar una migración explícita y correcta hacia el modelo de VERA. Este documento es
> insumo previo al diseño de la migración (todavía NO migramos).

## Cómo se obtuvo (transparencia)
- **Repo**: https://github.com/viejoskill/varela-propiedades (público).
- **Arquitectura del CRM**: es una app **estática HTML** (`crm.html`, ~7.500 líneas) que habla
  **directo con Supabase desde el navegador** (`createClient(SUPABASE_URL, SUPABASE_KEY)`), más
  2 **Edge Functions** (`claude`, `editar-imagen`) y un bucket de Storage.
- **No hay migraciones SQL en el repo** (`supabase/` solo tiene `config.toml` y `functions/`).
  Por lo tanto, el esquema de tablas **se reconstruyó leyendo el uso del cliente Supabase**
  en el código (`.from('tabla').select/insert/update`, accesos a campos y render).
- ⚠️ **Confianza**: nombres de tablas/columnas son **de alta confianza** (surgen del código),
  pero **tipos exactos, defaults, NOT NULL, enums e índices NO son visibles desde el cliente**.
  Antes de migrar conviene confirmar contra la base real (pedir `SERVICE_ROLE_KEY` del proyecto
  Supabase del CRM y consultar `information_schema`, o un `pg_dump --schema-only`).

## Panorama de tablas (21 detectadas)
| Tabla | Rol | ¿Migra a VERA? |
|---|---|---|
| `propiedades` | **Propiedades** (ficha comercial) | ✅ Núcleo → `properties` |
| `propietarios` | **Dueños** de las propiedades | ✅ → dueño de la propiedad (owner) |
| `contactos` | **Contactos / leads** (centrado en WhatsApp) | ✅ → Persona (App Personas) |
| `visitas` | **Eventos** (visitas realizadas, interés) | ✅ → `property_visits` |
| `autorizaciones` | **Autorización de venta** (mandato + firma) | ⚠️ Fase 2 (documento) |
| `documentos_firma` | Documentos para **firma digital** | ⚠️ Fase 2 → `property_documents` |
| `mensajes_wa` | Mensajes de **WhatsApp** | 🔵 Futuro `ConversationProvider` |
| `plantillas_wa` | Plantillas de WhatsApp | 🔵 Futuro (mensajería) |
| `tareas`, `tareas_programadas` | Tareas y campañas programadas | 🔵 Futuro (tareas de Persona) |
| `campanias` | Campañas de difusión | 🔵 Futuro |
| `contactos_internos` | Agentes / equipo interno | 🔵 Futuro (usuarios) |
| `usuarios_crm` | Usuarios del CRM | 🔵 Futuro (auth/roles) |
| `negocios` | Operaciones / pipeline | 🔵 Futuro (Operaciones) |
| `eventos_interes` | Señales de interés de un lead | 🔵 Futuro (memoria/insights) |
| `vera_contexto` | Contexto para el bot Vera (Arturito) | 🔵 Infra bot |
| `bot_comandos`, `bot_status` | Estado/comandos del bot | 🔵 Infra bot |
| `lid_aliases` | Alias de LID de WhatsApp | 🔵 Infra WhatsApp |
| `tasador_config`, `tasador_publico_config` | Config del tasador | 🔵 Fuera de alcance |

**Storage**: bucket **`fotos-propiedades`** (fotos de las propiedades; URLs públicas).
**Edge Functions**: `editar-imagen` (OpenAI `gpt-image-1.5` para retoque de fotos),
`claude` (asistente de texto).

---

## 1) `propiedades` — Propiedades
**Propósito**: ficha comercial de cada inmueble (datos, superficies, fotos, estado de
publicación en portales).

**Columnas principales** (reconstruidas):
- **Identidad**: `id` (uuid/text), `codigo` (código interno legible), `titulo`, `descripcion`.
- **Clasificación**: `tipo` (casa/departamento/ph/terreno/local…), `operacion` (venta/alquiler),
  `estado` (estado de la propiedad / ciclo comercial).
- **Precio**: `precio` (numérico). **No hay columna `moneda`** → los precios se manejan en **USD**
  de forma implícita en el CRM (validar en migración).
- **Ubicación**: `direccion`, `zona` (barrio), `ciudad`, `provincia`.
- **Métricas**: `ambientes`, `dormitorios`, `banios`, `piso`, `plantas`,
  `mts` (superficie total), `mts_cubiertos`, `mts_semicubiertos`, `antiguedad`, `expensas`.
- **Atributos**: `amenities` (lista), `servicios`.
- **Media**: `fotos` = **array de URLs** (strings) al bucket `fotos-propiedades` (el índice `0`
  es la portada); `documentos` = array (jsonb) de documentos asociados.
- **Propietario (desnormalizado + FK)**: `propietario_id` (→ `propietarios.id`),
  `propietario_nombre`, `propietario_tel` (copias para mostrar sin join).
- **Orden/flags**: `orden` (orden manual), `radar` (marca de seguimiento/monitoreo).
- **Publicación en portales** (estado por canal):
  - Web: `publicado_web`
  - Mercado Libre: `publicado_ml`, `ml_id`, `ml_link`, `ml_error`, `publicar_ml`
  - Instagram: `publicado_ig`, `ig_id`, `ig_link`, `ig_error`, `publicar_ig`
  - Zonaprop: `publicado_zp`
- **Auditoría**: `created_at`.

**Relaciones**:
- `propietario_id` → `propietarios.id` (N propiedades : 1 propietario).
- `fotos[]` → objetos del bucket `fotos-propiedades`.
- Referida por `visitas.propiedad_id`.

**Mapeo a VERA (`properties`)**:
| CRM Varela | VERA `properties` | Nota |
|---|---|---|
| `codigo` | (no hay col.) | VERA deriva un código del `id`; guardar como `legacy_code`/meta |
| `titulo` | `title` | |
| `descripcion` | `description` | |
| `tipo` | `type` | normalizar vocabulario |
| `operacion` | `operation` | |
| `estado` | `status` / `archived` | mapear estados CRM → active/reserved/sold/archived |
| `precio` | `price` | `currency = 'USD'` fijo (confirmar) |
| `direccion` | `address` | |
| `zona` | `neighborhood` | |
| `ciudad` | `city` | |
| `provincia` | `province` | |
| `ambientes` | `rooms` | |
| `dormitorios` | `bedrooms` | |
| `banios` | `bathrooms` | |
| `mts_cubiertos` | `area_m2` | |
| `mts` | `lot_area_m2` | (superficie total/lote) |
| `piso`, `plantas` | `floor`, `plantas` | según columnas de VERA |
| `antiguedad` | `year_built` (derivar) | CRM guarda antigüedad, VERA guarda año |
| `amenities` | `amenities` (jsonb) | normalizar a claves canónicas del catálogo VERA |
| `fotos[]` | **→ `property_images`** | ver sección 2 |
| `documentos[]` | **→ `property_documents`** | ver sección 3 |
| `propietario_id` | `owner_id` | ver sección 5 |
| `publicado_ml/ig/zp/web` | `publications` (jsonb) | mapear a los canales de VERA |
| `radar`, `orden` | meta / `position` | |

---

## 2) Imágenes — `propiedades.fotos[]` + bucket `fotos-propiedades`
**Propósito**: el CRM **no tiene tabla de imágenes**. Las fotos son un **array de URLs** en la
columna `propiedades.fotos`, apuntando al bucket público `fotos-propiedades` (las URLs pueden
llevar querystring). La portada es `fotos[0]`.

**Mapeo a VERA (`property_images`)**: por cada URL en `fotos[]` crear una fila:
- `object_path` ← descargar la URL y **re-subir** al Storage propio de VERA (como ya hace el
  importador legacy), o referenciar la URL si se decide no rehospedar.
- `position` ← índice en el array; `is_cover` ← `index === 0`.
- `original_name` ← nombre del archivo en la URL.

---

## 3) Documentos — `propiedades.documentos[]`, `documentos_firma`, `autorizaciones`
**Propósito**:
- `propiedades.documentos` = array (jsonb) de documentos adjuntos a la propiedad.
- `documentos_firma` = documentos para **firma digital**. Columnas: `id`, `tipo`, `titulo`,
  `datos`, `estado`, `firma_nombre`, `firma_dni`, `firma_fecha`, `firma_hora`.
- `autorizaciones` = **mandato de venta** (ver sección 6), que también genera un documento firmable.

**Mapeo a VERA (`property_documents`)**: cada ítem de `documentos[]` → fila con `doc_type`,
`original_name`, `object_path` (re-subir a Storage VERA). Los `documentos_firma`/`autorizaciones`
son de **Fase 2** (VERA hoy no modela firma digital; se puede guardar el PDF como documento).

---

## 4) `contactos` — Contactos / Leads
**Propósito**: personas que interactúan con la inmobiliaria, **centrado en WhatsApp**
(leads, interesados). Es la base de la futura **App Personas** de VERA.

**Columnas principales**: `id`, `nombre`, `tel`, `tel_real`, `email`, `tipo` (segmentación),
`segmento`, `activo`, `creada_en`, `notas`, `origen`, `tags`, `no_contactar` (bool),
`propiedad_reservada`, y campos de WhatsApp: `lid`, `lid_no_resuelto`, `pushname`.

**Relaciones**:
- `tel` es la clave natural que conecta con `mensajes_wa` (`contacto_tel`/`tel`) y con
  `propietarios.tel` (un propietario también se sincroniza como `contacto`).
- Vinculación a propiedades vía conversaciones/eventos (no hay FK directa propiedad↔contacto).

**Mapeo a VERA**: → **Persona** (App Personas / `relationships`). Hoy VERA deriva Personas de
conversaciones; `contactos` sería el **PersonProvider real**. Campos → identidad de la Persona
(nombre, tel, email, tipo/segmento, tags, notas → memoria/contexto). `no_contactar` → preferencia
que VERA debe respetar (Memory/preference).

---

## 5) `propietarios` — Dueños
**Propósito**: dueños de las propiedades.

**Columnas** (reconstruidas del sync `pSync`): `id`, `nombre`, `tel`, `email`,
`portal_activo` (bool), `created_at`. Se **sincroniza con `contactos`** (todo propietario también
existe como contacto, matcheado por `tel`).

**Relaciones**: `propietarios.id` ← `propiedades.propietario_id`.

**Mapeo a VERA**: VERA hoy modela el dueño con `owner_id` + `owner_observations` en `properties`.
Opciones a decidir en la migración:
- (a) Crear una entidad Owner/Persona en VERA y setear `owner_id`, o
- (b) Guardar el propietario como **Persona** (unificando con `contactos`) y linkear la propiedad.
Recomendado: **unificar propietario ⊂ Persona** (como hace el CRM), y que la propiedad apunte a esa Persona.

---

## 6) Tablas de soporte (contexto, no núcleo de esta migración)
- **`visitas`**: eventos sobre una propiedad. Columnas: `id`, `propiedad_id` (→ propiedades),
  `tipo_evento` (ej. `visita_realizada`), `lead_nombre`, `wa_enviado` (bool), `metadata`, `created_at`.
  → Mapea directo a **`property_visits`** de VERA.
- **`autorizaciones`**: mandato de venta con snapshot de datos (`tipo_propiedad`, `direccion`,
  `superficie`, `superficie_cubierta`, `ambientes`, `dormitorios`, `precio_esperado`), datos del
  firmante (`nombre`, `dni`, `tel`, `email`), condiciones (`modalidad`, `exclusividad`,
  `vigencia_dias`, `comision`), y firma (`firma`, `fecha_firma`, `hora_firma`, `autoriza_cartel`).
  → Fase 2 (documento/relación propietario-propiedad).
- **`mensajes_wa`** / **`plantillas_wa`** / **`lid_aliases`** / **`bot_*`** / **`vera_contexto`**:
  toda la capa de **WhatsApp + bot**. → Futuro `ConversationProvider` (driver WhatsApp), fuera del
  alcance de la migración de propiedades.
- **`tareas`**, **`tareas_programadas`**, **`campanias`**: tareas y difusión. → Futuro.
- **`negocios`**, **`eventos_interes`**: pipeline / señales. → Futuro (Operaciones / Insights).
- **`usuarios_crm`**, **`contactos_internos`**: equipo interno. → Futuro (auth/roles).

---

## Orden sugerido de migración (a diseñar en el próximo paso)
1. **`propietarios` → Personas/Owner** (para poder linkear propiedades a su dueño).
2. **`propiedades` → `properties`** (mapeo explícito de columnas; `currency='USD'`).
3. **`propiedades.fotos[]` → `property_images`** (descarga + re-subida al Storage de VERA, portada = índice 0).
4. **`propiedades.documentos[]` → `property_documents`**.
5. **`visitas` → `property_visits`**.
6. (Fase 2) `contactos`/`mensajes_wa` → App Personas + `ConversationProvider`.

## Idempotencia
- Guardar el `id`/`codigo` del CRM como **`legacy_id`** en VERA (columna a crear en `properties`)
  para que reimportar **actualice** en vez de duplicar. Hoy el importador guarda el mapa en Mongo;
  con `legacy_id` en la tabla la idempotencia es global (resistente a correr desde varios entornos).

## Pendiente antes de migrar (bloqueante de precisión)
Para confirmar **tipos, NOT NULL, enums y defaults** (no visibles desde el cliente), pedir uno de:
- `SERVICE_ROLE_KEY` del proyecto Supabase del CRM (consulto `information_schema`), o
- un `pg_dump --schema-only` del CRM.
