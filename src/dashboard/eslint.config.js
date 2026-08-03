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
        // Declare avant `common` : le premier motif qui correspond gagne, et
        // `src/common/ui/**` serait sinon capte par `src/common/**`.
        { type: 'ui-primitive', pattern: 'src/common/ui/**' },
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
              allow: { to: { element: { types: { anyOf: ['common', 'ui-primitive'] } } } },
            },
            // Vendored shadcn/ui primitives (ADR-42): they may only reach each other.
            // A primitive that imports domain, infrastructure or a Vyzio component is a
            // business rule smuggled into vendored code — the one thing that makes
            // upstream updates risky. This policy is what makes the tier boundary real
            // rather than a convention.
            {
              from: { element: { types: 'ui-primitive' } },
              allow: { to: { element: { types: 'ui-primitive' } } },
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
  {
    // Vendored shadcn/ui primitives (ADR-42) — code copie, pas ecrit ici, et mis
    // a jour en le regenerant. Les regles qui supposent du code maison ne s'y
    // appliquent pas : les faire respecter obligerait a editer du code vendu,
    // donc a rendre risquee toute mise a jour. Leur forme amont exporte les
    // variantes a cote du composant, ce que `react-refresh` interdit.
    files: ['src/common/ui/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
