/**
 * Clean all accounting & organizational data while preserving and ensuring
 * the required users (super-admin, admin, demo, etc.) with valid Better-Auth credentials.
 *
 * Usage:
 *   DATABASE_URI=postgresql://... CLEAR_DATA_ALLOW=1 pnpm tsx scripts/clean-and-seed-users.ts
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { hashPassword as baHashPassword } from 'better-auth/crypto'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..')

const connectionString = process.env.DATABASE_URI
if (!connectionString) {
  console.error('clean-and-seed-users requires DATABASE_URI to point at target database.')
  process.exit(1)
}
if (process.env.CLEAR_DATA_ALLOW !== '1') {
  console.error('clean-and-seed-users requires CLEAR_DATA_ALLOW=1 to run.')
  process.exit(1)
}

process.env.PAYLOAD_MIGRATING = 'true'
process.env.SEED_LOCAL = 'true'
if (!process.env.RESEND_API_KEY) process.env.RESEND_API_KEY = 're_seed_placeholder'
if (!process.env.PAYLOAD_SECRET) process.env.PAYLOAD_SECRET = 'seed-placeholder-secret'

const configPath = path.join(repoRoot, 'src', 'payload.config.ts')
if (!existsSync(configPath)) {
  console.error(`Config not found at ${configPath}`)
  process.exit(1)
}

console.log('clean-and-seed-users — booting Payload…')
const { default: config } = await import(configPath)
const { getPayload } = await import('payload')
const payload = await getPayload({ config })

// ── 1. Wipe non-user tables in correct foreign-key dependency order ──
const wipeTables = [
  // users tenant references
  'users_tenants_roles',
  'users_tenants',
  // payroll
  'payroll_run_employees',
  'payroll_slips',
  'payroll_runs',
  'payroll_periods',
  'payroll_component_accounts',
  'flexible_benefit_returns',
  'salary_structure_flexible_benefits',
  'salary_structure_assignments',
  'salary_structures',
  'salary_components_accounts',
  'salary_components',
  'additional_salaries',
  'loans',
  'loan_types',
  'tax_exemption_declarations',
  'expense_claims',
  'employees',
  'pay_groups',
  // banking & assets
  'fixed_assets',
  'bank_statements',
  'opening_balances',
  'opening_balance_batches',
  // members
  'members',
  'membership_types',
  // transactions
  'documents_journal_lines',
  'documents_lines',
  'documents_tax_lines',
  'documents_voided_items',
  'documents',
  'journal_entries',
  'doc_sequences',
  'audit_logs',
  'stock_movements',
  // masters
  'items',
  'parties',
  'tax_types',
  'gl_accounts',
  'account_groups',
  'fiscal_years',
  // tenants
  'tenants_gallery',
  'tenants_locales',
  'tenants',
  // globals
  'globals',
]

console.log('Wiping transactional and tenant data...')
for (const table of wipeTables) {
  try {
    await payload.db.pool.query(`DELETE FROM "${table}";`)
  } catch (err: any) {
    if (err.code !== '42P01') {
      console.warn(`Note on table ${table}:`, err.message)
    }
  }
}
console.log('✓ All non-user data wiped cleanly.')

// ── 2. Seed / Ensure Users via raw SQL for reliability ──
const seedsDir = path.join(repoRoot, 'scripts', 'seeds')
const usersJsonPath = path.join(seedsDir, 'users.json')
const seedUsers = JSON.parse(readFileSync(usersJsonPath, 'utf8'))

console.log('Ensuring user accounts & credentials...')
for (const u of seedUsers) {
  const userRes = await payload.db.pool.query(
    `INSERT INTO users (email, name, role, phone_number, email_verified, created_at, updated_at)
     VALUES ($1, $2, $3::enum_users_role, $4, true, NOW(), NOW())
     ON CONFLICT (email) DO UPDATE
       SET role = EXCLUDED.role, name = EXCLUDED.name, updated_at = NOW()
     RETURNING id;`,
    [u.email, u.name, u.role, u.phoneNumber || null]
  )
  const userId = Number(userRes.rows[0].id)
  console.log(`✓ User ${u.email} ready (Role: ${u.role}, ID: ${userId})`)

  // Ensure Better-Auth credential
  if (u.password || u.passwordHash) {
    const hash = u.passwordHash || (await baHashPassword(u.password))
    const cred = await payload.db.pool.query(
      "SELECT id FROM accounts WHERE user_id = $1::integer AND provider_id = 'credential'",
      [userId]
    )
    if (cred.rows.length > 0) {
      await payload.db.pool.query(
        "UPDATE accounts SET password = $2, updated_at = NOW() WHERE user_id = $1::integer AND provider_id = 'credential'",
        [userId, hash]
      )
      console.log(`  Credential password updated for ${u.email}`)
    } else {
      await payload.db.pool.query(
        `INSERT INTO accounts (user_id, provider_id, account_id, password, created_at, updated_at)
         VALUES ($1::integer, 'credential', $1::integer, $2, NOW(), NOW())`,
        [userId, hash]
      )
      console.log(`  Credential created for ${u.email}`)
    }
  }
}

// ── 3. Configure Billing Settings ──
try {
  await payload.updateGlobal({
    slug: 'billing-settings',
    data: {
      multiCompanyEnabled: true,
      demoSeedEnabled: true,
    },
    overrideAccess: true,
  })
  console.log('✓ Initialized billing-settings with multiCompanyEnabled: true')
} catch (e) {
  console.warn('Note on billing-settings update:', e)
}

console.log('clean-and-seed-users — COMPLETE! Database is fresh with users ready.')
process.exit(0)
