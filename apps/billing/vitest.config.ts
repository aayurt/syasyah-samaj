import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

/**
 * Vitest config for the Billing SPA.
 *
 * Runner split (documented in docs/TESTING.md):
 *   - vitest  → this app (apps/billing): unit + component + page tests
 *   - jest    → Payload server (src/**) only; apps/billing is ignored there
 */
export default defineConfig({
  plugins: [react()],
  define: {
    // Mirrors vite.config.ts — some modules read the build id.
    __APP_VERSION__: JSON.stringify('test'),
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'e2e'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.*', 'src/test/**', 'src/vite-env.d.ts'],
      // Global thresholds (80) + src/lib/** (90) are enabled in M6 once the
      // component/page campaign has landed — see MISSION.md §5-M6.
    },
  },
})
