// Flat ESLint config (ESLint 9). Standard, community-adopted rules only.
// Runs via the `eslint` CLI (lint-staged / CI). CRA uses its own internal eslint at dev time.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: ['build/**', 'node_modules/**', 'coverage/**', 'public/**', 'plugins/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      'react-hooks': reactHooks,
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      // Desactivada: incompatibilidad entre ESLint 9.23 y @typescript-eslint
      // hace crashear el engine al cargar esta regla ("allowShortCircuit").
      '@typescript-eslint/no-unused-expressions': 'off',
    },
  },
  prettier,
);
