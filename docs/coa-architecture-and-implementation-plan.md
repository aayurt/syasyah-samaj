# Chart of Accounts — Architecture & Implementation Plan

**Project:** syasyah-samaj (Nepali community org accounting SPA)
**Stack:** Payload CMS 3.75 + Next.js 15, Postgres, React 19, Tailwind, TypeScript
**Location:** `src/collections/gl-accounts`, `src/collections/opening-balances`, `src/utilities/accountingValidation`
**Status:** Phase 1 — schema inspection complete; implementation not started

---

## 1. Current state (implemented, deployed on staging + prod)

### COA — single table `gl-accounts` (slug, not `accounts` due to better-auth collision)

Fields:
- `code` text — unique per tenant (enforced in `validateAccount`)
- `name` text required
- `description` textarea
- `group` relationship → `account-groups`
- `parent` relationship → `gl-accounts` (self, hierarchy)
- `level` number default 0 (auto-computed from parent chain)
- `type` select required — asset/liability/equity/income/expense (options from `accountTypeOptions`)
- `class` select — cash/bank/other
- `openingBalance` number default 0 — **deprecated**, single source of truth is `opening-balances`
- `active` checkbox default true
- `allowManualPosting` checkbox default true
- `normalBalance` select — debit/credit
- `tenant` relationship → `tenants` required

Hooks: `beforeValidate: [assignTenant, validateAccount]`
- unique code per tenant (excluding self)
- no self-parent
- circular parent detection (≤50 hops)
- `level` auto-computed from parent

Endpoints:
- `GET /api/gl-accounts/balances` — net balance per account (journal sums + opening balance, signed by type)
- `POST /api/gl-accounts/seed-defaults` — standard COA seed per tenant (super-admin only)

### Opening balances — `opening-balances`

Fields: `fiscalYear`, `account`, `amount` (signed: debit-positive for asset/expense), `tenant`, `status` (draft/approved/posted/reversed/rejected), `posted_to_journal`, audit fields (created/updated/approved/posted/reversed by + at), `rejection_reason`, `reversal_reason`, `source_batch_id` (self-FK)

Endpoints: `/save-wizard` (duplicate-draft `confirmReplace` guard, Dr=Cr enforcement), `/approve` (billing+central), `/reject` (billing+central + reason), `/post` (atomic Payload transaction, journal create + balance marks, Dr=Cr rejection, no residual absorption, billing+admin/super-admin)

Migration: `src/migrations/20261116_100000_coa_opening_balance_columns.ts` — up/down for gl_accounts hierarchy + opening_balances workflow columns

Utilities: `@/utilities/accountingValidation` (`validateAccountData`, `validateOpeningBatch`), `@/utilities/journalValidation` (`round2`, `toNum`), `@/utilities/journalSums` (`sumPostedByAccount`)

### What's NOT in current state (per new spec)

| Area | Current | Target |
|------|---------|--------|
| COA entities | `gl-accounts` + `account-groups` | 15 normalized entities |
| Hierarchy levels | `level` integer | 5 named levels: Type → Group → Category → Control → Ledger |
| Account status | `active` checkbox | Active / Inactive / Blocked / Archived |
| Posting allowed | `allowManualPosting` checkbox | `postingAllowed` boolean |
| Control account | none | `controlAccount` boolean |
| Reconciliation required | none | boolean |
| Dimensions | none | branch, cost centre, currency |
| Opening balance lines | signed `amount` | separate `debit` + `credit` columns (not both positive) |
| Multi-company | `tenant` | `company_id` |
| Audit log | inline fields | `account_audit_logs` table |
| Soft delete | none | soft-delete strategy |
| Excel import/export | none | required (preview + row-level errors) |
| Validation engine | inline checks | centralized engine w/ code/field/severity/message/record/suggested correction |
| Ledger / tree API | `/balances` only | `/tree`, `/:id/children`, `/:id/ledger` |
| Account numbering rules | none | `account_numbering_rules` |

---

## 2. Target state (from COA spec)

### Standard account classification

| Type | Normal Balance | Financial Statement |
|------|---------------|---------------------|
| Asset | Debit | Balance Sheet |
| Liability | Credit | Balance Sheet |
| Equity | Credit | Balance Sheet |
| Income | Credit | Income Statement |
| Expense | Debit | Income Statement |

### 5-level hierarchy
Level 1 Account Type → Level 2 Account Group → Level 3 Account Category → Level 4 Control Account → Level 5 Ledger Account

### Account master fields (spec §5)
code (unique per company), name, parent, type, subtype, level (system-calculated), normalBalance, financialStatement, postingAllowed, controlAccount, reconciliationRequired, costCentreRequired, branchRequired, currencyCode, openingBalance (via module only), effectiveFrom, status (active/inactive/blocked/archived), description, audit fields

### Opening balance integration (spec §7)
Dedicated module only — no direct account-master edits. Fields: opening balance date, fiscal year, account code, debit amount, credit amount, currency, exchange rate, base currency amount, branch, cost centre, reference number, description. Validation: account exists & active, allows posting, debit & credit not both positive, amounts ≥ 0, journal balanced, no duplicate imports, company+FY scoping, no post-post modification without reversal/adjustment, subledger control reconciliation, auditable.

### Non-negotiables (spec §17)
- Double-entry accounting; no unbalanced transactions
- `decimal`/`numeric` for all monetary amounts — never float
- Account master separate from transaction data
- No direct opening-balance editing after posting
- No hardcoded Nepal tax/compliance in generic COA logic
- Multi-company support
- All financial transactions auditable
- Backend validation authoritative
- No dummy functionality

---

## 3. Database schema (new entities)

### `account_types` (replaces inline type select)
- id PK, code (asset/liability/equity/income/expense), name, normalBalance (debit/credit), financialStatement (balance-sheet/income-statement), company_id FK, created/updated audit

### `account_groups`
- id PK, code, name, type_id FK → account_types, company_id FK, level = 2, audit

### `account_categories`
- id PK, code, name, group_id FK → account_groups, company_id FK, level = 3, audit

### `chart_of_accounts` (extends / replaces `gl-accounts`)
- id PK, code (unique per company), name, description, parent_id self-FK, level (1-5, system-calculated), type_id FK → account_types, group_id FK → account_groups, category_id FK → account_categories, subtype text, normalBalance debit/credit, financialStatement, postingAllowed boolean, controlAccount boolean, reconciliationRequired boolean, costCentreRequired boolean, branchRequired boolean, currencyCode text, effectiveFrom date, status (active/inactive/blocked/archived), company_id FK → companies, softDelete (deletedAt), created/updated by + at

### `account_subtypes`
- id PK, code, name, type_id FK → account_types, company_id FK, audit

### `account_numbering_rules`
- id PK, company_id FK, level, prefix, minLength, maxLength, pattern, audit

### `currencies`
- id PK, code (NPR, USD...), name, symbol, isBase boolean, audit

### `opening_balance_batches`
- id PK, company_id FK, fiscalYear_id FK, reference, status (draft/approved/posted/rejected), totalDebit, totalCredit, created/approved/posted by + at, rejectionReason, audit

### `opening_balance_lines`
- id PK, batch_id FK → opening_balance_batches, account_id FK → chart_of_accounts, currencyCode, exchangeRate numeric, debit numeric default 0, credit numeric default 0, baseCurrencyAmount numeric, branch, costCentre, reference, description, audit
- Check: debit >= 0, credit >= 0, NOT (debit > 0 AND credit > 0)

### `account_audit_logs`
- id PK, account_id FK, action (create/update/status/hierarchy), changedBy_id FK → users, changedAt, oldValues JSON, newValues JSON, company_id FK

### `companies`, `branches`, `fiscal_years`, `cost_centres`
- Standard PK + name/code + company_id FK + audit + deletedAt soft-delete

### `account_branch_assignments`, `account_restrictions`
- Junction/rule tables per spec

All monetary columns: `numeric` — never `real`/`double precision`/`float`.

---

## 4. API endpoints (Payload collection endpoints on `chart-of-accounts`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/chart-of-accounts` | list + filter (type, status, level, posting) + pagination |
| GET | `/api/chart-of-accounts/:id` | detail |
| POST | `/api/chart-of-accounts` | create (validation engine) |
| PUT | `/api/chart-of-accounts/:id` | update (audit log) |
| PATCH | `/api/chart-of-accounts/:id/status` | status change (audit log) |
| DELETE | `/api/chart-of-accounts/:id` | soft delete; reject if children or ledger activity |
| GET | `/api/chart-of-accounts/tree` | hierarchical tree |
| GET | `/api/chart-of-accounts/:id/children` | direct children |
| GET | `/api/chart-of-accounts/:id/ledger` | account ledger activity |
| POST | `/api/chart-of-accounts/import` | Excel import preview + validate + commit |
| GET | `/api/chart-of-accounts/export` | Excel export |
| GET | `/api/chart-of-accounts/validation-rules` | rule catalog |

### Opening balance APIs (existing `opening-balances` — extend)
- `POST /api/opening-balances/save-wizard` — existing (extend to debit/credit columns)
- `POST /api/opening-balances/approve` — existing
- `POST /api/opening-balances/reject` — existing
- `POST /api/opening-balances/post` — existing (atomic, Dr=Cr reject)

---

## 5. Business rules / validation matrix (centralized engine)

Each rule returns: validationCode, fieldName, message, severity, recordReference, suggestedCorrection. Backend authoritative.

| Code | Rule | Severity |
|------|------|----------|
| COA-001 | Duplicate account code within company | Reject |
| COA-002 | Missing account name | Reject |
| COA-003 | Invalid / missing parent account | Reject |
| COA-004 | Circular parent-child relationship | Reject |
| COA-005 | Parent belongs to different company | Reject |
| COA-006 | Incompatible child account type | Reject |
| COA-007 | Post to non-posting account | Reject |
| COA-008 | Post to inactive/blocked/archived account | Reject |
| COA-009 | Delete account with children | Reject |
| COA-010 | Delete account with ledger activity | Reject |
| COA-011 | Invalid opening balance (account not active / no posting) | Reject |
| COA-012 | Debit and credit both positive on one opening line | Reject |
| COA-013 | Unbalanced opening journal | Reject |
| COA-014 | Duplicate opening-balance import | Reject |
| COA-015 | Missing company / fiscal year | Reject |

Account status semantics:
- Active: new transactions allowed
- Inactive: no new transactions; history accessible
- Blocked: temporary posting prevention
- Archived: historical reporting only; no new transactions

---

## 6. Implementation phases

**Phase 1 — Schema foundation** (this turn)
- Add `account_types`, `account_subtypes`, `account_categories`, `currencies`, `companies`, `branches`, `cost_centres`, `account_numbering_rules` collections/migrations
- Extend `chart_of_accounts` (`gl-accounts`) with: type_id, group_id, category_id, subtype, financialStatement, postingAllowed, controlAccount, reconciliationRequired, costCentreRequired, branchRequired, currencyCode, effectiveFrom, status (active/inactive/blocked/archived), deletedAt soft-delete
- Keep `level`, `parent`, `normalBalance`, `code`, `name`, `tenant`/`company_id` mapping
- Build migration `20261117_coa_normalized_entities.ts` (additive, no data loss)

**Phase 2 — Validation engine**
- Centralize `validateAccountData` into engine returning structured {code, field, message, severity, record, suggestion}
- Add all COA-001..COA-015 rules
- Wire into `beforeValidate` + endpoints

**Phase 3 — Opening balances (debit/credit)**
- Add `opening_balance_batches` + `opening_balance_lines` collections
- Migrate `opening-balances.amount` signed → batch/lines with debit/credit numeric columns
- Keep `/save-wizard`, `/approve`, `/reject`, `/post` working

**Phase 4 — Excel import/export**
- Import template columns (code, name, parentCode, type, subtype, normalBalance, postingAllowed, controlAccount, status, description)
- Upload → validate headers → row-level errors → preview → commit in transaction
- Export to Excel

**Phase 5 — Ledger / tree / audit**
- `GET /tree`, `GET /:id/children`, `GET /:id/ledger`
- `account_audit_logs` collection + write-audit on create/update/status/hierarchy
- Soft-delete enforcement (reject delete with children/activity)

**Phase 6 — UI screens**
- COA dashboard, list (search/filter/expand-collapse/pagination/export/import), creation form (8 sections w/ dependent dropdowns), tree view

**Phase 7 — Testing + QA**
- 100+ test scenarios (positive/negative/boundary/hierarchy/duplicate/authorization/multi-company/import-export/regression)
- Vitest + jest; build + deploy staging; UAT → production

---

## 7. Constraints carried over (syasyah-samaj conventions)

- Terse responses; no filler
- Lazy dev: stdlib/native first, shortest diff, YAGNI, deletion over addition
- No new deps for few-line fixes; do not modify `node_modules` permanently
- `.map()` loop variable `t` shadows i18n `useT()` — avoid
- Duplicate `import { useT }` lines crash Vite
- `framer-motion@11` + `@types/react@19`: `motion.div` loses className — use typed `MotionDiv`
- `bloodGroup` stayed `text` — enum migration failed on legacy data; SPA enforces values
- Build + tests pass before deploy; deploy rsync + PM2 reload PersonalVPS
- Production release only after UAT sign-off

---

## 8. Immediate next step

Run `pnpm build` + tests to confirm Phase 0 (already-patched QA-003..QA-008) is green, then begin Phase 1 schema migrations.
