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
 * Handles: name=value; Domain=...; Path=...; Secure; HttpOnly; SameSite=...
 */
function parseSetCookie(header) {
  const parts = header.split(';').map((p) => p.trim())
  const eqIdx = parts[0].indexOf('=')
  const name = parts[0].slice(0, eqIdx).trim()
  const value = parts[0].slice(eqIdx + 1).trim()

  const cookie = { name, value, secure: false, sameSite: 'lax' }

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

async function main() {
  // Step 1: API sign-in (server-side fetch, no browser cookie issues)
  let res = await fetch(`${API_BASE}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: `http://localhost:${WEB_PORT}`,
    },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })

  if (!res.ok) {
    // User doesn't exist — sign up first, then retry sign-in
    await fetch(`${API_BASE}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: `http://localhost:${WEB_PORT}`,
      },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD, name: 'E2E Admin' }),
    })
    res = await fetch(`${API_BASE}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: `http://localhost:${WEB_PORT}`,
      },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    })
    if (!res.ok) {
      throw new Error(`API sign-in failed: ${res.status} ${await res.text()}`)
    }
  }

  // Step 2: Extract cookies from Set-Cookie headers
  const raw = res.headers.raw()
  const setCookieHeaders = raw['set-cookie'] || []
  const cookies = setCookieHeaders.map(parseSetCookie).filter((c) => c.name && c.value)

  if (cookies.length === 0) {
    throw new Error('No session cookies received from sign-in API')
  }

  // Step 3: Construct Playwright-compatible storage state
  // Force secure=false so Chromium sends cookies over HTTP in CI.
  const storageState = {
    cookies: cookies.map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain || 'localhost',
      path: c.path || '/',
      secure: false,
      sameSite: c.sameSite || 'lax',
      httpOnly: c.httpOnly || false,
    })),
    origins: [{ origin: `http://localhost:${WEB_PORT}`, localStorage: [] }],
  }

  // Step 4: Save storage state for dependent E2E suites
  mkdirSync(dirname(AUTH_STATE), { recursive: true })
  require('node:fs').writeFileSync(AUTH_STATE, JSON.stringify(storageState, null, 2))
  console.log(`Auth state saved to ${AUTH_STATE} with ${cookies.length} cookies`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
