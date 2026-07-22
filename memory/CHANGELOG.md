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

## Sprint 3 — Motor de firmas (2026-06)
Motor de firmas transversal a TODO el módulo documental (reutilizable por cualquier documento futuro). Verificado 100% por testing agent (iteration_38): backend 10/10 pytest, frontend E2E verde, tsc limpio, sin bugs. Migración SQL corrida por el usuario (`document_participants` + `signature_methods` en templates + `signature_method` en documents).

- **Principio de producto**: se firma un **Documento, no un PDF**. El motor no conoce el formato de salida; deja un *contrato de render* (`SignatureRenderStrategy`: presencial → línea/imagen manuscrita; digital → bloque de certificación) para cuando se genere PDF/DOCX/HTML.
- **Template declara métodos** (`signatureMethods: ["presencial","digital"]`); **Documento guarda el elegido** (`signatureMethod`).
- **DocumentParticipant** (entidad explícita, tabla propia): estado individual `pending→sent→viewed→signed` + `rejected/expired`, `order`, `signature_required`, `signature_method`, token de firma, `signature_data`. Soporta N firmantes, secuencial o paralelo. Estado AGREGADO del documento (`signature_state`: none/pending/in_progress/signed/rejected) derivado de los participantes.
- **SignatureProvider (adapter)** `documents/signatures.py`: `VeraNativeSignatureProvider` (certificación propia con hash de integridad). DocuSign/Adobe se suman implementando la misma interfaz — la app solo habla con `SignatureProvider`. Punto único de acoplamiento `active_signature_provider`.
- **Enlaces seguros** `/firma/{token}`: token `secrets.token_urlsafe(32)`, vence a 7 días, se invalida al firmar/rechazar, identifica exactamente al participante. Endpoints públicos `GET/POST /api/sign/{token}` (sin auth, `routes_sign.py`).
- **Canales** (`whatsapp/email/link`): todos usan EL MISMO token. VERA no envía sola — devuelve enlace + mensaje sugerido (wa.me / mailto / copiar), coherente con el resto del producto.
- **Máquina de estados** con eventos inmutables en el ledger (MongoDB): `document.signature.method_set`, `.participant.sent/viewed/signed/rejected`, `.shared`, `.signed`. Al firmar todos los obligatorios → documento `signed` + `locked_at` (inmutable).
- **Frontend**: paso **"Firma"** en el wizard (elige método + firmantes); **pantalla de detalle** `/documentos/:id` (estado, firma, método, firmantes con estado, timeline de eventos, acciones; "Generar PDF" deshabilitado "Próximamente"); **pantalla pública de firma** `/firma/:token` (digital con certificación; presencial: papel / dibujada en canvas / tipeada; rechazar; estados éxito/error).
- Nota: "Generar PDF" quedó deshabilitado a propósito (la generación es el próximo sprint). El botón PATCH de template ahora también actualiza `signatureMethods`.

## Ajuste UX firma — confirmación + documento descargable (2026-06)
Pedido del usuario tras probar en producción: al firmar, que confirme el éxito y lleve a ver/descargar el documento. Verificado por curl + pytest (10/10) + screenshot.
- El enlace `/firma/{token}` ya **no se invalida por completo** al firmar: sigue sirviendo para **VER** el documento firmado (re-firmar queda bloqueado por estado → 410). `public_sign_view` distingue `expired` (venció por tiempo) de `alreadySigned`/`rejected` y devuelve la certificación (`signedAt`, `signatureData.hash`).
- Pantalla pública: el estado de éxito ahora muestra **"¡Firma registrada!"** + el **documento** (cuerpo con variables resueltas) + un **Certificado de firma · VERA** (firmante, rol, método, fecha, hash de integridad; imagen si fue dibujada) + botón **Descargar / Imprimir** (`window.print()` con hoja de estilo de impresión que aísla el documento).

## Sprint 3 — Autorización de Venta oficial + mejoras de pantalla (2026-06)
Primer template REAL del motor documental (NO mock) + motor de variables con defaults, selects y bloques condicionales + 3 mejoras de la pantalla de detalle. Verificado 100% (iteration_39): backend 10/10 pytest (`test_documents_sprint3.py`), frontend E2E verde, tsc limpio, sin bugs. Los 10 caminos condicionales (5 condiciones × 2 valores) validados.

- **Template "Autorización de Venta"** (`autorizacion_venta` v1, `signatureMethods: digital+presencial`), seed idempotente `scripts/seed_autorizacion_venta.py`. Variables auto-resueltas (fecha, propietario nombre/DNI, propiedad dirección/localidad/tipo) + entradas con defaults editables (inmobiliaria=Varela Propiedades, modalidad=exclusiva, moneda=USD, vigencia=180, comisión=3% editable, pago al boleto, admite_reserva=sí, renovación=sí) + precio (obligatorio) + observaciones. Cuerpo legal con **bloques condicionales**: exclusividad vs no exclusiva, comisión al boleto vs a la escritura, reserva/renovación/precio mínimo condicionales, declaraciones del propietario.
- **Extensión del modelo**: `TemplateVariable` ahora tiene `options` (para `type=select`) y `default` (editable). Bloques del cuerpo aceptan `condition` (`equals` / `in` / `notEmpty`). `create_template`/`new_template_version` persisten `signature_methods` (faltaba). `UpdateTemplateRequest` acepta `signatureMethods`.
- **Resolver**: aplica defaults editables; los campos `source=input` son SIEMPRE editables (no quedan bloqueados en ✅); obligatorios vacíos → ✏️ (bloquean). Selects devuelven `options`.
- **Wizard · Revisión**: renderiza el control correcto por tipo (select con opciones, number, textarea, text), pre-cargado con defaults; "Crear documento" deshabilitado hasta completar obligatorios.
- **Render compartido** `screens/documents/render.ts` (`interpolate` + `isBlockVisible` + `renderBlocks`), reutilizado por la firma pública y el detalle (y a futuro el PDF).
- **Pantalla de detalle (centro de operaciones)** — 3 mejoras pedidas: (a) **Estado humano** con ícono + fecha/hora; (b) **Firmantes** con nombre · rol · estado · fecha de firma; (c) tarjeta **"Relacionado con"** (🏠 Propiedad navegable, 👤 Propietario/s navegable, 💼 Operación — "Sin vincular" hasta Sprint 6). Además: **preview del Documento** (cuerpo interpolado con bloques condicionales aplicados).

### Roadmap acordado con el usuario
- **Sprint 4 — Generación de PDF** (una vez que el template esté perfecto): PDF con líneas manuscritas (presencial) o bloque de certificación (digital). Contrato `SignatureRenderStrategy` ya listo.
- **Sprint 5 — WhatsApp**: enviar → cliente → firma → **notificación automática** al asesor.
- **Sprint 6 — Automatizaciones**: al firmarse una Autorización → Propiedad a estado "Captada" → Knowledge Engine actualiza propietario + oportunidad + crea tarea.
- **Post-template (pedido del usuario)**: dentro de la Propiedad, checklist **"Documentación"** (Autorización/Reserva/Recibo/Escritura) que se tilda cuando se firma + "Ver Documento". Ya viable ahora que existe el template.
