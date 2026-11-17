/**
 * Clear all accounting data from the local Syasyah Samaj database,
 * preserving user auth accounts/credentials/profiles.
 *
 * Safe to re-run: every DELETE targets tables that exist after migration.
 * Order respects foreign-key constraints (children before parents).
 * Production guard: refuses to run unless CLEAR_DATA_ALLOW=1 and NODE_ENV != production.
 *
 * Usage:
 *   DATABASE_URI=postgresql://... NODE_ENV=development CLEAR_DATA_ALLOW=1 pnpm tsx scripts/clear-local-data.ts
 */
import { execSync } from 'node:child_process'

const DATABASE_URI = process.env.DATABASE_URI
if (!DATABASE_URI) {
  console.error('clear-local-data requires DATABASE_URI.')
  process.exit(1)
}
if (process.env.NODE_ENV === 'production') {
  console.error('clear-local-data refuses to run with NODE_ENV=production.')
  process.exit(1)
}
if (process.env.CLEAR_DATA_ALLOW !== '1') {
  console.error('clear-local-data requires CLEAR_DATA_ALLOW=1 to run.')
  process.exit(1)
}

const psql = `psql "${DATABASE_URI}" -v ON_ERROR_STOP=1`

// Children first, then parents. Users table is deliberately excluded.
const statements = [
  // transactional document children
  `DELETE FROM documents_journal_lines;`,
  `DELETE FROM documents_lines;`,
  `DELETE FROM documents_tax_lines;`,
  `DELETE FROM documents_voided_items;`,
  `DELETE FROM documents;`,
  `DELETE FROM journal_entries;`,
  `DELETE FROM doc_sequences;`,
  `DELETE FROM audit_logs;`,
  `DELETE FROM stock_movements;`,
  // masters
  `DELETE FROM items;`,
  `DELETE FROM parties;`,
  `DELETE FROM tax_types;`,
  // chart of accounts (accounts reference account_groups + tenant)
  `DELETE FROM gl_accounts;`,
  `DELETE FROM account_groups;`,
  // fiscal years
  `DELETE FROM fiscal_years;`,
  // tenants (all — users are preserved, tenant rows on users are left dangling
  // until a re-seed re-creates tenants; users collection has no FK to tenants)
  `DELETE FROM tenants;`,
  // globals
  `DELETE FROM globals;`,
]

for (const stmt of statements) {
  try {
    execSync(`${psql} -c ${JSON.stringify(stmt)}`, { stdio: 'inherit' })
  } catch (err) {
    console.error(`clear-local-data failed at: ${stmt}`)
    process.exit(1)
  }
}

execSync(`${psql} -c "SELECT 'CLEAR-LOCAL-DATA COMPLETE' AS status;"`, { stdio: 'inherit' })
console.log('clear-local-data — done (users preserved)')
