import js from '@eslint/js'
import globals from 'globals'
import boundaries from 'eslint-plugin-boundaries'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'
import eslintConfigPrettier from 'eslint-config-prettier'

export default defineConfig([
  globalIgnores(['dist', 'coverage']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      eslintConfigPrettier,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    plugins: {
      boundaries,
    },
    settings: {
      'import/resolver': {
        typescript: { alwaysTryTypes: true },
      },
      'boundaries/elements': [
        { type: 'common', pattern: 'src/common/**' },
        { type: 'domain', pattern: 'src/domain/**' },
        { type: 'infrastructure', pattern: 'src/infrastructure/**' },
        { type: 'presentation', pattern: 'src/presentation/**' },
      ],
      'boundaries/ignore': ['src/App.tsx', 'src/main.tsx', '**/*.test.{ts,tsx}'],
    },
    rules: {
      // Enforces the dependency rule: infrastructure -> domain, presentation -> domain + infrastructure,
      // with `common` as a shared kernel importable from anywhere (never the reverse).
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: [
            {
              from: { element: { types: '*' } },
              allow: { to: { element: { types: 'common' } } },
            },
            {
              from: { element: { types: 'common' } },
              allow: { to: { element: { types: 'domain' } } },
            },
            {
              from: { element: { types: 'domain' } },
              allow: { to: { element: { types: 'domain' } } },
            },
            {
              from: { element: { types: 'infrastructure' } },
              allow: { to: { element: { types: { anyOf: ['domain', 'infrastructure'] } } } },
            },
            {
              from: { element: { types: 'presentation' } },
              allow: {
                to: { element: { types: { anyOf: ['domain', 'infrastructure', 'presentation'] } } },
              },
            },
          ],
        },
      ],
    },
  },
])
