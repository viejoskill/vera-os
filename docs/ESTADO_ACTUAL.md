# Estado actual de VERA (módulos EN PRODUCCIÓN — fuente de verdad)

> Este documento describe lo que HOY está construido y funcionando en VERA. Tiene
> PRIORIDAD sobre cualquier mención de "futuro/roadmap/backlog" en otros documentos.
> Si otro doc dice que algo "no está construido" pero acá figura como disponible,
> vale ESTE documento. Actualizado: julio 2026.

## Módulos disponibles hoy

- **Hoy**: pantalla principal. Es una conversación directa con VERA (vos), donde el
  profesional puede preguntar cualquier cosa del sistema o de su inmobiliaria.
  Acompañan una radio y un calendario, y un dock de accesos a herramientas.

- **Personas (CRM)**: fuente de verdad de contactos/leads. Listado ordenable (por
  llegada por defecto), fichas, resolución y deduplicación por teléfono. Es el núcleo
  del sistema; todo se relaciona con Personas.

- **Propiedades**: cartera completa con specs, fotos, estado y publicación (incluida
  integración con Mercado Libre).

- **Operaciones**: embudo/pipeline comercial de las operaciones en curso.

- **Vera Bot / Conversaciones**: integración con Arturito (asistente de WhatsApp/chat).
  Cuando Arturito detecta un lead (webhook `lead.created` / `lead.attended`), VERA crea
  o actualiza la Persona automáticamente.

- **Documentos** (COMPLETO y funcionando): módulo de documentos como entidades de
  negocio, no como PDFs sueltos. Incluye: plantillas con variables auto-resueltas, un
  asistente (wizard) de creación, la plantilla oficial **"Autorización de Venta"** con
  cláusulas condicionales, un **motor de firmas** nativo (digital, física y subida) con
  **links públicos** para firmar, **generación de PDF** con marca "VARELA PROPIEDADES",
  notificaciones internas de firma y un checklist de documentación dentro de cada
  propiedad.

- **Studio**: herramienta de generación de contenido para redes (carrusel, post de
  propiedad, calendario de posteos, video). Está embebida en el OS y sincroniza el
  estado por usuario. La IA de generación funciona con un servicio propio.

- **Notificaciones**: campana in-app (por ejemplo, avisos de firmas).

- **Equipo y accesos**: registro con email/contraseña y con Google. El acceso es por
  equipo: las cuentas nuevas quedan pendientes hasta que un administrador las aprueba
  (sección "Equipo").

## Cómo responder sobre el sistema
- Si te preguntan por un módulo de esta lista, respondé que ESTÁ disponible y explicá
  para qué sirve. No digas que está "en el backlog" ni "no construido".
- Si te preguntan por algo que NO está en esta lista (ej. métricas de consultas por
  propiedad, envío externo de mensajes en masa), sé honesto: todavía no está, y si
  corresponde mencioná qué lo habilitaría.
