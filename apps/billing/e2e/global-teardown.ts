/**
 * Global Playwright teardown - runs once after all tests.
 * Cleans up test data, closes connections.
 */
import { FullConfig } from '@playwright/test'

export default async function globalTeardown(config: FullConfig) {
  console.log('🧹 Global teardown starting...')

  // Clean up any test artifacts if needed
  // Database cleanup is handled by the test database being ephemeral

  console.log('✅ Global teardown complete')
}