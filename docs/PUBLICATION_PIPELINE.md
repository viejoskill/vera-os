# Pipeline de Publicación Web — VERA → Sitio público (varelapropiedadescde.com.ar)

> Documento de investigación. **Fuente de verdad de `publicUrl`.** No inventar URLs por convención: la URL nace del proceso de publicación que YA existe dentro de VERA.

## TL;DR
- El sitio público es **estático (GitHub Pages)** y **no tiene rutas por propiedad**. Cada propiedad se abre en una ficha (overlay) sobre la home. Por eso `/propiedad/var-163159` da **404**.
- El formato de URL que SÍ funciona (lo usa el propio sitio en "Copiar link" y para deep-link):
  `https://www.varelapropiedadescde.com.ar/?propiedad=<idPúblico>`
- El **componente que publica** es **`backend/web_publisher.py`** (driver del canal `web-varela`). Vive dentro de VERA (no en un repo aparte).
- El **id público** lo genera `web_publisher._legacy_id(prop)`:
  - `prop.legacy_id` (id del CRM, ej. `mnml9wp6...`) si la propiedad fue **importada** del CRM, o
  - `vera-<uuid_de_VERA>` si la propiedad **nació en VERA** (determinístico, idempotente).
- La **URL canónica correcta ya se calcula** en `web_publisher.web_url(prop)` y **se persiste** en `publications['web-varela'].url` al publicar.
- **Fuente de verdad de `publicUrl`** = `publications['web-varela'].url`.
- **Estado actual (deuda):** de 29 propiedades, **solo 1** tiene `.url` persistida (la publicada por el pipeline nuevo). Las **28 importadas** están `status: published` pero con `url: ""` (el import nunca la seteó → línea `_map_publications`).

---

## Respuestas a las preguntas

### 1) ¿Qué componente publica una propiedad desde VERA hacia el sitio público?
`backend/web_publisher.py`, funciones `publish(prop)` / `unpublish(prop)`. Hace un **upsert** (REST PostgREST, `on_conflict=id`, `merge-duplicates`) en la tabla `propiedades` del Supabase del CRM. `unpublish` no borra: pone `estado = "Pausada"` (que la web no muestra).

### 2) ¿En qué repositorio está implementado?
Dentro de **este mismo repo/monorepo de VERA** (`/app/backend/`). No hay repo externo de publicación. El sitio público (GitHub Pages) es solo un **consumidor** que lee en vivo la tabla `propiedades`.

### 3) ¿Cómo se genera el identificador público (`vera-<uuid>` u otro)?
`web_publisher._legacy_id(prop)`:
```python
return (prop.get("legacy_id") or "").strip() or f"vera-{prop['id']}"
```
- **Importadas del CRM** → `legacy_id` = id original del CRM (ej. `mnml9wp6t44uxovcbud`). Se guarda en la columna `properties.legacy_id` durante la migración (`legacy_import/importer.py`, `payload["legacy_id"] = lid`).
- **Nacidas en VERA** → `vera-<uuid>` (determinístico ⇒ re-publicar actualiza, no duplica).

Esto **no es una convención inventada**: es la clave de idempotencia del propio pipeline (mismo `id` en ambos lados).

### 4) ¿Quién escribe el registro en Supabase (CRM)?
`web_publisher.publish()`, autenticado con `config.CRM_SUPABASE_WRITE_KEY` (service_role, evita RLS).
- Destino: `CRM_SUPABASE_URL` = `https://fwwzjynerfghqsakkyvq.supabase.co`, tabla `propiedades`.
- ⚠️ Es un **Supabase DISTINTO** al de VERA (`tlptpyhtddwaiwzmzgcg`). VERA guarda sus datos en su propio Supabase; al publicar, **empuja** una fila al Supabase del CRM que lee la web.
- Fotos: `web_publisher._photo_urls()` firma URLs del Storage de VERA con **TTL ~10 años** (para que no caduquen en la web).

### 5) ¿En qué momento una propiedad pasa a estar realmente publicada?
Se dispara **manualmente** (VERA nunca publica solo): `POST /api/properties/{id}/publications/web-varela` con `action=publish|update`.
Flujo (`routes_properties.set_publication`):
1. `web_publisher.publish(prop)` → upsert en el CRM.
2. `publications['web-varela'] = {status:"published", lastSync:<now>, url: web_publisher.web_url(prop)}` → **acá se persiste la URL correcta**.
Además, al **editar** una propiedad ya publicada, `PATCH /api/properties/{id}` hace un **auto re-sync** (`web_publisher.publish`) para reflejar cambios — pero **NO reescribe `publications.url`** (gap menor: si la url estaba vacía, sigue vacía).
En la **importación** (`legacy_import`), si el CRM traía `publicado_web=true`, se marca `status:"published"` pero con **`url: ""`** (nunca se llamó a `web_url`).

### 6) ¿Cuál debería ser la fuente de verdad de `publicUrl`?
**`publications['web-varela'].url`** — el valor que ESCRIBE el pipeline de publicación.
- Si está publicada y tiene `.url` → esa es la URL.
- Si no está publicada en `web-varela` → `publicUrl = null`.
- El generador determinístico correcto (para calcular/backfillear) es **`web_publisher.web_url(prop)`**, NO una convención nueva en la feature Compartir.

> La `inquiries.canonical_url()` que se agregó en el sprint anterior (`/propiedad/{code}`) es **incorrecta** y es la causa del 404. Debe eliminarse y `publicUrl` debe leer `publications['web-varela'].url`.

### 7) ¿Dónde conviene persistir el dato para que cualquier módulo lo reutilice?
Ya existe el lugar correcto: **`publications['web-varela'].url`** en la propiedad (Supabase de VERA). Todos los módulos (Compartir, QR, Studio, emails, campañas, analytics) deben leer `property.publicUrl`, que se deriva de ese campo. Un solo punto de escritura (`web_publisher.web_url` en `set_publication` / re-sync / import) y un solo punto de lectura (`publicUrl`).

---

## Estado / deuda técnica detectada (para el próximo paso, NO implementado aún)
1. **28/29 propiedades sin `.url`**: fueron importadas con `url:""`. Backfill sugerido: setear `publications['web-varela'].url = web_publisher.web_url(prop)` para las que estén `published` (usa su `legacy_id`, así apunta a la fila real del CRM, ej. `?propiedad=mnml...`).
2. **Auto re-sync no persiste `.url`**: en `PATCH /api/properties/{id}`, cuando re-publica, debería también asegurar `publications['web-varela'].url`.
3. **`publicUrl` actual roto**: hoy la API devuelve la URL `/propiedad/{code}` (convención errónea del sprint anterior) → produce 404. Reemplazar por lectura de `publications['web-varela'].url`.
4. **Import debería setear `.url`**: en `_map_publications`, cuando `publicado_web`, ya se puede calcular la url determinística (requiere el `legacy_id`, que está disponible en ese punto).

## Plan recomendado (para aprobar antes de implementar)
- `publicUrl` (backend `serializers.property_to_response`) = `publications['web-varela'].url or None`. Eliminar `inquiries.canonical_url`/`public_url_or_none`.
- Garantizar que `publications['web-varela'].url` se escriba SIEMPRE que se publique/re-sincronice (set_publication ya lo hace; sumar en el auto re-sync del PATCH y en el import).
- Backfill único de las 28 propiedades publicadas sin `.url` usando `web_publisher.web_url(prop)`.
- Recién entonces, "Compartir" consume `property.publicUrl` (ya implementado en el frontend; solo cambia la fuente del dato en el backend).

## Archivos de referencia
- `backend/web_publisher.py` — driver de publicación (`publish`, `unpublish`, `web_url`, `_legacy_id`).
- `backend/routes_properties.py` — `set_publication` (publica y persiste `.url`), auto re-sync en `PATCH`.
- `backend/legacy_import/importer.py` — import del CRM; `_map_publications` (setea `url:""`), `payload["legacy_id"]`.
- `backend/config.py` — `CRM_SUPABASE_URL`, `CRM_SUPABASE_WRITE_KEY`, `crm_configured()`, `ENABLED_PUBLICATION_CHANNELS`.
- Sitio público: lee `fwwzjynerfghqsakkyvq.supabase.co` tabla `propiedades`; deep-link `?propiedad=<id>` → `abrirFicha(id)`.
