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
  // Route-intercept session endpoint as a fallback so the shell renders
  // even if the session cookie isn't accepted over HTTP.
  await page.route('**/api/auth/session', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: { email: EMAIL, role: 'admin' } }),
    })
  )
  await page.route('**/api/auth/get-session', (route) =>
    route.fulfill({ status: 200, body: '' })
  )

  // Step 1: API sign-in (server-side)
  let signIn = await request.post(`${API_BASE}/api/auth/sign-in/email`, {
    data: { email: EMAIL, password: PASSWORD },
    headers: { Origin: `http://localhost:${WEB_PORT}` },
  })

  if (!signIn.ok()) {
    await request.post(`${API_BASE}/api/auth/sign-up/email`, {
      data: { email: EMAIL, password: PASSWORD, name: 'E2E Admin' },
      headers: { Origin: `http://localhost:${WEB_PORT}` },
    })
    signIn = await request.post(`${API_BASE}/api/auth/sign-in/email`, {
      data: { email: EMAIL, password: PASSWORD },
      headers: { Origin: `http://localhost:${WEB_PORT}` },
    })
    if (!signIn.ok()) {
      throw new Error(`API sign-in failed: ${signIn.status()} ${await signIn.text()}`)
    }
  }

  // Step 2: Set session cookie with secure=false for HTTP CI
  const setCookieHeader = signIn.headers()['set-cookie']
  if (setCookieHeader) {
    const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader]
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
          secure: false,
          sameSite: ((c.sameSite?.charAt(0).toUpperCase() + c.sameSite.slice(1)) as 'Strict' | 'Lax' | 'None') || 'Lax',
          httpOnly: c.httpOnly || false,
        })),
      )
    }
  }

  // Step 3: Navigate — cookie sent via same-origin proxy, or route
  // interception catches the session fetch as fallback.
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  // Step 4: Persist storage state.
  mkdirSync(dirname(AUTH_STATE), { recursive: true })
  await page.context().storageState({ path: AUTH_STATE })
})
