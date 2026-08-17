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

## Fix · Foco en campos de la Revisión (2026-06)
Bug reportado: al tipear un número/letra en los campos de la Revisión, "se auto-guardaba y no dejaba terminar" (se perdía el foco). Causa: el wizard re-resolvía (fetch) en cada cambio de `inputs`, lo que re-renderizaba y, peor, movía un campo override (ej. DNI) de "✏️" a "✅" apenas se escribía, robando el foco.
- Ahora el resolve solo corre ante cambios ESTRUCTURALES (template/propiedad/personas), no al tipear.
- La validación "listo para crear" se calcula localmente (`canCreate`) contra los inputs actuales + defaults; el backend sigue validando (422) al crear.
- Verificado por navegador: tipeo lento en `precio` y `propietario_dni` sin pérdida de foco; el campo override permanece editable en "Requiere tu intervención".

## Sprints 4 y 5 — PDF + Notificaciones + Documentación en Propiedad (2026-06)
Verificado 100% (iteration_40): backend 7/7 pytest (`test_documents_sprint4_5.py`), frontend E2E completo, tsc limpio.

- **Sprint 4 · Generación de PDF a demanda** (`documents/pdf.py`, reportlab): `GET /api/documents/{id}/pdf` devuelve `application/pdf` inline (ver/descargar/imprimir). Reusa cuerpo + bloques condicionales; según método: **presencial** → líneas de firma manuscrita (o imagen dibujada/escaneada), **digital** → bloque de certificación (firmante, fecha, hash). Botón "Generar / Descargar PDF" en el detalle. Sin almacenamiento (on-demand). `reportlab` agregado a requirements.
- **Sprint 5 · Notificaciones in-app** (opción A, nativa, sin proveedores): colección Mongo `notifications` (`documents/notifications.py`) + `routes_notifications.py` (`GET /api/notifications`, `POST /{id}/read`, `POST /read-all`). Al firmar un participante se crea "✍️ Firma recibida" con el nombre del firmante y link al documento. **Campanita 🔔** en el header (`NotificationBell.tsx`, polling 20s) con badge de no leídas, panel, marcar leídas y navegación al documento.
- **Documentación en la Propiedad** (`DocumentacionSection.tsx`): tarjeta con checklist Autorización/Reserva/Recibo/Escritura; ☑ verde si hay documento firmado de esa categoría, ⏳ ámbar si está en proceso, ○ si no existe (+ "Crear"). "Ver documento" navega al detalle. Endpoint `GET /api/documents/by-property/{id}` (batch, sin N+1: 3 requests; ~1.7s con 38 docs vs 15s antes) + skeleton de carga.
- **Aviso de DNI** (quick win): en la Revisión del wizard, los campos obligatorios que VERA no pudo autocompletar desde una persona/propiedad muestran un hint ("La persona seleccionada no tiene este dato cargado; completalo acá."). Nuevo prop `hint` en el `Input` de `@vera/ui`.
- **TODO documentado** (code review): `notifications.list_recent` no filtra por asesor (OK para MVP mono-usuario; agregar filtro por tenant cuando haya auth de rol).

## 2026-06 · Fix suite de tests + verificación formato PDF
- **Fix pytest** (`tests/test_documents_sprint4_5.py`): `REACT_APP_BACKEND_URL` sólo vive en `/app/frontend/.env`, no en el backend → el test rompía con `AttributeError: 'NoneType'.rstrip`. Ahora el test hace `load_dotenv("/app/frontend/.env")` y usa fallback `http://localhost:8001`. Suite verde 7/7.
- **Verificación formato PDF "Autorización de Venta"** (`documents/pdf.py`): confirmado vía API real (precio 129000) → encabezado "VARELA PROPIEDADES", `USD 129.000` (separador de miles argentino), negritas en DNI/nombres y rótulos de cláusula, bloque de certificación digital. OK.

## 2026-07-22 · Fix impresión de firma + copiar enlace
- **PDF/impresión montada** (`index.css` @media print): `.vera-sign__doc` tenía `max-height:260px; overflow:auto`; al imprimir recortaba el texto y el "Certificado de firma" se montaba encima. Ahora en print el documento fluye completo (`max-height:none; overflow:visible`) y el certificado usa `break-inside:avoid`. Verificado con emulación print → sin solapamiento.
- **Copiar enlace de firma** (`DocumentDetail.tsx`): `navigator.clipboard.writeText` fallaba en silencio (contexto iframe/no-seguro) y el flash igual decía "copiado" → el usuario pegaba la URL del sistema. Ahora `copyLink()` intenta clipboard API, cae a `execCommand('copy')`, y si falla muestra la URL real en el flash (12s) para copiar a mano.
- Nota data: hay personas de prueba con emoji en el nombre ("Cata 💗") → en el PDF reportlab se ve como ■ (glyph no soportado por Helvetica). Pendiente sanitizar glyphs si molesta.

## 2026-07-23 · VERA Studio embebido + sincronización por usuario
- **Integración de VERA Studio** (herramienta de contenido de redes, HTML autocontenido) dentro del OS. Solapa "Studio" activada (`feature-flags.ts studio:true`).
- **Frontend** (`StudioScreen.tsx`): iframe a `public/vera-studio.html?u=<userId>` (id del usuario Supabase logueado) + barra con "Abrir en pestaña". Estilos `.vera-studio*` en index.css.
- **Puente de persistencia**: el HTML ya soportaba un adaptador `window.storage` (fallback a localStorage). Inyectamos (`/tmp/inject_studio.py`) un `window.storage` que lee `?u=` y guarda/lee del backend. Sin tocar la lógica del tool. Claves: `ev_identidad`, `ev_logo`, `ev_plan`.
- **Backend** (`routes_studio.py`, Mongo `studio_kv`): `GET/PUT /api/studio/kv/{key}?u=` y `GET /api/studio/state?u=`. Estado atado al usuario → sincroniza entre PCs. Aislamiento por usuario verificado (otro uid → null).
- **Verificado E2E**: login qa_varela → /studio renderiza embebido → editar identidad (código VARELA-CDE-2026, tel) → persiste en backend para ese uid. Las llamadas de IA siguen yendo al Worker de Cloudflare con `X-Vera-Code` (intactas).
- ⚠️ PENDIENTE (usuario): el Worker de Cloudflare debe permitir CORS desde el dominio del OS (antes se abría como file:// → origin null). Si "Generar ideas con IA" da "Failed to fetch", agregar el origen del OS al Worker.
- Comercialización: misma URL de Worker + un código por cliente NO cruza datos (código = licencia, no contenedor). Backlog: contador de consumo por código (Cloudflare D1).

## 2026-07-23 · PDF nombres limpios + contador de consumo Studio (Worker/D1)
- **Sanitización de emojis en PDF** (`documents/pdf.py`): `_clean()` quita emojis/glyphs no soportados por Helvetica (rangos emoji, banderas, símbolos, VS/ZWJ). Aplicado en `_interpolate` (valores de variables) y en el nombre del firmante/certificación. Verificado E2E: "Cata 💗" → "Cata", sin ■.
- **Contador de consumo por código de Studio** (opción B: el usuario distribuye el HTML suelto). No va en VERA sino en el Worker de Cloudflare (único chokepoint de todas las llamadas). Entregado en `/app/studio-worker/`:
  - `veraos-worker.js`: Worker v2 — valida X-Vera-Code, proxy a OpenAI (guardas gpt-4o-mini / gpt-image-1 n=1), registra cada generación en D1 (`usage` por code/kind/ym) y sirve panel `/admin?key=ADMIN_KEY` (HTML) + `/admin/usage` (JSON) con consumo por código (mes actual + histórico).
  - `schema.sql`: tabla `usage`. `README.md`: setup paso a paso en el dashboard de Cloudflare (D1 + binding DB + ADMIN_KEY).
  - Requiere que el usuario cree D1, la vincule (`DB`), agregue `ADMIN_KEY` y redeploye el Worker. No testeable desde acá (Cloudflare externo); JS validado con `node --check`.

## 2026-07-23 · Auto-registro + Google + control de acceso por equipo
- **Registro (email+contraseña) y login con Google** vía Supabase Auth (`LoginScreen.tsx`: toggle ingresar/crear, botón Google `signInWithOAuth`, `signUp` con emailRedirectTo). Cliente Supabase ahora con `detectSessionInUrl:true` + `flowType:'pkce'` para manejar el callback OAuth.
- **Gate de acceso por equipo** (workspace único → no debe entrar cualquiera). Backend `routes_auth.py` + Mongo `app_access`:
  - `POST /api/auth/approval` {email} → {approved,isAdmin}. Bootstrap: si la colección está vacía, backfill de usuarios existentes de Supabase (aprobados; el más antiguo = admin). Emails nuevos → pendientes.
  - `GET /api/auth/team`, `POST /api/auth/team/{approve|revoke|make-admin}` (requieren actor admin).
  - `AuthProvider` consulta approval; `RequireAuth` bloquea no-aprobados con `PendingApproval.tsx`.
  - Pantalla admin **`/equipo`** (`TeamScreen.tsx`, ítem de nav solo para admin) para aprobar/quitar/hacer-admin.
  - Admin detectado: `varelavendecde@gmail.com`. qa_varela quedó aprobado (no admin).
- Verificado por API: bootstrap, aprobación, pendiente, 403 para no-admin, revoke. UI: login con Google+registro, qa_varela entra sin bloqueo.
- ⚠️ El gate es a nivel app (API backend sigue abierta). Endurecer con verificación de JWT de Supabase en rutas = backlog.
- PENDIENTE usuario (Supabase/Google): habilitar proveedor Google + redirect URLs + confirmación email. Ver mensaje.

## 2026-07-24 · "Hoy" simplificado — una sola ventana de VERA (Claude)
- Rediseño de `WorkspaceHome.tsx`: ahora es SOLO un chat de VERA embebido (`VeraChat.tsx`), conectado a Claude vía `veraBrain.ask`. El usuario pregunta cualquier cosa del sistema y de la inmobiliaria.
- Removidos de Hoy: VERA Insights (`InsightsSection`), Objetivo Activo (`GoalBar`), QuickActions, grilla de widgets ("Tu escritorio"), Dock, CustomizePanel y el SpotlightModal (chat ahora es inline, no modal). Los componentes siguen en el repo por si se reincorporan.
- Chat inline: estado vacío con saludo + 4 sugerencias, thread con burbujas, textarea (Enter envía, Shift+Enter salto), sesión persistente por visita. Estilos `.vera-chat*` en index.css.
- Verificado E2E: login → /hoy → pregunta "¿cuántas propiedades tengo?" → VERA responde con datos reales (29 propiedades, 24 activas). TS limpio.
- ⚠️ Observación: el conocimiento de VERA sobre el SISTEMA está desactualizado (dijo que "Documentos no está construido" cuando sí lo está). Mejora futura: actualizar el contexto/knowledge del brain con los módulos actuales.

## 2026-07-24 · "Hoy" v2 — chat + radio/calendario + dock (feedback usuario)
- Ajuste tras feedback: el chat quedaba solo con scrollbar fea y faltaban herramientas útiles.
- `WorkspaceHome.tsx`: layout de 2 columnas → izquierda VeraChat (protagonista), derecha aside con **Radio** (AudioWidget) y **Calendario** (CalendarWidget) envueltos en `.vera-widget`. Restaurado el **Dock** (accesos personales) abajo (sticky).
- CSS: `.vera-home__grid` (grid 1fr/330px), altura calc(100vh-140px), scrollbars sutiles (thin, color tenue), responsive <1024px apila. Se eliminó la barra de scroll molesta del estado vacío.
- Sigue SIN insights ni objetivo activo. Verificado por screenshot: chat + radio + calendario + dock OK, TS limpio.

## 2026-07-24 · VERA: conocimiento actualizado + memoria/historial + dock
- **(1) Conocimiento del sistema**: nuevo doc `/app/docs/ESTADO_ACTUAL.md` (prepend en `knowledge.py` DOC_ORDER, prioridad sobre roadmap) con los módulos EN PRODUCCIÓN. VERA ahora responde correctamente que Documentos/Studio/firmas ESTÁN construidos (verificado).
- **(2) Memoria + historial de chat**: antes VERA no tenía memoria (cada pregunta aislada). Nuevo `vera_brain/conversations.py` (Mongo `vera_conversations`, por email+sessionId). `routes_brain.py`: `/ask` ahora arma prompt con historial reciente (continuidad multi-turno) y persiste; nuevos endpoints `GET/DELETE /brain/conversations[/{sid}]`. Verificado: recordó dato de turno anterior.
  - Frontend: `brain-gateway.ts` ask envía email + endpoints de conversaciones. `VeraChat.tsx` con barra Historial/Nueva, panel de conversaciones (retomar/eliminar). Estilos `.vera-chat__bar/__history`.
- **(3) Dock**: default más inmobiliario en `useDock.ts` → arturito, whatsapp, gmail, mercadolibre, canva, drive. Sigue 100% personalizable por usuario (botón +, localStorage). Nota: usuarios existentes conservan sus pins guardados.

## 2026-06-16 · Contabilidad general (módulo admin nuevo)
- Nueva App "Contabilidad" SOLO admin (nav `PiggyBank` en navigation.ts, ruta `/contabilidad` en VeraOS.tsx; empleados no-admin siguen redirigidos a /alquileres por AppLayout).
- Backend nuevo `routes_contabilidad.py` (registrado en server.py), prefix `/api/contabilidad`:
  - `GET /resumen?desde&hasta`: consolida ingresos/gastos SEPARADOS POR MONEDA (ARS/USD sin mezclar). Suma automáticamente las comisiones de alquiler (`rental_movimientos` tipo=comision, moneda tomada de la reserva) como "Comisión alquiler". Devuelve totales por moneda, desglose por categoría, serie mensual (para gráfico) y detalle de movimientos.
  - CRUD manual: `GET/POST/DELETE /movimientos` (colección `contabilidad`: fecha, tipo ingreso|gasto, categoria, moneda, monto, descripcion). Filtros por moneda/tipo/categoria.
  - Categorías: `GET/POST/DELETE /categorias` (defaults fijos: ingreso[Comisión venta, Otros ingresos], gasto[Sueldos, Aportes, Impuestos, Servicios, Otros]) + colección `contabilidad_categorias` para categorías propias del usuario.
- Frontend `ContabilidadScreen.tsx` + `contabilidad.css`: presets de período (mes/3m/6m/año) + rango custom, alta de ingreso/gasto con "+ nueva categoría" inline, tabs de moneda (Pesos/Dólares), tarjetas Ingresos(verde)/Gastos(rojo)/Neto(amarillo), gráfico comparativo mensual (recharts BarChart ingresos vs gastos), desglose por categoría y tabla de movimientos filtrable (borrar solo manuales; las de alquiler llevan chip "auto").
- Decisiones del usuario: comisiones de venta se cargan a mano; comisión de alquiler cuenta al confirmar la reserva; categorías ampliables; separar por moneda; con gráfico + comparativo.
- Verificado E2E: todos los endpoints por curl (auto ARS + venta USD + gasto + categoría custom + resumen) y screenshot de la pantalla con datos reales (comisiones alquiler ARS $131.500). TS limpio. Datos de prueba manuales eliminados.

## 2026-06-16 · Contabilidad: comparar períodos + fijos recurrentes
- **Comparar períodos**: toggle "Comparar con período anterior" en la toolbar. Frontend calcula el período anterior equivalente (mes→mes previo, 3m/6m→bloque previo, año→año previo, rango custom→mismos días inmediatos anteriores) y llama `/resumen` otra vez. Cada tarjeta (Ingresos/Gastos/Neto) muestra badge de variación ▲/▼ % + valor anterior (`Delta` component).
- **Fijos recurrentes**: colección `contabilidad_recurrentes` + endpoints `GET/POST/PATCH/DELETE /recurrentes`. Cada fijo (tipo, categoria, moneda, monto, diaMes, desde YYYY-MM, activo) genera automáticamente su movimiento en `contabilidad` para cada mes desde su inicio hasta el mes actual (`_materializar_recurrentes`, llamada al inicio de `/resumen`). Idempotente vía `generadosMeses` en el doc: si el usuario borra el movimiento de un mes puntual, NO se regenera. Pausar (activo:false) frena futuros; borrar la plantilla conserva lo ya generado. Movimientos fijos llevan chip azul "fijo" en la tabla.
- UI: sección colapsable "Gestionar fijos mensuales" con alta (tipo/cat/moneda/monto/día/desde-mes/desc) y lista con pausar/borrar.
- Verificado: backend por curl (materialización abr→ago, idempotencia en 3 llamadas, borrado de un mes no se regenera) + screenshot con compare ON y 2 fijos. Datos de prueba eliminados, admin QA revertido.

## 2026-06-16 · Contabilidad: vincular comisiones de venta a Operaciones
- Nueva colección `venta_comisiones` (clave natural personId+propertyId → sobrevive rebuilds de proyecciones). Endpoints en `routes_contabilidad.py`: `GET/POST(upsert)/DELETE /ventas`. Estado derivado en vivo de la etapa de la oportunidad: `ganada`→confirmada, `perdida`→descartada (se borra), resto→reserva.
- Hook en `routes_core.py` update_opportunity: al pasar a `ganada` setea `fechaConfirmada`; a `perdida` borra la comisión; a otra etapa limpia fechaConfirmada.
- `/resumen`: comisiones confirmadas suman como ingreso "Comisión venta" (por fechaConfirmada, dentro del período); las reservadas NO suman → van a `monedas[cur].ventasPendientes` + lista `ventasPendientes`. Perdidas se descartan.
- Frontend Operaciones (`OperacionesScreen.tsx`): componente `OppCommission` en la tarjeta de oportunidad (visible desde etapa Reserva). Chip NARANJA "reservada" / VERDE "confirmada", botón "Cargar comisión", editar y borrar. Estilos `.vera-ops__com*` en index.css.
- Frontend Contabilidad: panel naranja "X en comisiones de venta por confirmar" bajo las tarjetas (`.cont__pending`). Las confirmadas aparecen en la tabla como ingreso "Comisión venta" (origen venta, no borrable desde ahí).
- Decisiones usuario: 1a (cargar desde Operaciones), 2a (naranja no suma, se muestra aparte), 3 (verde al ganar / descartar al perder).
- Verificado E2E: backend curl (reserva→pendiente sin sumar, ganada→suma US$5000, perdida→descarta) + UI (cargar comisión desde tarjeta, chip naranja, panel "por confirmar" en Contabilidad). Datos de prueba eliminados, admin QA revertido.

## 2026-06-16 · Comisión de venta: RE-anclada a la PROPIEDAD (corrección de rumbo)
- Motivo: el usuario reportó que Operaciones (leads/oportunidades) está en cero — su pipeline de eventos no se alimenta de acciones reales. La comisión enganchada a oportunidades no servía.
- Nuevo anclaje: la comisión de venta se guarda por `propertyId` (propiedad de venta en Propiedades/Supabase) y su estado se deriva del `status` de la propiedad: `sold`→confirmada (verde, suma en Contabilidad), `reserved`→reserva (naranja, "por confirmar", no suma), otro→descartada (se borra).
- Backend `routes_contabilidad.py`: `venta_comisiones` re-keyed por propertyId. Endpoints `GET /ventas`, `GET /ventas/by-property/{id}`, `POST /ventas` (upsert por propertyId), `DELETE /ventas/by-property/{id}`. Resumen mira el status vía `property_repository` (mapa una sola vez); fija `fechaConfirmada` la primera vez que se ve vendida.
- Frontend: nuevo `SaleCommissionSection.tsx` en la ficha de propiedad (PropertyWorkspace), debajo de la barra de estado, visible cuando Reservada/Vendida. Chip naranja/verde + cargar/editar/quitar. Estilos `.vera-salecom*` en index.css.
- Revertido: se quitó la UI de comisión de OperacionesScreen y el hook de sincronización en routes_core.py.
- Verificado E2E con datos reales: propiedad reservada VAR-517024 → pendiente US$6000 (no suma); propiedad vendida VAR-432272 → ingreso US$9000 (suma como "Comisión venta"). Screenshot de la ficha con el panel naranja. Datos de prueba eliminados, admin QA revertido.
- ⚠️ El usuario ve la app DESPLEGADA (veraosvarela.com); debe REDEPLOYAR para tener este cambio.

## 2026-06-16 · Menú y accesos: ocultar Operaciones/Event Log + Studio para empleados
- Feature flags: `operaciones: false` y `eventLog: false` (ocultos, código intacto). Integraciones se mantiene.
- Sidebar mostraba los ítems `enabled:false` como "Próximamente" (no los ocultaba) → AppLayout ahora filtra `r.enabled !== false`, así desaparecen del menú.
- Empleados (no admin): antes solo veían Alquileres. Ahora ven **Alquileres + Studio** (editor de fotos). AppLayout: `EMPLOYEE_PATHS=['/alquileres','/studio']` para el redirect y el filtro de sidebar incluye 'studio'.
- Verificado por screenshots: empleado qa_varela ve Alquileres+Studio y entra a /studio; admin ya no ve Operaciones ni Event Log, sí Integraciones.
- ⚠️ El usuario ve producción (veraosvarela.com) → debe REDEPLOYAR.

## 2026-06-16 · Studio: preset "Airbnb / Interiores" + empleado restringido a Editor de fotos
- Nuevo preset de IA en el Editor de fotos: `MODOS_IA.airbnb` (label "Airbnb / Interiores") con prompt fijo para realzar interiores: más luminosidad/claridad, blancos puros, encender luces sutiles, potenciar luz natural, mostrar ventanas/cortinas cerradas como ABIERTAS con luz y vista exterior, quitar desorden/objetos que no correspondan, manteniendo arquitectura/muebles/ángulo intactos y fotorrealismo. Reusa el mismo flujo `/editar` (servidor externo "Vera", modelo gpt-image-2) que los modos existentes → sin cambios de backend.
- Restricción de empleado: StudioScreen.tsx agrega `only=fotos` al iframe cuando el usuario NO es admin. En vera-studio.html, el boot lee `only`; si es 'fotos' oculta todos los botones de modo salvo "Editor de fotos" y hace `setMode('fotos')`. Admin sigue viendo Studio completo.
- Acceso: AppLayout ya habilita Alquileres + Studio para empleados (cambio previo). Verificado: empleado ve solo "Editor de fotos", panel abre directo, MODOS_IA.airbnb presente; sin errores JS.
- ⚠️ Producción: el usuario debe REDEPLOYAR.

## 2026-06-17 · Mercado Libre para Alquileres (Alquiler temporal)
- Ventas: sin cambios (la integración ML ya existía y funciona; publicación manual con botón "Publicar" en la ficha, cuenta INMOVARELA conectada).
- Alquileres: NUEVO. `routes_ml_rentals.py` (prefix `/api/ml/rentals`) con publish/state/close, reusando `mercadolibre/service.py`. Adaptador rental→prop publica como "alquiler_temporario" (categorías MLA50278/50279/105180 casa/depto/ph). Imágenes firmadas con `_sign` (mismo storage Supabase). Estado guardado en `rental_properties.publications.mercadolibre`.
- `mercadolibre/service.py`: agregado atributo `GUESTS` (capacidad) en `_ATTR_VALUE` — requerido por ML para alquiler temporal (categoría lo pedía). No afecta ventas (solo se envía si la categoría lo exige).
- rentals: PropertyBody + `_prop_out` ahora incluyen `tipo` (casa/departamento/ph, default casa) y exponen `publications`.
- Frontend: selector "Tipo de inmueble (para Mercado Libre)" en la pestaña Datos; nuevo componente `MlRentalPublish.tsx` en la columna Fotos del RentalWorkspace (conectar / publicar / estado en vivo / actualizar / finalizar). Estilos `.rt-ml*` en rentals.css.
- Verificado E2E REAL: publicó un alquiler de prueba en ML (item MLA3799642018, categoría MLA50279), estado pasó not_yet_active→active, y se CERRÓ el aviso de test. Datos de prueba restaurados.
- NOTA: ML muestra `pack_quota_pending` mientras activa; los avisos de inmuebles consumen cupo/pack de la cuenta ML (tier gratuito limitado; más avisos pueden requerir pack pago). Es condición de la cuenta ML, no del sistema.
- ⚠️ Producción: el usuario debe REDEPLOYAR para tener esto en veraosvarela.com.

## 2026-06-17 · ML alquileres: link a la web de reservas en el cuerpo del aviso
- `routes_ml_rentals._rental_to_prop` ahora agrega al final de la descripción del aviso de ML un link público a la página de reservas de la propiedad: `{PUBLIC_APP_URL}/reservar/{slug}` (📅 "Consultá disponibilidad y reservá por fechas online"). `PUBLIC_APP_URL` es env-aware (preview vs prod) y es el mismo host público donde vive `/reservar/:slug` (ruta pública, sin login) y se usan los redirects de pago MP.
- Verificado E2E real: re-publicó el alquiler de prueba con el link (item MLA1999070161), ML lo aceptó (published→active, sin rechazo de moderación) y se cerró el aviso de test. Propiedad de prueba restaurada.
- Nota: en producción el link resuelve al host de PUBLIC_APP_URL. Si se quiere el subdominio de marca (alquileres.varelapropiedadescde.com.ar), se cambia esa env.
- ⚠️ Requiere REDEPLOY para producción.

## 2026-06-17 · ML alquileres: link de marca al inicio + sync confirmado
- Link ahora va al INICIO del cuerpo del aviso (antes iba al final) y usa el subdominio de marca: `RENTALS_PUBLIC_BASE_URL` (default `https://alquileres.varelapropiedadescde.com.ar`) + `/reservar/{slug}`. Fallback a PUBLIC_APP_URL si no está seteada.
- Config nueva `RENTALS_PUBLIC_BASE_URL` en config.py (env-configurable).
- Sync precio/fotos: NO requirió cambios — el botón "Actualizar" (publish con itemId existente) ya hace PUT de price + pictures + description con los valores actuales de la propiedad. Confirmado en service.py.
- Verificado con dry-run de _rental_to_prop: descripción arranca con "📅 Reservá por fechas online…" + link de marca, seguido de la descripción de la propiedad.
- ⚠️ Requiere REDEPLOY. En producción, el subdominio alquileres.varelapropiedadescde.com.ar debe apuntar a la app (sirve /reservar/:slug).

## 2026-06-17 · FIX ML alquileres: descripción/cuerpo vacío (causa raíz: emoji)
- Bug reportado: el aviso publicado en ML salía SIN cuerpo/descripción/links.
- Causa raíz #1: ML (clasificados de inmuebles) IGNORA la descripción inline del alta → hay que setearla con llamada aparte a /items/{id}/description (POST nuevo, PUT si existe).
- Causa raíz #2 (la clave): ML RECHAZA descripciones con emojis ("DESCRIPTION_PLAIN_TEXT_NOT_ALLOWED"). El header llevaba 📅 → se quitó, ahora texto plano: "Reserva por fechas online (disponibilidad en tiempo real):\n{link}\n\n{descripcion}".
- Timing: ML rechaza el POST de descripción los primeros ~20-60s del alta; se acepta después. Solución robusta (no fire-and-forget, que moría por GC/reload): seteo PEREZOSO desde `GET /ml/rentals/{id}/state` — cada consulta intenta setear la descripción hasta que ML la acepta, y persiste `publications.mercadolibre.descSet=true`.
- Frontend `MlRentalPublish.tsx`: mientras `activating` o `!descSet`, re-consulta `/state` cada 15s (dispara el seteo perezoso hasta completarse).
- service.py: nueva `set_description(item_id, text)` pública (POST→PUT). Se removió el `_spawn`/task diferida.
- Verificado E2E real: PUT descripción 200 y GET 200 mostrando el cuerpo = link (subdominio de marca) ARRIBA + descripción de la propiedad abajo. Avisos de prueba cerrados, propiedad de test restaurada.
- ⚠️ Requiere REDEPLOY.
