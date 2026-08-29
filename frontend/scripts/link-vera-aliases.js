/* Crea shims de resolución en node_modules para los alias del monorepo lógico
 * (@vera/* y @app/*). El build usa los alias de webpack/craco; estos shims solo
 * existen para que el validador de imports del linter (que chequea node_modules)
 * reconozca los alias como paquetes válidos. Inerte para webpack (alias tiene
 * precedencia). Idempotente; se corre en postinstall para sobrevivir a yarn install. */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const nm = path.join(root, 'node_modules');
const veraPkgs = ['design-tokens', 'ui', 'services', 'repositories', 'config', 'types', 'events'];
const appSegments = [
  'ErrorBoundary', 'VeraOS', 'auth', 'brain', 'hooks', 'insights',
  'integraciones', 'layout', 'navigation', 'public', 'screens', 'vera-bot', 'workspace',
];

try {
  fs.mkdirSync(path.join(nm, '@vera'), { recursive: true });
  for (const p of veraPkgs) {
    const link = path.join(nm, '@vera', p);
    const target = path.join(root, 'src', 'packages', p);
    if (!fs.existsSync(link) && fs.existsSync(target)) {
      fs.symlinkSync(target, link, 'dir');
    }
  }
  const appDir = path.join(nm, '@app');
  fs.mkdirSync(appDir, { recursive: true });
  for (const seg of appSegments) {
    fs.mkdirSync(path.join(appDir, seg), { recursive: true });
  }
} catch (e) {
  // Nunca bloquear la instalación por esto.
  console.warn('[link-vera-aliases] skipped:', e.message);
}
