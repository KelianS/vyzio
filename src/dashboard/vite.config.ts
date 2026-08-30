import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8443'

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      proxy: {
        '/health': apiTarget,
        '/api': apiTarget,
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test-setup.ts'],
      coverage: {
        provider: 'v8',
        reporter: ['text-summary', 'cobertura', 'lcov'],
        reportsDirectory: './coverage',
        // Required: without it, v8 measures only files a test imported, leaving untested
        // code out of the denominator. (Vitest 4 removed `coverage.all`.)
        include: ['src/**/*.{ts,tsx}'],
        // Only files that emit no runtime code. Anything that executes stays measured, even
        // when it gets no test of its own.
        exclude: [
          'src/main.tsx', // bootstrap: mounts React, no logic
          'src/test-setup.ts', // test harness, not shipped code
          'src/**/*.d.ts', // ambient types, erased at build
          'src/domain/ports/**', // interfaces only, erased at build
        ],
      },
    },
  }
})
