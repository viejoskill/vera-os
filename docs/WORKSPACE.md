# VERA — Reglas permanentes del Workspace de Propiedad

El **Workspace de Propiedad** es un pilar de VERA OS. Estas reglas son arquitectura
permanente del sistema, no de una implementación puntual.

## Regla 0 — Un solo lugar
Toda funcionalidad de una propiedad vive dentro de su Workspace. No existen pantallas
paralelas para editar, publicar, documentos, fotografías, Vera Studio o Health Score.
La navegación cambia de **contexto** (sección), nunca de **paradigma**. El usuario nunca
siente que "sale" de la propiedad.

- `Nueva propiedad` → Workspace vacío (`/propiedades/nueva`).
- `Abrir propiedad` → Workspace cargado (`/propiedades/:id`).
- `Duplicar` (futuro) → otro Workspace.
Un único componente reutilizable. Solo cambia el modo de apertura.

## Regla A — Persistencia en vivo de archivos
En una propiedad **existente** (con id), las acciones de archivos/galería se persisten
**inmediatamente** (sin "Guardar"): subir foto, eliminar foto, reordenar, cambiar portada,
subir documento, eliminar documento. Los **datos de negocio** (título, precio, descripción,
dirección, ambientes, superficies, estado, propietario) se guardan con el botón "Guardar".
En una propiedad **nueva** (sin id) los archivos se suben en el primer "Guardar" (no hay id
al cual asociarlos hasta crearla).

## Regla A.1 — Atomicidad
Toda operación de persistencia en vivo es atómica. Si falla, la UI **revierte
automáticamente** al estado anterior y muestra un mensaje claro. Nunca dejar la galería en
estado inconsistente.

## Regla B — Feedback sutil
Comunicar el estado de la operación de forma discreta (`Guardando…` / `Guardado` /
`Error al guardar`). Sin loaders invasivos ni bloqueo del Workspace. El usuario trabaja
sobre un sistema vivo.

## Regla C — Portada ≠ Orden
Son conceptos distintos. **Portada** = imagen principal (elección explícita por clic).
**Orden** = secuencia narrativa de la galería (persistida). Mover una foto a la posición 1
puede *sugerir* portada, pero **nunca** cambia la portada automáticamente. Siempre prevalece
la decisión explícita del usuario. *VERA sugiere, el usuario decide.*

## Regla D — Ciclo de vida: Archivar es la regla, Eliminar la excepción
- **Archivar** (acción principal): conserva todo (fotos, documentos, historial, Health
  Score), sale de la lista principal, recuperable. Filtro "Archivadas" para consultarla/
  restaurarla. Vive en la sección "Ciclo de vida" del Workspace y en el menú "…" de la card.
- **Eliminar**: operación administrativa y excepcional. **No** hay botón visible en la UI
  principal. Solo administradores, tras doble confirmación explícita que advierte que se
  borran fotos, documentos, relaciones y archivos del storage, y que es irreversible.

## Regla E — Foco
No se comienza una funcionalidad nueva hasta que la anterior esté realmente terminada.

## Regla F — VERA propone, el profesional decide (IA)
Toda funcionalidad de IA dentro de VERA **genera sugerencias**; nunca sobrescribe información
automáticamente. El usuario siempre conserva la decisión final. Ejemplos: "VERA sugiere un
título" ofrece 3 opciones y el profesional elige cuál usar (o ninguna); las descripciones y
destacados futuros seguirán el mismo patrón (proponer → el usuario aplica).

Implementación de referencia (título): el frontend nunca conoce el LLM. Flujo
`TitleSuggestions.tsx` → `useTitleSuggestions` → `AiContentService` → `ApiAiContentGateway`
→ `POST /api/ai/content` → `ai_content_service.py` (Gemini vía Emergent LLM key). El endpoint
es **reutilizable** con `mode` (hoy `title`; preparado para `description`, `highlights` y
variantes por portal como Mercado Libre / Zonaprop) sin rediseñar esta capa. Reglas de
generación de títulos: 3 opciones distintas, máx. 70 caracteres, sin mayúsculas innecesarias,
naturales, ciudad cuando aporta, priorizar lo que vende, y **nunca inventar datos**.
