# Arquitectura — Módulo Documentos v1 (Fundacional)

> Estado: **PROPUESTA PARA VALIDACIÓN**. Este documento es el entregable del sprint.
> No se implementa lógica de negocio ni generación de PDF hasta validar la arquitectura.
>
> Principio rector: **Un documento es una entidad del negocio, no un PDF.** El PDF es una
> representación. El documento vive dentro de VERA, relacionado con Personas, Propiedades y
> Operaciones durante todo su ciclo de vida. Son **ciudadanos de primera clase**.

---

## 1) Modelo de entidades

### 1.1 `DocumentTemplate` — definición de un tipo de documento (VERSIONADO)
Representa **qué es** un documento (Autorización de Venta, Recibo de Seña, Reserva, etc.).
No contiene datos de ninguna operación. **Es inmutable por versión.**

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK de esta VERSIÓN específica |
| `template_key` | text | Identificador estable que agrupa versiones (`autorizacion_venta`) |
| `name` | text | Nombre legible ("Autorización de Venta") |
| `category` | text | `autorizacion` \| `recibo` \| `reserva` \| `oferta` \| `contrato` \| `poder` \| `tasacion` |
| `version` | int | 1, 2, 3… (autoincremental por `template_key`) |
| `description` | text | |
| `variables` | jsonb | Definición de variables (ver §5). NO valores. |
| `body` | jsonb/text (nullable) | Cuerpo/estructura del template (se llenará en un sprint futuro) |
| `status` | text | `draft` \| `active` \| `deprecated` \| `archived` |
| `created_at` / `updated_at` | timestamptz | |

Reglas: `UNIQUE(template_key, version)`. Solo **una** versión `active` por `template_key`
(índice parcial único). Una versión publicada no se edita: se crea una versión nueva.

### 1.2 `Document` — instancia real creada con UNA versión del template
| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `number` | bigint | Correlativo legible ("Documento #248"), vía secuencia |
| `template_id` | uuid → document_templates.id | La **versión específica** usada |
| `template_key` | text | Denormalizado (trazabilidad) |
| `template_version` | int | Denormalizado (trazabilidad) |
| `template_snapshot` | jsonb | **Copia congelada** del template (variables/body) al momento de crear |
| `title` | text | |
| `status` | text | Ciclo de vida único (§4) |
| `resolved_variables` | jsonb (nullable) | Valores resueltos desde Personas/Propiedades al generar (§5) |
| `generated_pdf` | jsonb (nullable) | `{bucket, object_path}` — SOLO referencia; no se genera aún |
| `created_at` / `updated_at` | timestamptz | |
| `created_by` / `last_modified_by` | uuid | Autor (usuario/persona) |

### 1.3 `DocumentRelationship` — vínculos con entidades de VERA (nunca aislado)
| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `document_id` | uuid → documents.id (cascade) | |
| `entity_type` | text | `property` \| `person` \| `opportunity` \| `task` |
| `entity_id` | text | id de la entidad (soft-ref polimórfica) |
| `role` | text (nullable) | Para `person`: `comprador` \| `vendedor` \| `escribania` \| `testigo` … |
| `created_at` | timestamptz | |

Reglas: un documento **debe** tener ≥1 relación (validado en la capa de servicio).
Un documento puede tener **varias** Personas con distintos roles.
`INDEX(document_id)`, `INDEX(entity_type, entity_id)`.

### 1.4 `DocumentSignature` — firmas separadas del documento
| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `document_id` | uuid → documents.id (cascade) | |
| `signer_person_id` | uuid → people.id | El firmante **es** una Persona (integración Personas) |
| `signer_role` | text | `comprador` \| `vendedor` … |
| `status` | text | `pending` \| `shared` \| `signed` \| `rejected` \| `expired` |
| `sign_order` | int (nullable) | Orden de firma (opcional) |
| `shared_at` / `signed_at` / `rejected_at` / `expires_at` | timestamptz (nullable) | |
| `provider_ref` | jsonb (nullable) | Datos del proveedor de firma (futuro) |
| `created_at` / `updated_at` | timestamptz | |

Soporta **múltiples firmantes**. Totalmente desacoplada del `Document` (no se implementa lógica de firma aún).

---

## 2) Relaciones
```
DocumentTemplate (template_key, version)
        │ 1
        │            (una versión específica)
        ▼ N
     Document ──────1:N──────► DocumentRelationship ──► {Property | Person | Opportunity | Task}
        │                                   (role: comprador/vendedor/escribania/testigo)
        │ 1
        ▼ N
   DocumentSignature ──► Person (signer_person_id)
```
- `Document → DocumentTemplate`: N:1 hacia una **versión** inmutable.
- `Document → DocumentRelationship`: 1:N (≥1). Polimórfica hacia Property/Person/Opportunity/Task.
- `Document → DocumentSignature`: 1:N. Cada firma apunta a una Persona.
- **Cascade delete** de relationships y signatures al borrar un Document (raro; normalmente se archiva).

---

## 3) Endpoints REST (contrato; sin lógica de negocio aún)
Prefijo del módulo: `/api/documents`.

**Templates**
- `GET  /api/documents/templates` — lista (filtros: `category`, `status`, `templateKey`)
- `POST /api/documents/templates` — crea template (v1)
- `GET  /api/documents/templates/{id}` — detalle de una versión
- `GET  /api/documents/templates/{templateKey}/versions` — todas las versiones
- `POST /api/documents/templates/{id}/versions` — crea nueva versión (v+1)
- `PATCH /api/documents/templates/{id}` — metadata/status (no altera versiones emitidas)

**Documents**
- `GET  /api/documents` — lista (filtros: `status`, `entityType`, `entityId`, `templateKey`)
- `POST /api/documents` — crea instancia (draft) con `templateId` + relaciones
- `GET  /api/documents/{id}` — detalle
- `PATCH /api/documents/{id}` — edita borrador
- `POST /api/documents/{id}/transition` — transición de ciclo de vida (§4) → emite evento
- `GET  /api/documents/{id}/history` — timeline (eventos, §6)

**Relationships**
- `GET  /api/documents/{id}/relationships`
- `POST /api/documents/{id}/relationships` — agrega vínculo (entityType, entityId, role)
- `DELETE /api/documents/{id}/relationships/{relId}`

**Signatures**
- `GET  /api/documents/{id}/signatures`
- `POST /api/documents/{id}/signatures` — agrega firmante (signerPersonId, role, order)
- `PATCH /api/documents/{id}/signatures/{sigId}` — cambia estado (pending→shared→signed/…)

---

## 4) Ciclo de vida (único para TODOS los tipos)
```
draft → generated → shared → signed → archived
```
- **No** hay estados específicos por tipo de documento.
- `document.status` es la **proyección** del último evento de ciclo de vida.
- Las transiciones se validan en el servicio (no saltos inválidos) y **emiten eventos** (§6).

---

## 5) Variables (pertenecen al Template, NO al Documento)
Definición en `DocumentTemplate.variables` (jsonb), ej.:
```json
[
  {"key": "buyer.name",      "label": "Comprador",  "source": "person",   "role": "comprador", "path": "full_name", "required": true},
  {"key": "seller.name",     "label": "Vendedor",   "source": "person",   "role": "vendedor",  "path": "full_name", "required": true},
  {"key": "property.address","label": "Dirección",  "source": "property", "path": "address",    "required": true},
  {"key": "property.price",  "label": "Precio",     "source": "property", "path": "price",      "required": true},
  {"key": "deposit.amount",  "label": "Seña",       "source": "input",    "type": "money",      "required": true},
  {"key": "date",            "label": "Fecha",      "source": "system",   "type": "date"}
]
```
Fuentes (`source`): `person` (resuelto por rol vía DocumentRelationship + módulo Personas),
`property` (vía DocumentRelationship + módulo Propiedades), `input` (dato propio del documento),
`system` (fecha, correlativo…). Al **generar**, VERA resuelve y congela los valores en
`Document.resolved_variables`. Los datos personales/propiedad NUNCA se piden en el documento:
se obtienen de Personas/Propiedades.

---

## 6) Historial como EVENTOS (no se sobrescriben estados)
Se reutiliza el **Event Pipeline existente** (`events.pipeline.emit`, MongoDB, append-only,
inmutable, versionado). Tipos de evento del módulo:
```
document.created
document.edited
document.generated
document.shared
document.signed        (por firmante y/o documento completo)
document.archived
document.signature.requested
document.signature.rejected
```
Cada evento: `{ type, event_version, payload:{documentId, templateKey, ...}, subject/refs, occurred_at }`.
`GET /api/documents/{id}/history` proyecta estos eventos como timeline. El `status` del documento
es la proyección del último evento de ciclo de vida (fuente de verdad = ledger de eventos).

---

## 7) Integración con Knowledge (PREPARADO, no implementado)
```
document.signed ──► Event Pipeline ──► (futuro) Knowledge Projection ──► actualizar conocimiento / oportunidad
```
Como los cambios de estado ya son eventos en el ledger, la integración futura es solo **registrar
un projection handler** que consuma `document.signed`. No se implementa ahora; la arquitectura
ya lo permite sin cambios estructurales.

---

## 8) Versionado de Templates (decisión crítica) + justificación
- `DocumentTemplate` = definición **por versión** (v1, v2, v3…). Fila inmutable.
- `Document` = instancia atada a **una versión específica** (`template_id`) + **snapshot congelado**
  (`template_snapshot`).
- Si en un año se modifica una cláusula de "Autorización de Venta", se crea **v2**; los documentos
  ya emitidos siguen vinculados a **v1** y conservan su snapshot.
- **Justificación**: trazabilidad, auditoría y validez documental. Un cambio de template **jamás**
  altera retroactivamente documentos históricos. El snapshot garantiza integridad aún si la fila
  de template se archivara.

---

## 9) Esquema de base de datos (Supabase / PostgreSQL)
> Entidades relacionales del negocio → Postgres (como `properties`/`people`).
> Historial → MongoDB (ledger de eventos existente).

```sql
create table if not exists public.document_templates (
  id           uuid primary key default gen_random_uuid(),
  template_key text not null,
  name         text not null,
  category     text not null,
  version      int  not null default 1,
  description  text default '',
  variables    jsonb not null default '[]'::jsonb,
  body         jsonb,
  status       text not null default 'draft',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (template_key, version)
);
-- Solo una versión activa por template_key
create unique index if not exists uq_template_active
  on public.document_templates (template_key) where status = 'active';

create sequence if not exists public.document_number_seq;

create table if not exists public.documents (
  id                uuid primary key default gen_random_uuid(),
  number            bigint not null default nextval('public.document_number_seq'),
  template_id       uuid not null references public.document_templates(id),
  template_key      text not null,
  template_version  int  not null,
  template_snapshot jsonb not null,
  title             text not null default '',
  status            text not null default 'draft',
  resolved_variables jsonb,
  generated_pdf     jsonb,
  created_by        uuid,
  last_modified_by  uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists ix_documents_status on public.documents(status);
create index if not exists ix_documents_template_key on public.documents(template_key);

create table if not exists public.document_relationships (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  entity_type text not null,           -- property | person | opportunity | task
  entity_id   text not null,
  role        text,                    -- comprador | vendedor | escribania | testigo | ...
  created_at  timestamptz not null default now()
);
create index if not exists ix_docrel_document on public.document_relationships(document_id);
create index if not exists ix_docrel_entity on public.document_relationships(entity_type, entity_id);

create table if not exists public.document_signatures (
  id               uuid primary key default gen_random_uuid(),
  document_id      uuid not null references public.documents(id) on delete cascade,
  signer_person_id uuid references public.people(id),
  signer_role      text,
  status           text not null default 'pending', -- pending|shared|signed|rejected|expired
  sign_order       int,
  shared_at        timestamptz,
  signed_at        timestamptz,
  rejected_at      timestamptz,
  expires_at       timestamptz,
  provider_ref     jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists ix_docsig_document on public.document_signatures(document_id);
```
Historial (MongoDB): colección `events` existente (append-only). No se crea colección nueva.

---

## 10) Diagrama de arquitectura
```
Frontend (React)
  Documentos
   ├── Templates  (lista/definición de tipos + versiones)
   └── Documents  (instancias, ciclo de vida, relaciones, firmas)
        │  (solo navegación en este sprint; sin formularios/PDF)
        ▼
Backend  módulo independiente  backend/documents/
   api/            → routers REST (/api/documents/*)
   services/       → orquestación (validaciones, transiciones, resolución de variables)
   templates/      → repo + modelos DocumentTemplate (versionado)
   (documents)     → repo + modelos Document
   relationships/  → repo + modelos DocumentRelationship (vínculos polimórficos)
   signatures/     → repo + modelos DocumentSignature
        │
        ├── Supabase (Postgres): templates, documents, relationships, signatures
        ├── MongoDB (events): historial append-only (events.pipeline.emit)
        ├── Personas (people): resolución de firmantes y variables {{buyer.name}}...
        └── Propiedades (properties): resolución de {{property.*}}
        (futuro) Knowledge Engine ← consume document.signed
```

## 11) Estructura de carpetas (a crear tras validación)
```
backend/documents/
  __init__.py
  api/            routes_documents.py, routes_templates.py
  services/       document_service.py, template_service.py, variable_resolver.py
  templates/      models.py, repository.py
  models.py       (Document)          repository.py
  relationships/  models.py, repository.py
  signatures/     models.py, repository.py
  events.py       (tipos + emisión al ledger)

frontend/src/app/screens/documents/
  DocumentsScreen.tsx      (contenedor + navegación: Templates | Documents)
  TemplatesList.tsx        (placeholder)
  DocumentsList.tsx        (placeholder)
```

## 12) Justificación de decisiones
1. **Postgres para entidades, MongoDB para historial**: coherente con VERA (properties/people en
   Supabase; ledger de eventos inmutable en Mongo). Las entidades documentales son relacionales y
   se benefician de FKs/índices; el historial es append-only y ya tiene infraestructura.
2. **Relaciones polimórficas (entity_type, entity_id)**: Opportunity/Task son read-models en
   MongoDB (no hay FK de Postgres a Mongo). Una tabla polimórfica unifica los 4 tipos; la
   integridad referencial se valida en la capa de servicio. `signer_person_id` sí es FK a `people`.
3. **Snapshot de template en el Document**: garantiza validez/trazabilidad histórica aunque el
   template cambie o se archive. Complementa el FK a la versión.
4. **Firmas en tabla separada**: múltiples firmantes, estados propios, y desacople para integrar
   un proveedor de firma en el futuro sin tocar `Document`.
5. **Ciclo de vida único + eventos**: un solo modelo mental para todos los tipos; el historial no
   se sobrescribe (se agregan eventos), habilitando auditoría y la futura integración con Knowledge.
6. **Módulo independiente y desacoplado**: `backend/documents/` no acopla al resto; consume
   Personas/Propiedades por sus repos/servicios, no por sus tablas.

## 13) Fuera de alcance de este sprint (explícito)
NO generar PDFs · NO migrar formularios/pantallas viejas · NO integrar firmas (solo modelo) ·
NO automatizaciones · NO integrar Knowledge (solo dejar preparado). **Solo arquitectura + estructura.**
