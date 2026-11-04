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

setup('authenticate as admin', async ({ page, request }) => {
  async function attemptSignIn() {
    return await request.post(`${API_BASE}/api/auth/sign-in/email`, {
      data: { email: EMAIL, password: PASSWORD },
      headers: { Origin: `http://localhost:${WEB_PORT}` },
    })
  }

  let signIn = await attemptSignIn()
  if (!signIn.ok()) {
    const signUp = await request.post(`${API_BASE}/api/auth/sign-up/email`, {
      data: { email: EMAIL, password: PASSWORD, name: 'E2E Admin' },
      headers: { Origin: `http://localhost:${WEB_PORT}` },
    })
    if (signUp.ok() || signUp.status() === 409) {
      signIn = await attemptSignIn()
    }
    if (!signIn.ok()) {
      throw new Error(
        `API sign-in failed: ${signIn.status()} ${await signIn.text()}`,
      )
    }
  }

  // Set the real session cookie with explicit secure=false so it is sent
  // over HTTP same-origin requests through the SPA proxy.
  const setCookieHeader = signIn.headers()['set-cookie']
  if (setCookieHeader) {
    const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader]
    const parsed = cookies
      .flatMap((c) => c.split(/,\s*(?=[^=]+=)/))
      .map((c) => {
        const [nameValue] = c.split(';')
        const eqIdx = nameValue.indexOf('=')
        return {
          name: nameValue.slice(0, eqIdx).trim(),
          value: nameValue.slice(eqIdx + 1).trim(),
          url: `http://localhost:${WEB_PORT}`,
          secure: false,
          sameSite: 'lax' as const,
        }
      })
      .filter((c) => c.name && c.value)
    if (parsed.length > 0) {
      await page.context().addCookies(parsed)
    }
  }

  // Navigate — authClient.useSession() sends the cookie via same-origin
  // proxy to the backend API, bypassing SameSite=Lax cross-origin rules.
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  // Verify the session is established (login form is hidden).
  await expect(page.locator('input[type="email"]')).toBeHidden({
    timeout: 10_000,
  })

  // Persist cookies + localStorage for all dependent suites.
  mkdirSync(join(root, '.auth'), { recursive: true })
  await page.context().storageState({ path: AUTH_STATE })
})
