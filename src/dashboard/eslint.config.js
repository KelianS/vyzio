import js from '@eslint/js'
import globals from 'globals'
import boundaries from 'eslint-plugin-boundaries'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'
import eslintConfigPrettier from 'eslint-config-prettier'

// Where presentation may reach inside infrastructure: the composition root and the shared store only.
const INFRASTRUCTURE_ENTRY_POINTS = ['providers/**', 'store/**']

// What only a presenter may call: the container, and the hooks that call a use case from a view.
const USE_CASE_ACCESS = [
  {
    group: ['**/infrastructure/providers/AppContainerContext'],
    message:
      'Only a presenter calls a use case: build one in the screen component, pass it the container.',
  },
  {
    group: ['**/common/hooks/useAsync', '**/common/hooks/useAsyncAction'],
    message: 'A use case is called from the screen presenter, not from the view.',
  },
]

// Files that still call use cases from the view. This list only shrinks: each screen migration removes its files.
const PRESENTER_RULE_BACKLOG = [
  'src/presentation/Access/AccessGate.tsx',
  'src/presentation/Cameras/CameraConnectionPage.tsx',
  'src/presentation/Cameras/CameraConservationPage.tsx',
  'src/presentation/Cameras/CameraDetectionPage.tsx',
  'src/presentation/Cameras/CameraImagePage.tsx',
  'src/presentation/Cameras/CameraPrivacyPage.tsx',
  'src/presentation/Cameras/CapabilitySection.tsx',
  'src/presentation/Cameras/cameraListRead.ts',
  'src/presentation/Cameras/useVendorAssistance.ts',
  'src/presentation/Notifications/AddNotificationChannelPage.tsx',
  'src/presentation/Notifications/ChannelPairingSection.tsx',
  'src/presentation/Notifications/CommandJournal.tsx',
  'src/presentation/Notifications/NotificationChannelListPage.tsx',
  'src/presentation/Notifications/NotificationChannelPage.tsx',
  'src/presentation/Notifications/NotificationLog.tsx',
  'src/presentation/Profiles/AddPersonPage.tsx',
  'src/presentation/Profiles/PersonCamerasPage.tsx',
  'src/presentation/Profiles/PersonIdentityPage.tsx',
  'src/presentation/Profiles/PersonListPage.tsx',
  'src/presentation/Profiles/PersonPhotosPage.tsx',
  'src/presentation/Profiles/PersonShell.tsx',
  'src/presentation/Settings/AccessPage.tsx',
  'src/presentation/Settings/ConservationPage.tsx',
  'src/presentation/Surveillance/useRestartSurveillance.ts',
  'src/presentation/Surveillance/useSurveillanceRefresh.ts',
]

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
        // Before `common`: the first matching pattern wins, or `src/common/ui/**` would fall under it.
        { type: 'ui-primitive', pattern: 'src/common/ui/**' },
        { type: 'common', pattern: 'src/common/**' },
        { type: 'domain', pattern: 'src/domain/**' },
        { type: 'infrastructure', pattern: 'src/infrastructure/**' },
        { type: 'presentation', pattern: 'src/presentation/**' },
      ],
      'boundaries/files': [
        {
          category: 'test',
          pattern: ['**/*.test.{ts,tsx}', 'src/test-setup.ts', 'src/testing/**'],
        },
        { category: 'app_root', pattern: ['src/App.tsx', 'src/main.tsx'] },
      ],
    },
    rules: {
      // Dependencies point inward, npm packages included; the last matching policy wins, so general first.
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          checkAllOrigins: true,
          policies: [
            {
              from: { element: { types: '*' } },
              allow: { to: { element: { types: { anyOf: ['common', 'ui-primitive'] } } } },
            },
            // Entities are plain types in `domain`, which the shared components render.
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
              allow: { to: { element: { types: { anyOf: ['domain', 'presentation'] } } } },
            },
            // Screens reach infrastructure through the composition root and the store, never a repository.
            {
              from: { element: { types: 'presentation' } },
              allow: {
                to: {
                  element: {
                    type: 'infrastructure',
                    fileInternalPath: INFRASTRUCTURE_ENTRY_POINTS,
                  },
                },
              },
            },
            // Every layer but domain may use npm and Node packages.
            {
              from: { element: { types: { noneOf: ['domain'] } } },
              allow: { to: { module: { origin: ['external', 'core'] } } },
            },
            {
              from: { element: { type: null }, file: { categories: ['test', 'app_root'] } },
              allow: { to: { module: { origin: ['external', 'core'] } } },
            },
            // Domain stays framework-free: no React, no transport, no third-party SDK.
            {
              from: { element: { type: 'domain' } },
              disallow: { to: { module: { origin: ['external', 'core'] } } },
              message: 'domain imports no package: no framework, no transport, no third-party SDK',
            },
            {
              from: { element: { type: 'domain' }, file: { categories: 'test' } },
              allow: { to: { module: { origin: ['external', 'core'], source: 'vitest' } } },
            },
            // A business rule inside vendored primitives would make an upstream update risky (ADR-42).
            {
              from: { element: { types: 'ui-primitive' } },
              disallow: { to: { element: { types: { noneOf: ['ui-primitive'] } } } },
              message: 'A vendored primitive imports only other primitives (ADR-42)',
            },
            // Tests and the app root compose layers on purpose, so they come last.
            {
              from: { file: { categories: ['test', 'app_root'] } },
              allow: { to: { element: { types: '*' } } },
            },
            {
              from: { file: { categories: ['test', 'app_root'] } },
              allow: { to: { file: { categories: 'app_root' } } },
            },
            // Shared test fixtures belong to no layer.
            {
              from: { file: { categories: 'test' } },
              allow: { to: { file: { categories: 'test' } } },
            },
          ],
        },
      ],
    },
  },
  {
    // The presenter is the only place that calls a use case.
    files: ['src/presentation/**/*.{ts,tsx}', 'src/common/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: USE_CASE_ACCESS }],
    },
  },
  {
    // A presenter calls the use cases.
    files: [
      'src/presentation/*/*.Presenter.ts',
      'src/presentation/*/*.presenter.ts',
      'src/common/presenter/**',
      ...PRESENTER_RULE_BACKLOG,
    ],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    // A screen's root component takes the container only to build its presenter, never a use-case hook.
    files: ['src/presentation/*/*.Component.tsx', 'src/presentation/*/*.component.tsx'],
    ignores: PRESENTER_RULE_BACKLOG,
    rules: {
      'no-restricted-imports': ['error', { patterns: [USE_CASE_ACCESS[1]] }],
    },
  },
  {
    // Vendored primitives export variants beside the component, as upstream does (ADR-42).
    files: ['src/common/ui/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
