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

-- Seguimiento: visitas registradas por propiedad (sprint "Cerrar App Propiedades")
create table if not exists public.property_visits (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null references public.properties(id) on delete cascade,
  workspace_id  text not null default 'vera-default',
  date          text not null default '',
  time          text not null default '',
  interested    text not null default '',
  agent         text not null default '',
  comment       text not null default '',
  notify_owner  boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists idx_visits_property on public.property_visits(property_id);

-- Ubicación inteligente (Google Places): infraestructura geográfica (sprint "Ubicación Inteligente")
alter table public.properties
  add column if not exists latitude          double precision,
  add column if not exists longitude         double precision,
  add column if not exists google_place_id   text,
  add column if not exists formatted_address text,
  add column if not exists province          text,
  add column if not exists postal_code       text,
  add column if not exists country           text;

-- Módulo "Características" — base de conocimiento técnico de la propiedad
-- (sprint "Cerrar módulo Características"). Amenities como lista plana de claves
-- canónicas en jsonb; el resto son características objetivas. Idempotente.
alter table public.properties
  add column if not exists lot_area_m2          double precision default 0,
  add column if not exists semi_covered_area_m2 double precision default 0,
  add column if not exists rooms                integer default 0,
  add column if not exists toilettes            integer default 0,
  add column if not exists floors               integer default 0,
  add column if not exists floor_number         integer,
  add column if not exists parking_covered      integer default 0,
  add column if not exists parking_uncovered    integer default 0,
  add column if not exists orientation          text default '',
  add column if not exists condition            text default '',
  add column if not exists amenities            jsonb default '[]'::jsonb;

-- Centro de Publicación / Canales (sprint "Simplificar Workspace").
-- Estado de publicación por canal, como mapa jsonb: { "<canal>": {"status": "...", "last_sync": "..."} }.
-- Lista de proveedores escalable (definida en código); estados: none/published/pending/error/syncing.
alter table public.properties
  add column if not exists publications jsonb default '{}'::jsonb;

-- Migración cartera real (CRM Varela). Idempotencia global + código comercial.
-- `legacy_id`: id del CRM (reimportar actualiza en vez de duplicar, aunque se dispare
--   desde otro entorno). `codigo`: código comercial visible (VAR-xxxxx), independiente del id interno.
alter table public.properties
  add column if not exists legacy_id text,
  add column if not exists codigo text;
create index if not exists idx_properties_legacy_id on public.properties(legacy_id);

-- App Personas (base). Una Persona puede tener múltiples roles (propietario,
-- comprador, inquilino, contacto, escribano...). Hoy el rol operativo es 'propietario'.
-- La propiedad ya referencia a la persona vía properties.owner_id.
create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null default 'vera-default',
  full_name text not null,
  phone text default '',
  email text default '',
  notes text default '',
  roles jsonb not null default '["propietario"]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_people_workspace on public.people(workspace_id);

-- Radar: marca la propiedad como "destacada" en la portada del sitio público.
-- Idempotente; la columna ya existe en producción (migrada por fuera).
alter table public.properties add column if not exists radar boolean not null default false;
