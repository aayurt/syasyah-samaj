# API Testing Plan — Sequential CRUD Workflow on Empty Test DB

## Principles

1. **Start empty** — Every test run wipes the DB, seeds only the minimum (tenant + admin user).
2. **Hierarchical order** — Create parents before children (FY → Account Groups → Accounts → Parties → Items → Vouchers → Journal → Payroll).
3. **Important fields first** — Test required/unique/immutable fields before optional ones.
4. **Balances must balance** — Every double-entry posting validated: total debits = total credits.
5. **Sequential, not parallel** — Each API call depends on the previous one's created IDs.

---

## Test Script: `scripts/test/apis/sequential-api-check.mjs`

### What it does

- Wipes all tables (via SQL `TRUNCATE ... RESTART IDENTITY CASCADE`)
- Seeds: default tenant + admin user
- Runs sequential CRUD across all major APIs in dependency order
- After each write, GETs back the record to verify it was stored correctly
- At the end, posts a voucher and asserts journal debits = credits
- Exits non-zero on any failure; prints a pass/fail table per API

### API Sequence (dependency-ordered)

```
1.  Tenants          → create default tenant (if not exists)
2.  Users            → create admin user (already seeded)
3.  Fiscal Years     → create FY 2083-84 (2026-07-16 → 2027-07-15), set as working
4.  Account Groups   → create "Assets", "Liabilities", "Equity", "Income", "Expenses"
5.  Accounts         → create Cash, Bank, Receivables, Payables, Sales, Purchases (under groups)
6.  Parties          → create customers + vendors
7.  Items            → create goods/services items with income/expense accounts
8.  Settings         → company name, PAN, fiscal year, VAT rate (13%)
9.  Vouchers         → create payment voucher (Cash → Bank), receipt voucher, journal voucher
10. Journal          → post voucher → assert debits = credits → check Trial Balance
11. Payroll (optional) → create pay group → generate periods → create employees → generate payroll run → post
12. Reports          → Trial Balance, P&L, Balance Sheet — assert they return 200 with data
13. Excel Import     → import master file (14 sheets) → assert row counts match
14. Excel Export     → export → assert file downloads, sheet count = 14
```

### Per-API Checks

| API | Create Check | Read Check | Update Check | Delete Check | Balance Check |
|---|---|---|---|---|---|
| Tenants | ✓ code unique | ✓ list returns 1 | ✓ name update | ✗ (protected) | — |
| Users | ✓ email unique | ✓ list returns 1 | ✓ password reset | ✗ (protected) | — |
| Fiscal Years | ✓ start < end | ✓ working year set | ✓ close/open | ✗ (if vouchers exist) | — |
| Account Groups | ✓ name required | ✓ tree order | ✓ parent reassign | ✓ (if no accounts) | — |
| Accounts | ✓ code unique per group | ✓ balance reads 0 | ✓ name/type | ✗ (if transactions) | — |
| Parties | ✓ name + type | ✓ balance reads 0 | ✓ contact update | ✓ (if no transactions) | — |
| Items | ✓ SKU unique | ✓ stock reads 0 | ✓ price update | ✓ (if no transactions) | — |
| Vouchers | ✓ voucher number unique | ✓ lines stored | ✓ void (draft only) | ✗ (if posted) | ✓ debits = credits |
| Journal | ✓ entry balanced | ✓ daybook shows entry | ✗ | ✗ | ✓ TB balances |
| Payroll | ✓ run generated | ✓ lines computed | ✓ post/void | ✗ (if posted) | ✓ gross − deductions = net |

---

## Git Workflow

### Pre-push API check (local)

```bash
# In .git/hooks/pre-push (or run manually before push)
pnpm test:api-sequential
```

### CI integration

Add to `.github/workflows/ci.yml` as a new job `api-sequential-check` that runs after unit-tests, before e2e-tests:

```yaml
api-sequential-check:
  name: API Sequential Check
  runs-on: ubuntu-latest
  needs: [typecheck-lint, unit-tests]
  services:
    postgres:
      image: postgres:16-alpine
      ...
  steps:
    - Checkout
    - Setup Node + pnpm
    - Install dependencies
    - Wait for PostgreSQL
    - Run DB schema generation
    - Run sequential API check:
      run: node scripts/test/apis/sequential-api-check.mjs
      env:
        DATABASE_URI: postgresql://postgres:postgres@localhost:5432/billing_api_test
        API_BASE: http://localhost:3100
        ADMIN_EMAIL: aayurtshrestha@gmail.com
        ADMIN_PASSWORD: SyashaAdmin2026!
```

### Branch protection

Require `api-sequential-check` to pass before merging to `main`.

---

## Script Structure

```javascript
// scripts/test/apis/sequential-api-check.mjs

import { createRequest } from '../../helpers/api-client.mjs'

const BASE = process.env.API_BASE || 'http://localhost:3100'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD

let results = []  // [{api, operation, status, detail}]
let created = {}  // store IDs for dependent calls

async function check(name, fn) {
  try {
    await fn()
    results.push({ api: name, status: 'PASS' })
    console.log(`  ✓ ${name}`)
  } catch (err) {
    results.push({ api: name, status: 'FAIL', detail: err.message })
    console.log(`  ✗ ${name}: ${err.message}`)
  }
}

async function main() {
  // 1. Wipe DB
  await wipeDatabase()

  // 2. Seed tenant + admin
  await seedTenantAndAdmin()

  // 3. Sequential CRUD
  await check('Fiscal Years', testFiscalYears)
  await check('Account Groups', testAccountGroups)
  await check('Accounts', testAccounts)
  await check('Parties', testParties)
  await check('Items', testItems)
  await check('Settings', testSettings)
  await check('Vouchers', testVouchers)
  await check('Journal Balance', testJournalBalance)
  await check('Reports', testReports)

  // 4. Summary
  const fails = results.filter(r => r.status === 'FAIL')
  console.log(`\n${results.length - fails.length}/${results.length} APIs passed`)
  process.exit(fails.length > 0 ? 1 : 0)
}

main()
```

### Balance Assertion (journal)

```javascript
async function testJournalBalance() {
  // Post a voucher: Dr Cash 1000, Cr Bank 1000
  const voucher = await request.post('/api/vouchers', {
    body: { lines: [{ account: cashId, debit: 1000 }, { account: bankId, credit: 1000 }] }
  })
  // GET the posted voucher
  const stored = await request.get(`/api/vouchers/${voucher.id}`)
  const totalDebits = stored.lines.reduce((s, l) => s + (l.debit || 0), 0)
  const totalCredits = stored.lines.reduce((s, l) => s + (l.credit || 0), 0)
  if (totalDebits !== totalCredits) throw new Error(`Unbalanced: Dr=${totalDebits} Cr=${totalCredits}`)
  // Trial Balance
  const tb = await request.get('/api/reports/trial-balance')
  const tbDebits = tb.rows.reduce((s, r) => s + (r.debit || 0), 0)
  const tbCredits = tb.rows.reduce((s, r) => s + (r.credit || 0), 0)
  if (Math.abs(tbDebits - tbCredits) > 0.01) throw new Error(`Trial Balance unbalanced`)
}
```

---

## Running Locally

```bash
# Terminal 1: Start API server
cd /Users/aayurtshrestha/Projects/supreme/syasyah-samaj
DATABASE_URI=postgresql://postgres:postgres@localhost:5432/billing_api_test \
  PORT=3100 \
  pnpm dev

# Terminal 2: Run the sequential API check
DATABASE_URI=postgresql://postgres:postgres@localhost:5432/billing_api_test \
  API_BASE=http://localhost:3100 \
  ADMIN_EMAIL=aayurtshrestha@gmail.com \
  ADMIN_PASSWORD=SyashaAdmin2026! \
  node scripts/test/apis/sequential-api-check.mjs
```

---

## Exit Codes

| Code | Meaning |
|---|---|
| 0 | All APIs passed |
| 1 | One or more APIs failed |
| 2 | DB wipe/seed failed (infrastructure issue) |
