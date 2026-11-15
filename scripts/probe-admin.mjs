#!/usr/bin/env node
/**
 * Temporary: create the local 'default' tenant + an admin user for the
 * end-to-end order-flow check. Uses Better Auth's own sign-up endpoint so the
 * password hash matches what the app expects. Deleted after the check.
 */
const BASE = process.env.API_BASE || 'http://localhost:3100'
const EMAIL = process.env.ADMIN_EMAIL || 'aayurtshrestha@gmail.com'
const PASSWORD = process.env.ADMIN_PASSWORD || 'SyashaAdmin2026!'

let cookie = ''

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method || 'GET',
    headers: {
      Origin: BASE,
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  const setCookie = res.headers.get('set-cookie')
  if (setCookie) cookie = setCookie.split(';')[0]
  return res
}

// Try sign-up first.
const signUp = await req('/api/auth/sign-up/email', {
  method: 'POST',
  body: { email: EMAIL, password: PASSWORD, name: 'Local Admin' },
})
const upBody = await signUp.text()
console.log('SIGN_UP_STATUS', signUp.status)
console.log('SIGN_UP_BODY', upBody.slice(0, 300))

// Now sign in.
const signIn = await req('/api/auth/sign-in/email', {
  method: 'POST',
  body: { email: EMAIL, password: PASSWORD },
})
const inBody = await signIn.text()
console.log('SIGN_IN_STATUS', signIn.status)
console.log('SIGN_IN_BODY', inBody.slice(0, 300))
