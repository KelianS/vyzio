import { defineConfig, devices } from '@playwright/test'

const PORT = 4174
const BASE_URL = `http://localhost:${PORT}`

// Generated on the fake backend, never hand-taken, so they carry no installation's data; the caller names the folder.
export default defineConfig({
  testDir: './tools',
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
