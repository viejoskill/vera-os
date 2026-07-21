-- Sprint Personas (MVP): amplía la entidad `people` de VERA Core.
-- Correr UNA VEZ en Supabase → SQL Editor. Es idempotente (IF NOT EXISTS).

ALTER TABLE people ADD COLUMN IF NOT EXISTS phones        jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE people ADD COLUMN IF NOT EXISTS emails        jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE people ADD COLUMN IF NOT EXISTS document      text  NOT NULL DEFAULT '';
ALTER TABLE people ADD COLUMN IF NOT EXISTS status        text  NOT NULL DEFAULT 'active';
ALTER TABLE people ADD COLUMN IF NOT EXISTS primary_phone text  NOT NULL DEFAULT '';
ALTER TABLE people ADD COLUMN IF NOT EXISTS primary_email text  NOT NULL DEFAULT '';

-- Backfill desde las columnas legacy phone/email (sólo si están vacías).
UPDATE people SET primary_phone = phone WHERE primary_phone = '' AND coalesce(phone,'') <> '';
UPDATE people SET primary_email = email WHERE primary_email = '' AND coalesce(email,'') <> '';
UPDATE people SET phones = jsonb_build_array(phone) WHERE phones = '[]'::jsonb AND coalesce(phone,'') <> '';
UPDATE people SET emails = jsonb_build_array(email) WHERE emails = '[]'::jsonb AND coalesce(email,'') <> '';
