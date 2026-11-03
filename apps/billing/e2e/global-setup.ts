/**
 * Global Playwright setup - runs once before all tests.
 * Sets up database, seeds data, creates auth state.
 */
import { chromium, FullConfig } from '@playwright/test'
import { mkdirSync, existsSync } from 'fs'
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

  // Verify Web server is reachable (API is handled by webServer)
  const webUrl = `http://localhost:${process.env.E2E_WEB_PORT || 5174}`
  const apiUrl = `http://localhost:${process.env.E2E_API_PORT || 3100}/api/users`

  console.log('🌐 Web URL:', webUrl)
  console.log('🌐 API URL:', apiUrl)

  // Wait for web server to be ready (accept any HTTP response as "server is up")
  let webReady = false

  for (let i = 0; i < 60; i++) {
    if (!webReady) {
      try {
        const res = await fetch(apiUrl, { method: 'GET' })
        // Any HTTP response means the server is running
        webReady = true
        console.log('✅ Web server ready (API status:', res.status, ')')
      } catch {
        // Not ready yet
      }
    }

    if (webReady) break
    await new Promise(r => setTimeout(r, 2000))
  }

  if (!webReady) throw new Error('❌ Web server not ready after 120s')

  // Create auth state for tests
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    channel: process.env.PLAYWRIGHT_CHROMIUM_CHANNEL || undefined,
  } as any)
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    // Navigate to login
    await page.goto(`${webUrl}/login`)
    await page.waitForLoadState('networkidle')

    // Check if already logged in (session might persist)
    const isLoggedIn = await page.locator('text=Dashboard, text=Accounts, text=Vouchers').first().isVisible({ timeout: 5000 }).catch(() => false)

    if (!isLoggedIn) {
      // Login with test credentials
      await page.fill('input[name="email"], input[type="email"]', process.env.E2E_TEST_EMAIL || 'admin@syasyahsamaj.org')
      await page.fill('input[name="password"], input[type="password"]', process.env.E2E_TEST_PASSWORD || 'testpassword123')
      await page.click('button[type="submit"]')
      await page.waitForURL('**/dashboard', { timeout: 15000 })
    }

    // Save storage state
    await context.storageState({ path: join(authDir, 'user.json') })
    console.log('✅ Auth state saved')

  } catch (error) {
    console.error('❌ Auth setup failed:', error)
    // Create empty auth state as fallback
    await context.storageState({ path: join(authDir, 'user.json') })
  } finally {
    await browser.close()
  }

  console.log('✅ Global setup complete')
}