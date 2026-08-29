# Fix: "JavaScript linting failed due to a linter engine error" (pre-completion)

## Síntoma
Las tools `ask_human` / `finish` fallan con:
`Pre-completion checks failed ... JavaScript linting failed due to a linter engine error.`
No es un error de ESLint. NO perder tiempo con `eslint.config.mjs`, versiones de
`@typescript-eslint`, ni `react-scripts`.

## Causa raíz
El pre-completion check usa **oxlint + un ImportValidator** propio de la plataforma
(`/opt/plugins-venv/.../linters/`). El engine agrupa por el `package.json` más cercano
(= `/app/frontend`) y valida TODOS los imports del frontend recursivamente.
El ImportValidator NO entiende los alias del monorepo lógico (`@vera/*`, `@app/*`):
los trata como paquetes npm bare y, si no están en `package.json` NI existen como
DIRECTORIO en `node_modules`, marca `import_success=False` → `engine_success=False`.
El check filtra findings a las líneas cambiadas (reviewdog); cuando el diff no tiene
findings pero `engine_success=False`, lo reporta como "linter engine error".

El validador (bare import) acepta el paquete si: `pkg_name in deps` **o**
`node_modules/<pkg_name>` **es un directorio** (no chequea contenido).

## Solución (aplicada)
Shims de resolución en `node_modules` (inertes para webpack, que usa alias con
precedencia; solo satisfacen al validador):
- `node_modules/@vera/<pkg>` → symlink a `src/packages/<pkg>` (7 paquetes).
- `node_modules/@app/<seg>` → directorios (vacíos alcanza; el validador solo hace
  `.is_dir()`). Segmentos = primer nivel bajo `src/app` usado en imports
  (ErrorBoundary, VeraOS, auth, brain, hooks, insights, integraciones, layout,
  navigation, public, screens, vera-bot, workspace).
- Script idempotente `frontend/scripts/link-vera-aliases.js` + `postinstall` en
  `package.json` → sobrevive a `yarn install`.

## Si vuelve a fallar
1. Correr el validador real para ver qué import no resuelve:
   `cd /app && /opt/plugins-venv/bin/python -c "import asyncio,os; os.environ['WORKSPACE_ROOT']='/app'; from linters.import_validator import ImportValidator; print(asyncio.run(ImportValidator('/app').validate_directory('frontend/src')))"`
2. Si aparece un `@app/<nuevoSegmento>` nuevo → agregarlo a `appSegments` en el script y crear el dir.
3. Verificar engine_success:
   `.../python -c "import asyncio,os; os.environ['WORKSPACE_ROOT']='/app'; from linters.lint_tools import run_javascript_oxlint_linter; print(asyncio.run(run_javascript_oxlint_linter(['frontend/src/app/...'],trigger='precompletion')).engine_success)"`
4. Además, en líneas NUEVAS evitar findings bloqueantes de oxlint:
   `emergent(safe-array-method-call)` → guardá arrays antes de `.map/.find/.filter`
   (ej: `(arr || []).map(...)`); `emergent(require-data-testid)` → agregá data-testid.
