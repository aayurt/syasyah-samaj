#!/usr/bin/env node
/**
 * e2e DB bootstrap + masters-only seed.
 *
 * Runs as the `00-seed` setup project, after the Playwright webServer has
 * booted the API instance. It makes the target database usable for the suite
 * and then seeds the masters (idempotent):
 *
 *   1. Shared dev DB (no E2E_DATABASE_URI): the admin already exists, so we
 *      skip straight to `billing-seed.mjs` with SKIP_VOUCHERS=1.
 *   2. Fresh/CI DB (E2E_DATABASE_URI set): create the `default` tenant (the
 *      multi-tenant plugin's "Assigned Tenant" field is required, so sign-up
 *      fails until a tenant exists), sign up the admin via better-auth, and
 *      promote the role with a direct SQL update (the Users beforeChange hook
 *      forces `user` for non-admin callers, so the API can't self-promote).
 *      Then run the seed.
 *
 * SQL goes through the `psql` CLI (needs to be on PATH; the seed itself stays
 * HTTP-only). E2E_DATABASE_URI falls back to the repo .env DATABASE_URI.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../../../../')

const API = `http://localhost:${process.env.E2E_API_PORT || 3100}/api`
// better-auth requires Origin to match the API's BETTER_AUTH_URL, which the
// config sets to the SPA origin (E2E_WEB_PORT) for the e2e instance.
const ORIGIN =
  process.env.BILLING_ORIGIN ||
  process.env.E2E_ORIGIN ||
  `http://localhost:${process.env.E2E_WEB_PORT || 5174}`
const EMAIL = process.env.E2E_EMAIL || 'aayurtshrestha@gmail.com'
const PASSWORD = process.env.E2E_PASSWORD || 'SyashaAdmin2026!'

function dotenvValue(key) {
  const file = join(repoRoot, '.env')
  if (!existsSync(file)) return undefined
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && m[1] === key) return m[2].replace(/^["']|["']$/g, '')
  }
  return undefined
}

const DB = process.env.E2E_DATABASE_URI || dotenvValue('DATABASE_URI')

async function api(path, opts = {}) {
  const res = await fetch(API + path, {
    method: opts.method || 'GET',
    headers: {
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      ...(opts.headers || {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    data = text
  }
  return { ok: res.ok, status: res.status, data }
}

function sql(statements) {
  if (!DB) throw new Error('No database URL: set E2E_DATABASE_URI or DATABASE_URI in .env')
  const r = spawnSync('psql', [DB, '-v', 'ON_ERROR_STOP=1', '-c', statements.join('; ')], {
    stdio: ['ignore', 'inherit', 'inherit'],
  })
  if (r.status !== 0) throw new Error(`psql failed (exit ${r.status})`)
}

const log = (msg) => console.log(`\n[seed] ${msg}`)

// ---- 1. Does the admin already exist? (shared dev DB → skip bootstrap) ----
const signIn = await api('/auth/sign-in/email', {
  method: 'POST',
  headers: { Origin: ORIGIN },
  body: { email: EMAIL, password: PASSWORD },
})
if (!signIn.ok) {
  log(`admin sign-in failed (${signIn.status}) — bootstrapping a fresh DB`)
  // 1a. The multi-tenant plugin's required "Assigned Tenant" field blocks
  //     sign-up until a default tenant exists.
  sql([
    `INSERT INTO tenants (code, slug, type, active) SELECT 'DEFAULT', 'default', 'central', true WHERE NOT EXISTS (SELECT 1 FROM tenants WHERE slug = 'default')`,
    `INSERT INTO tenants_locales (name, _locale, _parent_id) SELECT 'Central (default)', 'en', id FROM tenants t WHERE t.slug = 'default' AND NOT EXISTS (SELECT 1 FROM tenants_locales tl WHERE tl._parent_id = t.id AND tl._locale = 'en')`,
  ])
  // 1b. Create the admin through better-auth, then promote via SQL (the API
  //     beforeChange hook forces role 'user' for non-admin sign-ups).
  const signUp = await api('/auth/sign-up/email', {
    method: 'POST',
    headers: { Origin: ORIGIN },
    body: { email: EMAIL, password: PASSWORD, name: 'E2E Admin' },
  })
  if (signUp.ok) {
    sql([`UPDATE users SET role = 'admin' WHERE email = '${EMAIL.replace(/'/g, "''")}'`])
    log('admin created and promoted')
  } else if (signUp.status !== 409 && !/already|exists|duplicate/i.test(JSON.stringify(signUp.data))) {
    throw new Error(`sign-up failed (${signUp.status}): ${JSON.stringify(signUp.data).slice(0, 300)}`)
  } else {
    log(`sign-up skipped (${signUp.status}) — continuing; the seed will surface real auth issues`)
  }
} else {
  log(`admin already present — skipping fresh-DB bootstrap`)
}

// ---- 1.5. Dedicated e2e DB: wipe so every suite starts from a clean state ----
// The seed is idempotent — once the admin exists it skips the fresh-DB
// bootstrap above, so data from a previous run survives and shifts
// doc_sequences, breaking the suites' expected numbers (e.g. the month
// expects JV-…-0001 while a leftover run makes the next voucher JV-…-0004).
// Transactional rows are wiped first, then the master tables the seed
// re-creates — wiping masters too means they are re-seeded from scratch with
// deterministic ids rather than merged find-or-create on top of stale rows.
// Only wipe when E2E_DATABASE_URI is set; the no-URI fallback targets a
// shared dev DB where deleting rows would be destructive. All listed tables
// are regenerated by the seed (step 2) or by the server on demand
// (doc_sequences restart at 0001 on first post).
if (process.env.E2E_DATABASE_URI) {
  log('wiping transactional + master tables (vouchers, journal, accounts, parties, items, fiscal years, settings)')
  sql([
    'TRUNCATE TABLE documents, journal_entries, doc_sequences, stock_movements, audit_logs RESTART IDENTITY CASCADE',
    'TRUNCATE TABLE gl_accounts, account_groups, parties, items, fiscal_years, billing_settings RESTART IDENTITY CASCADE',
  ])
}

// ---- 2. Masters-only seed (idempotent, no vouchers) ----
log('running billing-seed.mjs (SKIP_VOUCHERS=1) …')
const seed = spawnSync(process.execPath, [join(repoRoot, 'billing-seed.mjs')], {
  env: {
    ...process.env,
    BILLING_API: API,
    BILLING_ORIGIN: ORIGIN,
    BILLING_EMAIL: EMAIL,
    BILLING_PASSWORD: PASSWORD,
    SKIP_VOUCHERS: '1',
  },
  stdio: 'inherit',
})
if (seed.status !== 0) {
  throw new Error(`billing-seed.mjs failed (exit ${seed.status})`)
}
log('masters seeded — suites may proceed')