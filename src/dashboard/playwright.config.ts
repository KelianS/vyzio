import { defineConfig, devices } from '@playwright/test'

const PORT = 4173
// vite preview only binds the IPv6 loopback (::1) in this environment, not 127.0.0.1 — use
// "localhost" so both the readiness probe and the tests resolve to a host it actually listens on.
const BASE_URL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Against the production build, not the dev server, so the suite catches build-only
    // regressions (minification, chunking, missing env-only branches).
    command: `node node_modules/typescript/bin/tsc -b && node node_modules/vite/bin/vite.js build && node node_modules/vite/bin/vite.js preview --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      // The Expert screen embeds Frigate's own UI in an iframe — nothing we control or want to
      // depend on in e2e. Point it at a blank page so it loads deterministically with no real
      // network calls, instead of a real (absent) Frigate instance on the dev machine.
      VITE_FRIGATE_BASE_URL: 'about:blank',
    },
  },
})
