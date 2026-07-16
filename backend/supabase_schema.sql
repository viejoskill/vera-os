-- VERA OS — esquema inicial de persistencia (Supabase / Postgres)
-- Ejecutar UNA vez en: Supabase Dashboard -> SQL Editor -> New query -> Run
-- Es idempotente (usa "if not exists"): se puede correr de nuevo sin romper nada.

create extension if not exists "pgcrypto";

create table if not exists public.properties (
  id           uuid primary key default gen_random_uuid(),
  workspace_id text not null default 'vera-default',
  title        text not null default '',
  operation    text not null default 'venta',
  type         text not null default 'departamento',
  price        double precision not null default 0,
  currency     text not null default 'USD',
  address      text not null default '',
  neighborhood text not null default '',
  city         text not null default '',
  bedrooms     integer not null default 0,
  bathrooms    integer not null default 0,
  area_m2      double precision not null default 0,
  year_built   text not null default '',
  video_url    text not null default '',
  status       text not null default 'active',
  description  text not null default '',
  owner_id     text not null default '',
  owner_observations text not null default '',
  archived     boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.property_images (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null references public.properties(id) on delete cascade,
  workspace_id  text not null default 'vera-default',
  bucket        text not null,
  object_path   text not null,
  original_name text not null default '',
  stored_name   text not null default '',
  mime_type     text not null default '',
  size_bytes    integer not null default 0,
  position      integer not null default 0,
  is_cover      boolean not null default false,
  created_at    timestamptz not null default now()
);

create table if not exists public.property_documents (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null references public.properties(id) on delete cascade,
  workspace_id  text not null default 'vera-default',
  doc_type      text not null default 'plano',
  bucket        text not null,
  object_path   text not null,
  original_name text not null default '',
  stored_name   text not null default '',
  mime_type     text not null default '',
  size_bytes    integer not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists idx_properties_status  on public.properties(status);
create index if not exists idx_properties_created  on public.properties(created_at desc);
create index if not exists idx_images_property     on public.property_images(property_id);
create index if not exists idx_documents_property  on public.property_documents(property_id);
