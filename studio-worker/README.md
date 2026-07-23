# VERA OS Studio — Contador de consumo por código (Cloudflare Worker + D1)

Mide cuánta IA gasta **cada cliente** (por su código de acceso), para poder comercializar
Studio con paquetes/recargas y detectar códigos compartidos. Todo vive en Cloudflare:
el Worker cuenta cada generación en D1 y sirve un panel privado con el consumo por código.

## Qué hace
- `POST /chat` → OpenAI (gpt-4o-mini). Cuenta **1 texto** por generación exitosa.
- `POST /imagen` → OpenAI (gpt-image-1, n=1). Cuenta **1 imagen** por generación exitosa.
- `GET /admin?key=ADMIN_KEY` → panel HTML: por código, texto/imagen/total del **mes actual** y **histórico**, y última actividad.
- `GET /admin/usage?key=ADMIN_KEY` → los mismos datos en JSON (por si querés integrarlo a otro lado).

El código de acceso sigue siendo la **licencia**: sin código válido, la IA no responde.

---

## Setup en el panel de Cloudflare (sin instalar nada)

### 1) Crear la base D1
Workers & Pages → **D1 SQL Database** → **Create** → nombre: `veraos` → Create.

### 2) Crear la tabla
Entrá a la base `veraos` → pestaña **Console** → pegá y ejecutá el contenido de `schema.sql`.

### 3) Vincular la base al Worker
Tu Worker (`veraos`) → **Settings** → **Bindings** → **Add** → **D1 database**:
- Variable name: `DB`
- D1 database: `veraos`
→ Save.

### 4) Agregar la clave de administración
Worker → **Settings** → **Variables and Secrets** → **Add**:
- Type: **Secret** · Name: `ADMIN_KEY` · Value: una clave larga tuya (ej: `varela-admin-9f3k...`)
→ Deploy. (Ya deberías tener `OPENAI_KEY` y `VERA_CODES` de antes.)

### 5) Actualizar el código del Worker
Worker → **Edit code** → reemplazá todo por el contenido de `veraos-worker.js` → **Deploy**.

### 6) Ver el consumo
Abrí en el navegador:
```
https://veraos.varelavendecde.workers.dev/admin?key=TU_ADMIN_KEY
```
Vas a ver una tabla por código con el consumo del mes y el histórico. Guardala en favoritos.

---

## Alta / baja de clientes (igual que antes)
- **Alta**: agregar el código nuevo a `VERA_CODES` (separado por coma) → Deploy.
- **Baja**: borrar el código de `VERA_CODES` → Deploy. Deja de funcionar en segundos.
  (El histórico de consumo de ese código queda guardado en D1.)

## Notas
- Los contadores son por generación (no por tokens/costo exacto). Sirven para dimensionar
  paquetes y detectar abuso. Para costo en USD real, mirá OpenAI → Usage.
- El período usa mes calendario UTC (`YYYY-MM`).
- Si D1 llegara a fallar, la generación de IA igual funciona (el conteo es best-effort).
- Alternativa por línea de comandos (opcional): `wrangler d1 create veraos`,
  `wrangler d1 execute veraos --file=schema.sql`, y binding en `wrangler.toml`.
