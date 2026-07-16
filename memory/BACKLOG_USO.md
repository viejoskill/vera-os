# VERA OS — Backlog de uso (fuente de verdad para evolucionar el producto)

> **Etapa actual: VALIDACIÓN.** El objetivo no es agregar funciones, es usar VERA a diario con la
> cartera real y detectar qué mejora la experiencia.

## Regla de esta etapa
> Si durante el uso aparece una mejora de **menos de 30 minutos** de implementación y **mejora
> claramente la experiencia**, puede resolverse **inmediatamente**.
> Si requiere **cambios de arquitectura** o **nuevas funcionalidades**, pasa a este backlog y se
> **decide en conjunto**. Ante la duda, no se implementa: se registra acá.

Principios que guían toda decisión: "¿Esto hace que pueda trabajar mejor hoy?" · "VERA sugiere, el
usuario decide" · Si una capacidad no existe, preferimos silencio antes que promesas · Nada de mocks
visibles · La palabra "Error" está prohibida en la UI.

---

## 1) Mejoras detectadas durante el uso
_Ajustes de calidad de uso (UX, claridad, ritmo). Registrar fecha + contexto de dónde apareció._

- _(vacío — se completa con el uso diario)_

## 2) Funcionalidades futuras
_Ideas que requieren nueva arquitectura o alcance. Explícitamente pospuestas hasta decidirlas juntos._

- App **Operaciones** (pipeline).
- App **Personas** (propietarios / compradores / contactos).
- App **Publicaciones** (preview + integración con portales, p.ej. Mercado Libre).
- **Vera Studio real** (inteligencia sobre fotos; hoy la UI está oculta, el código se conserva).
- **VERA Intelligence Engine + LLM** (arquitectura híbrida: el VIE decide prioridad/acción de forma
  determinista; el LLM solo reescribe el tono de la recomendación).
- **Resumen diario por email** (p.ej. vía Resend).
- **Snooze / posponer recomendaciones** en "Hoy".
- **Duplicar propiedad**.
- **Auth** (Supabase Auth) + roles/RBAC.

## 3) Bugs
_Comportamientos incorrectos detectados durante el uso. Registrar cómo reproducir + impacto._

- _(vacío)_

## Hardening / técnico (pendiente, no urgente)
- **Proteger la API del backend con JWT de Supabase**: hoy los endpoints `/api/*` están abiertos (usan
  service_role). Falta verificar el `Authorization: Bearer <token>` del usuario. Es seguridad futura; se
  decide cuando pasemos de piloto a multiusuario.
- Recuperar contraseña / invitaciones / roles / multiempresa (todo fuera de alcance del piloto).

---

### Registro de decisiones rápidas ya aplicadas (etapa validación)
- 2026-06 · Sprint "Construir para usar": App "Hoy" sobre catálogo de reglas real del VIE.
- 2026-06 · Sprint "Validación / calidad de uso": auditoría App "Propiedades" — búsqueda instantánea
  (client-side), placeholders marcados como ejemplo, cards sin ceros, empty state con CTA, Health
  Score con estado inicial alentador, se quitó el banner "VERA AI demo", se ocultó Vera Studio
  (código intacto), se quitó "Guardar borrador" (no persistía), confirmación de guardado sutil
  (pill "Guardado", sin toast), transición suave de recomendaciones en "Hoy", fotos con aparición
  sin saltos.
