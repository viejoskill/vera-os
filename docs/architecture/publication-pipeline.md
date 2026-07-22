# Arquitectura — Pipeline de Publicación Web (VERA → Sitio Público)

> Estado: **IMPLEMENTADO**. Documento oficial de arquitectura de VERA.
> Regla de arquitectura (invariante): **la ÚNICA fuente de verdad de la URL pública de una
> propiedad es `publications["web-varela"].url`**. No existe ninguna otra forma de construir
> o inferir la URL. Ningún componente arma la URL por convención.

## Diagrama del flujo
```
                 (1) Publicar / Editar / Importar
Usuario/Agente ─────────────────────────────────────────► VERA API (FastAPI)
                                                              │
                                                              │ web_publisher.publish(prop)
                                                              │   • upsert fila en CRM
                                                              │   • VALIDA que la fila exista
                                                              ▼
                                              Supabase CRM (fwwzjynerfghqsakkyvq)
                                                     tabla `propiedades`
                                                              ▲
                                                              │ lee EN VIVO (anon key)
                                                              │
Sitio público estático (GitHub Pages) ───────────────────────┘
  www.varelapropiedadescde.com.ar
  Ficha por deep-link:  /?propiedad=<idPúblico>
```
- VERA guarda sus datos en **su** Supabase (`tlptpyhtddwaiwzmzgcg`).
- Al publicar, VERA **empuja** una fila al Supabase del CRM (`fwwzjynerfghqsakkyvq`) que la web lee en vivo.
- El sitio público **no tiene rutas por propiedad**: abre una ficha (overlay) con `/?propiedad=<id>`.

## Componentes
| Componente | Rol |
|---|---|
| `backend/web_publisher.py` | Driver del canal `web-varela`. `publish()` (upsert + **validación**), `unpublish()` (estado `Pausada`), `web_url()` (URL canónica), `_legacy_id()` (id público), `stored_public_url()` (**lector** de la fuente única). |
| `backend/routes_properties.py` | `set_publication` (publica y persiste `.url`), `PATCH` (auto re-sync que **también** persiste `.url`). |
| `backend/legacy_import/importer.py` | Importa del CRM; `_map_publications` persiste `.url` con `web_publisher.web_url`. |
| `backend/serializers.py` | `property.publicUrl = web_publisher.stored_public_url(prop)`. |
| `backend/routes_public.py` | API pública de VERA: expone `publicUrl` leyendo la fuente única. |
| `backend/inquiries.py` | Link WhatsApp con tracking: **deriva** de `stored_public_url` (no construye). |

## Identificador público (`_legacy_id`)
```python
prop.legacy_id  # id original del CRM (ej. "mnml9wp6...") si la propiedad fue importada
      or  f"vera-{prop['id']}"   # si nació en VERA (determinístico, idempotente)
```
`web_url(prop) = "https://www.varelapropiedadescde.com.ar/?propiedad=" + _legacy_id(prop)`

## Ciclo de vida de `publications["web-varela"]`
| Momento | status | url |
|---|---|---|
| Publicar (`action=publish`) | `published` | `web_url(prop)` (validado) |
| Editar propiedad publicada (`PATCH`) | `published` | re-persistida (validado) |
| Importar del CRM (`publicado_web`) | `published` | `web_url({legacy_id})` |
| Fallo de publicación/validación | `inconsistent` | `""` |
| Despublicar (`action=unpublish`) | `none` | `""` |

## Validación (invariante de integridad)
`web_publisher.publish()` hace el upsert y luego **verifica** que la fila exista en el CRM
(`_row_exists`). Si el upsert o la verificación fallan:
1. Se registra `logger.error(... INCONSISTENTE ...)`.
2. La publicación queda marcada `status: "inconsistent"`, `url: ""`.
3. `publicUrl` resultante es **`null`** → la UI NO muestra "Compartir".

> Principio: **preferimos una propiedad sin botón "Compartir" que una con un enlace incorrecto.**

## Lectura (un solo punto)
`property.publicUrl` = `stored_public_url(prop)`:
```python
web = publications.get("web-varela") or {}
return web["url"] if web.get("status") == "published" and web.get("url") else None
```
Todos los módulos (Compartir, QR, Studio, emails, campañas, analytics, futuras APIs)
consumen **exclusivamente** `property.publicUrl`.

## Backfill (histórico)
`backend/scripts/backfill_public_url.py` — corrida única para las propiedades importadas
que tenían `url: ""`. Calcula `web_url(prop)`, valida existencia en el CRM y persiste
`.url` (o marca `inconsistent`). Resultado inicial: **28 corregidas, 0 inconsistentes, 1 ya OK**.

## Config
- `CRM_SUPABASE_URL` = `https://fwwzjynerfghqsakkyvq.supabase.co`
- `CRM_SUPABASE_WRITE_KEY` (service_role) para el upsert.
- `ENABLED_PUBLICATION_CHANNELS = {"web-varela", "mercadolibre"}`.

## Contrato desacoplable
El día que se reemplace el sitio público, se cambia SOLO `web_publisher` (`publish`/`unpublish`/
`web_url`/`_legacy_id`). El resto de VERA (que consume `property.publicUrl`) no cambia.
