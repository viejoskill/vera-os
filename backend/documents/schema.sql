-- Módulo Documentos v1 — esquema (Supabase / PostgreSQL).
-- Ejecutar UNA vez en el SQL editor de Supabase (proyecto de VERA).
-- Historial de documentos: NO va acá; vive en el ledger de eventos (MongoDB).

create table if not exists public.document_templates (
  id           uuid primary key default gen_random_uuid(),
  template_key text not null,
  name         text not null,
  category     text not null,          -- autorizacion|recibo|reserva|oferta|contrato|poder|tasacion
  version      int  not null default 1,
  description  text default '',
  variables    jsonb not null default '[]'::jsonb,   -- definición de variables (no valores)
  body         jsonb,
  status       text not null default 'draft',        -- draft|active|deprecated|archived
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (template_key, version)
);
-- Solo una versión ACTIVA por template_key.
create unique index if not exists uq_template_active
  on public.document_templates (template_key) where status = 'active';

create sequence if not exists public.document_number_seq;

create table if not exists public.documents (
  id                 uuid primary key default gen_random_uuid(),
  number             bigint not null default nextval('public.document_number_seq'),
  template_id        uuid not null references public.document_templates(id),
  template_key       text not null,
  template_version   int  not null,
  template_snapshot  jsonb not null,                 -- copia congelada del template
  category           text not null,
  title              text not null default '',
  status             text not null default 'draft',  -- draft|generated|shared|signed|archived
  pdf_status         text not null default 'none',   -- none|pending|generated|failed (SEPARADO del status)
  origin             text not null default 'manual', -- manual|system|import|arturito...
  resolved_variables jsonb,                           -- variables resueltas por documento
  generated_pdf      jsonb,                           -- solo referencia {bucket,object_path}
  document_hash      text,                            -- hash de integridad (snapshot+resueltas)
  locked_at          timestamptz,                     -- inmutable al firmar
  created_by         uuid,
  last_modified_by   uuid,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists ix_documents_status on public.documents(status);
create index if not exists ix_documents_template_key on public.documents(template_key);

create table if not exists public.document_relationships (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  entity_type text not null,           -- property|person|opportunity|task
  entity_id   text not null,
  role        text,                    -- comprador|vendedor|escribania|testigo|...
  created_at  timestamptz not null default now()
);
create index if not exists ix_docrel_document on public.document_relationships(document_id);
create index if not exists ix_docrel_entity on public.document_relationships(entity_type, entity_id);

create table if not exists public.document_signatures (
  id               uuid primary key default gen_random_uuid(),
  document_id      uuid not null references public.documents(id) on delete cascade,
  signer_person_id uuid references public.people(id),
  signer_role      text,
  status           text not null default 'pending',  -- pending|shared|signed|rejected|expired
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
