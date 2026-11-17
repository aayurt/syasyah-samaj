/**
 * Seed the local Syasyah Samaj database from scripts/seeds/*.json.
 *
 * Boots Payload's config, then inserts seed data in dependency order
 * (tenants → accounts → fiscal years → users).
 * Idempotent: skips tenants/users whose unique key already exists.
 *
 * Usage:
 *   DATABASE_URI=postgresql://nepse:nepse@localhost:5432/syasyah_samaj \
 *   NODE_ENV=development pnpm tsx scripts/seed-local.ts
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..')

const connectionString = process.env.DATABASE_URI
if (!connectionString) {
  console.error('seed-local requires DATABASE_URI to point at the target database.')
  process.exit(1)
}
if (process.env.NODE_ENV === 'production') {
  console.error('seed-local refuses to run with NODE_ENV=production.')
  process.exit(1)
}
process.env.PAYLOAD_MIGRATING = 'false'
// Lets the Users beforeChange hook keep the roles declared in users.json.
// Never set this in the web process — only trusted seed data uses it.
process.env.SEED_LOCAL = 'true'
if (!process.env.RESEND_API_KEY) process.env.RESEND_API_KEY = 're_seed_placeholder'
if (!process.env.PAYLOAD_SECRET) process.env.PAYLOAD_SECRET = 'seed-placeholder-secret'

const configPath = path.join(repoRoot, 'src', 'payload.config.ts')
if (!existsSync(configPath)) {
  console.error(`seed-local could not find the Payload config at ${configPath}`)
  process.exit(1)
}

console.log('seed-local — booting Payload…')
const { default: config } = await import(configPath)
const { getPayload } = await import('payload')
const payload = await getPayload({ config })

const seedsDir = path.join(repoRoot, 'scripts', 'seeds')
const loadJson = (name: string) => {
  const p = path.join(seedsDir, name)
  if (!existsSync(p)) throw new Error(`Missing seed file: ${p}`)
  return JSON.parse(readFileSync(p, 'utf8'))
}

// ── 1. Tenants ──
const tenants = loadJson('tenants.json')
for (const t of tenants) {
  const existing = await payload.find({ collection: 'tenants', where: { code: { equals: t.code } } })
  if (existing.totalDocs > 0) { console.log(`tenant ${t.code} exists, skipping`); continue }
  const created = await payload.create({ collection: 'tenants', data: { name: t.name, code: t.code, slug: t.slug, type: t.type, active: t.active, enabled: t.enabled } })
  console.log(`created tenant ${t.code} (${created.id})`)
}
const tenantDocs = await payload.find({ collection: 'tenants', where: { code: { equals: tenants[0].code } } })
const tenantId = tenantDocs.docs[0].id

// ── 2. Chart of accounts (resolve parentCode by code) ──
const accounts = loadJson('chart-of-accounts.json')
const accountByCode = new Map<string, string>() // code -> id
for (const a of accounts) {
  const existing = await payload.find({
    collection: 'gl-accounts',
    where: { code: { equals: a.code }, tenant: { equals: tenantId } },
  })
  if (existing.totalDocs > 0) {
    console.log(`account ${a.code} exists, skipping`)
    accountByCode.set(a.code, existing.docs[0].id)
    continue
  }
  const data: Record<string, unknown> = { ...a, tenant: tenantId }
  if (a.parentCode) {
    const parentId = accountByCode.get(a.parentCode)
    if (parentId) data.parent = parentId
  }
  const created = await payload.create({ collection: 'gl-accounts', data })
  accountByCode.set(a.code, created.id)
  console.log(`created account ${a.code}`)
}

// ── 3. Fiscal years ──
const fiscalYears = loadJson('fiscal-years.json')
for (const fy of fiscalYears) {
  const existing = await payload.find({
    collection: 'fiscal-years',
    where: { label: { equals: fy.label }, tenant: { equals: tenantId } },
  })
  if (existing.totalDocs > 0) { console.log(`fiscal year ${fy.label} exists, skipping`); continue }
  await payload.create({ collection: 'fiscal-years', data: { ...fy, tenant: tenantId } })
  console.log(`created fiscal year ${fy.label}`)
}

// ── 4. Demo users (preserved by clear-data) ──
import { hashPassword as baHashPassword } from 'better-auth/crypto'
// better-auth uses noble-hashes scrypt with salt as hex string — must use its
// own hashPassword so verifyPassword matches at sign-in.
const hashPassword = async (password: string) => baHashPassword(password)

const users = loadJson('users.json')
for (const u of users) {
  const tenantRoles = (u.role === 'admin' || u.role === 'super-admin'
    ? ['tenant-admin']
    : ['tenant-viewer']) as ('tenant-admin' | 'tenant-viewer')[]
  const tenantsData = [{ tenant: tenantId, roles: tenantRoles }]
  const existing = await payload.find({ collection: 'users', where: { email: { equals: u.email } } })
  if (existing.totalDocs === 0) {
    await payload.create({ collection: 'users', data: { ...u, tenant: tenantId, tenants: tenantsData } })
    console.log(`created user ${u.email}`)
  } else {
    console.log(`user ${u.email} exists, skipping`)
  }
  const userDoc = await payload.find({ collection: 'users', where: { email: { equals: u.email } } })
  const userId = userDoc.docs[0].id

  // Seed is the source of truth for local demo roles. The hook used to flatten
  // every role to 'user', so sync existing rows too when re-seeding.
  if (u.role && userDoc.docs[0].role !== u.role) {
    await payload.update({ collection: 'users', id: userId, data: { role: u.role } })
    console.log(`role synced to ${u.role} for ${u.email}`)
  }
  // tenantScoped.ts needs the multi-tenant array (or a singular tenant) to
  // resolve a viewer's read scope — seed rows used to have neither.
  if (!userDoc.docs[0].tenants?.length) {
    await payload.update({ collection: 'users', id: userId, data: { tenant: tenantId, tenants: tenantsData } })
    console.log(`tenant assignment added for ${u.email}`)
  }

  // ── better-auth credential so the user can sign in with email/password ──
// payload.db.pool gives raw Postgres access to the accounts table
// better-auth stores credential as ${salt}:${scryptHash}
  if (u.password) {
    const hash = await hashPassword(u.password)
    const existing = await payload.db.pool.query(
      "SELECT id FROM accounts WHERE user_id = $1::integer AND provider_id = 'credential'",
      [userId]
    )
    if (existing.rows.length > 0) {
      await payload.db.pool.query(
        "UPDATE accounts SET password = $2, updated_at = NOW() WHERE user_id = $1::integer AND provider_id = 'credential'",
        [userId, hash]
      )
      console.log(`credential password updated for ${u.email}`)
    } else {
      await payload.db.pool.query(
        `INSERT INTO accounts (user_id, provider_id, account_id, password, created_at, updated_at)
         VALUES ($1::integer, 'credential', $1::integer, $2, NOW(), NOW())`,
        [userId, hash]
      )
      console.log(`credential created for ${u.email}`)
    }
  }
}

console.log('seed-local — done')
process.exit(0)
