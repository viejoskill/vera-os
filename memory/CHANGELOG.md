# VERA OS — Changelog

(Los sprints anteriores están documentados en `PRD.md`. Los nuevos se registran acá para mantener PRD.md < 700 líneas.)

## Sprint 2 — Wizard de Creación de Documentos (2026-06)
Flujo end-to-end para instanciar un documento donde VERA autocompleta las variables conocidas desde Personas/Propiedades/Config, sin pedirle al usuario datos que ya existen. Verificado 100% por testing agent (iteration_37): backend 7/7 pytest, frontend E2E verde, tsc limpio, sin bugs.

- **Ruta dedicada** `/documentos/nuevo` (decisión del usuario: NO modal — el flujo va a crecer: PDF, firma, historial). Botón "Nuevo Documento" (`new-document-btn`) en `DocumentsScreen`.
- **Pasos dinámicos según el template**: Template → (Propiedad si el template tiene variables `source=property`) → (Personas si tiene variables `source=person`, un select por rol) → Revisión. Los roles NO son una lista fija: surgen de las variables del template (`role`), haciendo el motor documental extensible (Autorización→Propietario/Vendedor, Reserva→Comprador+Vendedor, etc.).
- **Revisión con 3 categorías** (pedido del usuario): ✅ Completado por VERA (con badge de origen: Propiedad/Persona/Configuración), ✏️ Requiere tu intervención (obligatorios faltantes + inputs opcionales, editables), ⚠️ Advertencias (datos opcionales que VERA no pudo completar, no bloquean). Revalida en vivo (debounce 300ms) al editar. "Crear documento" habilitado solo si `ready` (sin obligatorios faltantes).
- **Backend**:
  - `resolver.py` reescrito: `resolve()` devuelve `{requirements, resolved, missing, warnings, fields[], ready}`. Cada field trae `{key,label,type,source,role,required,value,origin,status}` (status: resolved/missing/warning/optional). Los valores tipeados por el usuario (`inputs`) funcionan como override para cualquier variable (incluidas person/property incompletas).
  - `service.py`: agregado el import faltante `from documents import resolver` (bug del fork anterior — rompía create/resolve). `create_document` bloquea con 422 si falta un obligatorio.
  - `api.py`: nuevo `POST /api/documents/resolve` (preview sin crear).
  - Contrato camelCase (frontend consume sin transformar).
- **Frontend**: `DocumentWizard.tsx` (nuevo), `useDocuments.ts` (agregado `useTemplate`, `useResolveDocument`, `useCreateDocument`; `apiPost` con parsing de `detail` string/objeto → muestra "Faltan: …"). Estilos `.vera-wizard*` / `.vera-review*` con tokens (cero colores hardcodeados salvo verdes/ámbar semánticos de estado).
- Regresión: `/app/backend/tests/test_documents_wizard.py`.
- **Nota**: la base tiene templates `TEST_*` creados por corridas previas del testing agent (ruido, no borrados por diseño — no hay DELETE). El primer template REAL oficial ("Autorización de Venta") se construirá como próximo paso.

### Próximos pasos (Sprint 3+)
- P0: Primer template REAL "Autorización de Venta" (con body/variables definitivos).
- P1: Generación de PDF; Editor visual de documentos; Firma electrónica.
- P2: Automatizaciones sobre eventos de documento; migrar formularios legacy; promover "Operaciones" a "Hoy"; módulo "Audiencias".
