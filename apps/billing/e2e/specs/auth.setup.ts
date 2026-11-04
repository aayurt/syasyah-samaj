import { test as setup } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')

const EMAIL = process.env.E2E_EMAIL || 'aayurtshrestha@gmail.com'
const PASSWORD = process.env.E2E_PASSWORD || 'SyashaAdmin2026!'
const API_BASE = process.env.API_URL || 'http://localhost:3100'
const WEB_PORT = process.env.E2E_WEB_PORT || 5174
const AUTH_STATE = join(root, '.auth', 'user.json')

/**
 * Parse a single Set-Cookie header value into a cookie object.
 * Forces secure=false so Chromium sends cookies over HTTP in CI.
 */
function parseSetCookie(header: string) {
  const parts = header.split(';').map((p) => p.trim())
  const eqIdx = parts[0].indexOf('=')
  const name = parts[0].slice(0, eqIdx).trim()
  const value = parts[0].slice(eqIdx + 1).trim()

  const cookie: { name: string; value: string; domain?: string; path?: string; secure?: boolean; httpOnly?: boolean; sameSite?: string } = {
    name,
    value,
    secure: false,
    sameSite: 'lax',
  }

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i]
    if (part.startsWith('Domain=')) cookie.domain = part.slice(7)
    else if (part.startsWith('Path=')) cookie.path = part.slice(5)
    else if (part.toLowerCase() === 'secure') cookie.secure = true
    else if (part.toLowerCase() === 'httponly') cookie.httpOnly = true
    else if (part.toLowerCase().startsWith('samesite=')) cookie.sameSite = part.slice(9).toLowerCase()
  }

  return cookie
}

setup('authenticate as admin', async ({ page, context, request }) => {
  // Step 1: API sign-in (server-side, after DB is seeded by setup-seed)
  let signIn = await request.post(`${API_BASE}/api/auth/sign-in/email`, {
    data: { email: EMAIL, password: PASSWORD },
    headers: { Origin: `http://localhost:${WEB_PORT}` },
  })

  if (!signIn.ok()) {
    // User doesn't exist — sign up first, then retry sign-in
    await request.post(`${API_BASE}/api/auth/sign-up/email`, {
      data: { email: EMAIL, password: PASSWORD, name: 'E2E Admin' },
      headers: { Origin: `http://localhost:${WEB_PORT}` },
    })
    signIn = await request.post(`${API_BASE}/api/auth/sign-in/email`, {
      data: { email: EMAIL, password: PASSWORD },
      headers: { Origin: `http://localhost:${WEB_PORT}` },
    })
    if (!signIn.ok()) {
      throw new Error(
        `API sign-in failed: ${signIn.status()} ${await signIn.text()}`,
      )
    }
  }

  // Step 2: Extract cookies from Set-Cookie headers, force secure=false
  const setCookieHeader = signIn.headers()['set-cookie']
  if (setCookieHeader) {
    const cookies = Array.isArray(setCookieHeader)
      ? setCookieHeader
      : [setCookieHeader]
    const parsed = cookies
      .map(parseSetCookie)
      .filter((c) => c.name && c.value)
    if (parsed.length > 0) {
      await context.addCookies(
        parsed.map((c) => ({
          name: c.name,
          value: c.value,
          domain: c.domain || 'localhost',
          path: c.path || '/',
          secure: false, // Force secure=false for HTTP CI
          sameSite: c.sameSite || 'lax',
          httpOnly: c.httpOnly || false,
        })),
      )
    }
  }

  // Step 3: Navigate to the app — the cookie is sent via same-origin proxy
  // to the backend API, bypassing SameSite=Lax cross-origin restrictions.
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  // Step 4: Persist cookies + localStorage for all dependent suites.
  mkdirSync(dirname(AUTH_STATE), { recursive: true })
  await context.storageState({ path: AUTH_STATE })
})
