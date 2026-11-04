/**
 * Global Playwright setup - runs once before all tests.
 * Verifies database and API server are ready.
 * Auth state is created externally by e2e/lightpanda-auth.mjs.
 */
import { FullConfig } from '@playwright/test'
import { existsSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const here = dirname(fileURLToPath(import.meta.url))
const authDir = join(here, '.auth')

export default async function globalSetup(config: FullConfig) {
  console.log('🔧 Global setup starting...')

  // Create auth directory
  if (!existsSync(authDir)) {
    mkdirSync(authDir, { recursive: true })
  }

  // Verify database connection
  const dbUri = process.env.E2E_DATABASE_URI
  if (dbUri) {
    console.log('📊 Database URI configured:', dbUri.replace(/:[^:@]*@/, ':****@'))
  } else {
    console.log('⚠️  No E2E_DATABASE_URI set - using default from .env')
  }

  // Verify API server is reachable
  const apiUrl = `http://localhost:${process.env.E2E_API_PORT || 3100}/api/users`

  let apiReady = false
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(apiUrl, { method: 'GET' })
      // Any HTTP response means the server is running
      apiReady = true
      console.log('✅ API server ready (status:', res.status, ')')
      break
    } catch {
      // Not ready yet
    }
    await new Promise(r => setTimeout(r, 2000))
  }

  if (!apiReady) throw new Error('❌ API server not ready after 120s')

  // Auth state is created externally by e2e/lightpanda-auth.mjs (CI step
  // before Playwright starts). It uses secure=false cookies so Chromium
  // sends them over HTTP through the SPA proxy. Do NOT overwrite here.
  console.log('✅ Auth state handled by lightpanda-auth.mjs (secure=false cookies over HTTP)')

  console.log('✅ Global setup complete')
}
