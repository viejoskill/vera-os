-- Motor de firmas — migración (ejecutar UNA vez en el SQL Editor de Supabase).
-- Idempotente: se puede correr varias veces sin efectos secundarios.

-- 1) El TEMPLATE declara qué métodos de firma permite (presencial|digital|ambos).
alter table public.document_templates
  add column if not exists signature_methods jsonb not null default '[]'::jsonb;

-- 2) El DOCUMENTO guarda el método de firma elegido.
alter table public.documents
  add column if not exists signature_method text;

-- 3) DocumentParticipant: info ESPECÍFICA de firma por persona (N firmantes, orden,
--    firma secuencial o paralela, token del enlace seguro).
create table if not exists public.document_participants (
  id                 uuid primary key default gen_random_uuid(),
  document_id        uuid not null references public.documents(id) on delete cascade,
  person_id          uuid references public.people(id),
  role               text,
  signature_required boolean not null default true,
  signature_status   text not null default 'pending',  -- pending|sent|viewed|signed|rejected|expired
  signature_method   text,
  presencial_mode    text,
  "order"            int,
  sent_at            timestamptz,
  viewed_at          timestamptz,
  signed_at          timestamptz,
  rejected_at        timestamptz,
  expires_at         timestamptz,
  sign_token         text,
  signature_data     jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists ix_docpart_document on public.document_participants(document_id);
create unique index if not exists uq_docpart_token
  on public.document_participants(sign_token) where sign_token is not null;
