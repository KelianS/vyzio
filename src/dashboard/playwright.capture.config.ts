import { defineConfig, devices } from '@playwright/test'

const PORT = 4174
const BASE_URL = `http://localhost:${PORT}`

// Documentation screenshots are generated, not hand-taken: they are reproducible, they carry no
// real installation's data, and they can be regenerated when a screen changes.
export default defineConfig({
  testDir: './tools/docs-capture',
  testMatch: '**/*.capture.ts',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
  },
  webServer: {
    command: `node node_modules/typescript/bin/tsc -b && node node_modules/vite/bin/vite.js build && node node_modules/vite/bin/vite.js preview --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      VITE_FRIGATE_BASE_URL: 'about:blank',
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
