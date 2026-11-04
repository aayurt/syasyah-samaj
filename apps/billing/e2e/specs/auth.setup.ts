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

setup('authenticate as admin', async ({ page, request }) => {
  async function attemptSignIn() {
    return await request.post(`${API_BASE}/api/auth/sign-in/email`, {
      data: { email: EMAIL, password: PASSWORD },
      headers: { Origin: `http://localhost:${WEB_PORT}` },
    })
  }

  // Sign in via better-auth API to get the session cookie.
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

  // Set the real session cookie for the SPA origin (port 5174) so
  // dependent suites can make same-origin API calls through the SPA
  // server proxy to the backend API (port 3100).
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
        }
      })
      .filter((c) => c.name && c.value)
    if (parsed.length > 0) {
      await page.context().addCookies(parsed)
    }
  }

  // Navigate to the app so authClient.useSession() can establish the
  // session via same-origin proxy (cookies are sent with same-origin
  // requests, bypassing SameSite=Lax cross-origin restrictions).
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  // Persist cookies + localStorage for all dependent suites.
  mkdirSync(join(root, '.auth'), { recursive: true })
  await page.context().storageState({ path: join(root, '.auth', 'user.json') })
})
