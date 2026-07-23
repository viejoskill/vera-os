-- VERA OS Studio — esquema D1 para el contador de consumo por código.
-- Ejecutar una vez en la consola de la base D1 (Cloudflare → D1 → tu base → Console).

CREATE TABLE IF NOT EXISTS usage (
  code    TEXT NOT NULL,          -- código de acceso del cliente (X-Vera-Code)
  kind    TEXT NOT NULL,          -- 'texto' (gpt-4o-mini) | 'imagen' (gpt-image-1)
  ym      TEXT NOT NULL,          -- período YYYY-MM (UTC)
  n       INTEGER NOT NULL DEFAULT 0,  -- cantidad de generaciones
  last_at TEXT,                   -- ISO timestamp de la última generación
  PRIMARY KEY (code, kind, ym)
);

CREATE INDEX IF NOT EXISTS idx_usage_code ON usage (code);
CREATE INDEX IF NOT EXISTS idx_usage_ym   ON usage (ym);
