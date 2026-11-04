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

  // Create auth state via API (bypasses React hydration issues with UI login)
  const EMAIL = process.env.E2E_TEST_EMAIL || 'admin@syasyahsamaj.org'
  const PASSWORD = process.env.E2E_TEST_PASSWORD || 'testpassword123'
  const API_BASE = `http://localhost:${process.env.E2E_API_PORT || 3100}`

  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    channel: process.env.PLAYWRIGHT_CHROMIUM_CHANNEL || undefined,
  } as any)

  try {
    const context = await browser.newContext()

    // Sign in via API to get session cookie
    const signIn = await context.request.post(`${API_BASE}/api/auth/sign-in/email`, {
      data: { email: EMAIL, password: PASSWORD },
      headers: { Origin: `http://localhost:${process.env.E2E_WEB_PORT || 5174}` },
    })

    if (signIn.ok()) {
      const setCookieHeader = signIn.headers()['set-cookie']
      if (setCookieHeader) {
        const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader]
        const parsed = cookies
          .map((c) => {
            const [nameValue, ...attrs] = c.split(';')
            const [name, value] = nameValue.split('=')
            const cookie: { name: string; value: string; domain?: string; path?: string; httpOnly?: boolean; secure?: boolean; sameSite?: 'Lax' | 'Strict' | 'None' } = { name: name.trim(), value: value.trim() }
            for (const attr of attrs) {
              const [key, ...valParts] = attr.split('=')
              const val = valParts.join('=').trim()
              const k = key.trim().toLowerCase()
              if (k === 'domain') cookie.domain = val
              else if (k === 'path') cookie.path = val
              else if (k === 'httponly') cookie.httpOnly = true
              else if (k === 'secure') cookie.secure = true
              else if (k === 'samesite') cookie.sameSite = val as any
            }
            return cookie
          })
          .filter((c) => c.name && c.value)
        if (parsed.length > 0) {
          await context.addCookies(parsed)
          console.log('✅ Session cookie set via API sign-in')
        }
      }
    } else {
      console.error(`⚠️  API sign-in failed: ${signIn.status()} ${await signIn.text()}`)
    }

    // Save storage state
    await context.storageState({ path: join(authDir, 'user.json') })
    console.log('✅ Auth state saved')

    await context.close()
  } finally {
    await browser.close()
  }

  console.log('✅ Global setup complete')
}
