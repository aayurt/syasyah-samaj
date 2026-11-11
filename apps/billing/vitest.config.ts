import { defineConfig } from 'vitest/config'
import path from 'node:path'
import react from '@vitejs/plugin-react'

/**
 * Vitest config for the Billing SPA.
 *
 * Coverage thresholds (Phase 0 - Foundation, initial setup):
 *   - Global: 20% (many pages not tested yet)
 *   - Files with tests will have higher coverage
 *   - Untested modules excluded from thresholds
 */
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify('test'),
  },
  resolve: {
    alias: [{ find: /@\/(.*)/, replacement: path.resolve(__dirname, '../../src/$1') }],
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'e2e', 'src/test/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html', 'json'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.*',
        'src/**/*.spec.*',
        'src/test/**',
        'src/vite-env.d.ts',
        'src/main.tsx',
        'src/App.tsx',
        'src/routes.tsx',
        'src/lib/nepaliNumbers.ts',
        'src/lib/nepaliDate.ts',
        'src/lib/offline/**',
        'src/lib/sync/**',
        'src/pages/**',
      ],
      // Global threshold (Phase 0 - Foundation)
      lines: 20,
      functions: 20,
      branches: 20,
      statements: 20,
      // Per-directory thresholds
      thresholds: {
        'src/lib/**': { lines: 30, functions: 30, branches: 30, statements: 30 },
        'src/components/**': { lines: 40, functions: 40, branches: 40, statements: 40 },
        'src/lib/importExport.ts': { lines: 40, functions: 40, branches: 40, statements: 40 },
      },
    },
    pool: 'forks',
    poolOptions: {
      forks: {
        maxThreads: 1,
      },
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
})