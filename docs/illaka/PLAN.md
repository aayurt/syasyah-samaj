# Syasya Samaj — Centralized Multi-Illaka Accounting & Management System

**Status:** Draft v1 · **Context:** syasyah-samaj (Payload 3.75 + Next 15 + Postgres + better-auth)
**Change of plans:** this document supersedes the single-book direction of `docs/billing/PLAN.md`. The billing module's accounting engine (accounts, journal, documents, posting, reports, offline sync) is **reused as the core**; the new organizing dimension is **Illaka (branch / sub-group)**.

---

## 1. Vision

A **centralized multi-illaka accounting and management system** where each illaka operates independently, while the central organization has complete visibility and audit authority over everything.

> **Key principle:** *Independent operation + centralized visibility + centralized audit + controlled official communication.*

Central should **not** manually enter the illakas' transactions. Illaka users enter their own transactions and documents; Central reviews, approves where required, and audits them.

---

## 2. Organization structure

```
                CENTRAL ORGANIZATION
                        │
             ┌──────────┴──────────┐
             │                     │
       CENTRAL ADMIN          CENTRAL AUDIT
             │                     │
             └──────────┬──────────┘
                        │
                 MASTER DATABASE
                        │
      ┌─────────┬───────┼───────┬─────────┐
      ↓         ↓       ↓       ↓         ↓
   Illaka 01  Illaka 02 Illaka 03 Illaka 04 … 
      │
      ├── Members
      ├── Membership
      ├── Bank/Cash
      ├── Income
      ├── Expenses
      ├── Donations
      ├── Government Funds
      ├── Programs
      ├── Documents
      └── Reports
```

Each illaka is an **independent accounting unit / branch**:

- **Central:** central bank account, central income, central expenses, central programs, central assets/liabilities.
- **Illaka 01 / 02 / …:** own bank account, membership fees, donations, government grants, program income, expenses, assets/liabilities.

The system must **never mix Illaka 01's money with Illaka 02's money**. Central sees everything.

---

## 3. Illakas as the first-class dimension

Don't build around "10 illakas" — build for **N** illakas, structured as:

```
Organization
   ↓
Regions/Illakas
   ↓
Sub-groups
   ↓
Members
```

An admin clicks **+ Add New Illaka** and creates Illaka 11, 12, 13… Each new illaka automatically gets: unique illaka code, users, bank accounts, member database, accounting ledger, programs, reports, audit records.

**Every transaction carries an Illaka ID** so the central system can report at any level without duplicating data:

```
Transaction ID: TXN-2083-000154
Organization:   CENTRAL
Illaka:         IL03
Program:        PGM-0034
Account:        Membership Income
Amount:         2,000
Fiscal Year:    2083/84
```

Drill-down path: **Entire organization → Illaka → Program → Account → Transaction**.

---

## 4. Roles & permissions

| Role | Access |
|---|---|
| **Super Admin** | Entire system |
| **Central Treasurer** | All financial records and reports |
| **Central Auditor** | View / audit all branches |
| **Central Executive / Admin** | Organization-wide information |
| **Illaka Chairperson** | Their illaka's members, programs and reports |
| **Illaka Treasurer** | Their illaka's accounting |
| **Illaka Secretary** | Members, programs, correspondence |
| **Illaka Accountant** | Financial transactions |
| **Illaka Member Officer** | Membership records |
| **Viewer** | Read-only access |

**Critical rule:** illaka users can only create/edit information belonging to their own illaka; central users can view and audit all illakas.

---

## 5. Membership management

Configurable membership system:

```
Membership
│
├── Basic
├── Standard
├── Premium
├── Life Member
└── Other
```

Each membership type has: category, fee, member ID, name, address, phone, email, illaka/sub-group, date joined, renewal date, payment status, payment method, receipt number, membership status.

**Example:** a person joins **Illaka 03** and pays NPR 2,000.

```
Organization:   Central Organization
Illaka:         Illaka 03
Member:         XYZ
Membership:     Premium
Fee:            NPR 2,000
Income Account: Membership Fee
Bank/Cash:      Illaka 03
Receipt:        automatically generated
```

The money belongs to Illaka 03; Central can see and audit it.

---

## 6. Income / fundraising classification

Don't make everything a plain "donation." Classify income:

### Income
- **Membership** — Basic, Standard, Premium, Renewal
- **Donations** — Individual, Corporate, Community, Other
- **Government funding** — Ward office, Municipality/Metropolitan, Provincial, Federal
- **Programs** — Program contribution, Sponsorship, Ticket/registration, Other program income
- **Other** — Interest income, Miscellaneous income

This makes the annual report substantially more useful.

---

## 7. Government funding — special tracking

Example: Illaka 04 receives NPR 500,000 from Kathmandu Metropolitan City for a cultural/social welfare program.

```
Funding Source: Kathmandu Metropolitan City
Amount:         NPR 500,000
Illaka:         Illaka 04
Program:        Community Welfare Program 2083
Received Date:  …
Bank:           Illaka 04 Bank Account
Purpose:        Approved program expenditure
Status:         Received / Partially Used / Completed / Settled
```

**Central view — Government Funds Received:**

| Illaka | Source | Amount | Program | Spent | Remaining |
|---|---|---|---|---|---|
| Illaka 01 | Ward Office | 300,000 | Program A | 275,000 | 25,000 |
| Illaka 02 | Municipality | 500,000 | Program B | 430,000 | 70,000 |
| Illaka 04 | Metropolitan | 500,000 | Program C | 500,000 | 0 |

Extremely useful during auditing.

---

## 8. Programs & events as cost centers

Each program gets its own **Program Account / Cost Center** — not just an expense line.

**Example — Illaka 05, Program: Community Cultural Event 2083**

| Income | Amount | Expenses | Amount |
|---|---|---|---|
| Municipality grant | 300,000 | Venue | 80,000 |
| Individual donations | 100,000 | Food | 120,000 |
| Sponsorship | 50,000 | Transportation | 40,000 |
| | | Equipment | 30,000 |
| | | Printing | 15,000 |

```
Total income:       NPR 450,000
Total expenditure:  NPR 285,000
Balance:            NPR 165,000
```

Central can audit the entire program without interfering with the illaka's day-to-day operation.

---

## 9. Correspondence / approval module

Illakas operate independently, but **official letters must go through Central**.

**Workflow:**

```
Draft
  ↓
Submitted to Central
  ↓
Central Review
  ↓
Approved / Returned
  ↓
Official Letter Generated
  ↓
Sent
```

**Central approval dashboard:**

| Illaka | Request | Status |
|---|---|---|
| Illaka 01 | Funding Request | Pending |
| Illaka 03 | Ward Letter | Pending |
| Illaka 05 | Program Proposal | Approved |
| Illaka 07 | Municipality Letter | Pending |

Central controls official communication without controlling every normal activity of the sub-group.

---

## 10. Central audit dashboard

Select **Fiscal Year** (e.g. 2082/83) and see:

### Organization Summary
```
Total Illakas:        10  (+ Central C00)
Total Members:        3,842
Total Income:         NPR 8,450,000
Total Expenses:       NPR 6,720,000
Net Balance:          NPR 1,730,000
Membership Income:    NPR 2,100,000
Donations:            NPR 1,350,000
Government Grants:    NPR 4,200,000
Program Income:       NPR   800,000
```

Drill down: **Central (C00), Illaka 01 … Illaka 10** → click a unit → its complete accounts.

---

## 11. Audit trail

Every financial change records:

```
Who:        Illaka 03 Treasurer
Action:     Created expense
Amount:     NPR 25,000
Date:       2083-04-15
Description: Venue payment
Created:    10:42 AM
Approved by: Illaka Chairperson
Edited:     No
```

If someone changes NPR 25,000 → NPR 35,000, Central sees: original amount, changed to, changed by, date/time. **Financial records never simply disappear.** Posted entries are immutable; changes go through reversal + audit log.

---

## 12. Bank accounts

```
Central Organization
    └── Central Bank Account
Illaka 01
    └── Bank Account A
Illaka 02
    └── Bank Account B
Illaka 03
    ├── Bank Account C
    └── Cash Account
Illaka 04
    └── Bank Account D
```

Operations: deposit, withdrawal, transfer, cheque, cash, online payment, bank reconciliation (statement import later).

---

## 13. Double-entry accounting

Proper double-entry, not an income/expense-only app.

**Member pays NPR 2,000 into Illaka 03's bank:**
```
Dr. Illaka 03 Bank         2,000
    Cr. Membership Income         2,000
```

**Illaka 03 pays NPR 20,000 for venue:**
```
Dr. Program Expense        20,000
    Cr. Illaka 03 Bank             20,000
```

Enables: Trial Balance, General Ledger, Income & Expenditure Statement, Balance Sheet, Cash/Bank Book, Receivables, Payables, Fund balance, Program-wise accounts. Makes the annual audit substantially easier.

---

## 14. Central annual report

Generated at end of fiscal year:

1. Organization overview
2. Membership (illaka-wise counts + total)
3. Income
4. Expenditure
5. Government funding
6. Donations
7. Programs
8. Illaka-wise financial statements
9. Assets and liabilities
10. Audit information
11. Program / activity report

**Export:** PDF / Excel.

---

## 15. Fiscal year & dates (Nepal)

Support **Nepali fiscal years** (e.g. 2082/83) rather than hard-coded January–December, and both calendars:

```
15 Bhadra 2083  /  31 August 2026
```

---

## 16. Application structure (navigation)

```
ORGANIZATION
├── Dashboard
├── Members
├── Membership Fees
├── Income
├── Expenses
├── Donations
├── Government Funds
├── Programs & Events
├── Bank & Cash
├── Accounting
├── Official Letters
├── Approvals
├── Reports
├── Audit
├── Illakas / Sub-Groups
├── Users & Permissions
└── Organization Settings
```

---

## 17. Dashboards

### Illaka dashboard (e.g. Illaka 03 Treasurer)

```
ILLAKA 03
Members                   512
This Year Fees          425,000
Income                  850,000
Expenses                620,000
Bank Balance            230,000
Active Programs             3
Pending Approvals           2
```

Plus: Recent Transactions, Recent Members, Upcoming Programs.

### Central dashboard

```
CENTRAL ORGANIZATION
Illakas                 10 (+ Central)
Active Members           3,842
Total Income           8,450,000
Total Expenses         6,720,000
Combined Balance       1,730,000
Government Funding     4,200,000
Donations              1,350,000
Programs This Year          37
Pending Approvals            8
Pending Audits               3
```

Plus: **Illaka Performance** (Illaka 01 … Illaka 10).

---

## 18. Scoping rules — what belongs to whom

Every collection is either **illaka-scoped** (rows carry an enforced `illaka`), **central-only** (owned by the central organization), or **org-wide** (shared, never scoped):

| Collection | Scope | Rule |
|---|---|---|
| `tenants` (the illaka dimension) | org-wide | Already exists, labeled "Ilaka". Central is a special tenant with code `C00` so every transaction uniformly carries an illaka. |
| `users` | org-wide | Scope comes from the plugin's existing `tenants` array (0 tenants ⇒ central; 1 tenant ⇒ that illaka; N ⇒ central, multi-scope); the org `role` enum gates what they can do within it. |
| `members`, `parties` | illaka-scoped | A member/donor/vendor belongs to exactly one illaka (or Central). |
| `accountGroups` | org-wide | Shared COA taxonomy/template (§19); its existing `tenant` field is **dropped** (§23.1) — groups are never scoped. |
| `membershipTypes` | org-wide | Categories + fees defined centrally, applied org-wide. |
| `accounts` | illaka-scoped | Each illaka has its own chart of accounts (see §19); Central-as-illaka has Central's. |
| `documents` | illaka-scoped | Every voucher/receipt/invoice belongs to one illaka. |
| `journalEntries` | illaka-scoped | The posting carries the illaka; its lines may only reference accounts of the same illaka. |
| `programs`, `governmentFunds` | illaka-scoped | Programs and grants belong to one illaka (or Central). |
| `items`, `stockMovements` | illaka-scoped | Only if physical stock is tracked; scoped like everything else. |
| `approvals`, `letters` | illaka-sourced, central-routed | Illaka creates; Central reviews/approves; routing is org-wide. |
| `auditLogs` | org-wide | Immutable, never scoped — Central's audit view covers all illakas. |

**Cross-illaka money movement creates two postings, linked by a `transferRef`.** Example — Central grants NPR 50,000 to Illaka 02:

```
Central books:      Dr. Grant Disbursed            50,000
                        Cr. Central Bank                   50,000

Illaka 02 books:    Dr. Illaka 02 Bank             50,000
                        Cr. Central Grant Received         50,000
```

The transfer endpoint writes both entries **atomically in one transaction**, each scoped to its own illaka, so both sides stay consistent and the audit trail shows the full journey. **Voiding a transfer reverses *both* legs atomically** (§20 enforcement rule 4) — a one-sided void would unbalance one illaka's books.

---

## 19. Chart of accounts (COA) model

**Recommendation: one org-defined COA template, seeded per illaka, then independently extensible.**

- The central organization maintains a **standard COA template** (NGO-style: Cash & Bank assets, Receivables, Fund balance, Membership Fees, Donations, Government Grants, Program Income, Program & Operating Expenses, etc.).
- Creating a new illaka **clones the template** into that illaka's own chart (a seeding hook on `tenants` create).
- Illakas can then add their own accounts (e.g. "Illaka 03 Special Program Fund") without touching other illakas' charts.
- **Account identity:** `code` is unique *within* an illaka; the full key is `(illaka, code)`. Displayed as `03-4100` (Illaka 03 · Membership Fee). Central's accounts live under `C00`.
- **Consolidation is a union, not a merge:** since every account belongs to exactly one illaka, the consolidated trial balance = Central's trial balance + each illaka's trial balance, summed. No double counting, no shared-account ambiguity.
- **Programs are a dimension, not accounts:** a `program` field on journal lines (and documents) gives program P&L as a filter over the ledger — programs don't create their own accounts in the COA. This keeps the chart clean while program income/expense still map to standard income/expense accounts.

---

## 20. Scoped schema design (Payload collections)

The target schema **extends the existing collections** — no new parallel "illaka" or "member" tables (see §22). The illaka field keeps its **wire name `tenant`** (already used by `apps/billing/src/lib/api.ts` and the offline engine); "illaka" is the display/product term.

**`tenants`** (extend the existing collection — already labeled "Ilaka")
```
code      text   // unique, e.g. IL01 … IL10; C00 = Central   (new)
name      text   // exists
type      select // central | illaka                        (new)
active    checkbox                                          (new)
// existing fields (slug, domain, description, coverImage, …) stay
```

**`users`** (extend — keep the plugin's `tenants` array, no new field)
```
role      select // super-admin | central-treasurer | central-auditor | central-exec |
                 // illaka-chair | illaka-treasurer | illaka-secretary | illaka-accountant |
                 // illaka-member-officer | viewer
// existing plugin `tenants` array is the scope source:
//   0 tenants ⇒ central scope · 1 tenant ⇒ that illaka · N ⇒ central (multi-scope)
```

**`accounts`** (extend)
```
code      text                       // unique within tenant (illaka)
name, group, type, class             // as today
tenant    relation → tenants, required   // wire name stays `tenant`
openingBalance
```

**`documents`** (extend)
```
tenant    relation → tenants, required
program   relation → programs, optional
// docType, lines[], totals, status, journalEntry … as today
```

**`journalEntries`** (extend)
```
tenant      relation → tenants, required
transferRef relation → journalEntries, optional   // cross-illaka pair
// narration, lines[] (account, debit, credit), status …
// validation: all line accounts share entry.tenant; Σdr = Σcr
```

**New org collections**
```
membershipTypes  name, fee, periodMonths                       // org-wide
governmentFunds  tenant (req), source, amount, program, receivedAt, bank, purpose, status
programs         tenant (req), name, fiscalYear, budget, status
approvals        tenant (req), type, payload, status, decidedBy, decidedAt   // draft→submitted→approved/returned
letters          approval (req), number, generatedAt, sentAt
```

**`Members`** (extend the existing collection — already tenant-aware, has Google-sheet sync)
```
// existing fields stay (name, contact, tenant, …)
membershipType  relation → membershipTypes
joinedAt, renewalAt, status, lastReceipt
```

**`auditLogs`** (new — org-wide, immutable)
```
user, action, entityType, entityId, before, after, at
```

**Enforcement (the non-negotiable part):**
1. **Hooks on every scoped collection** (`beforeOperation`): an illaka user can only create/read/update rows where `tenant === user's illaka`; central roles read all; super-admin everything.
2. **Posting validation:** journal lines may only reference accounts of the entry's own tenant.
3. **`POST /api/transfers`:** creates both legs atomically with `transferRef` — never two manual entries.
4. **`POST /api/transfers/:id/void`:** reverses **both legs** atomically (one reversal entry per side, both carrying the `transferRef`) — a one-sided void would unbalance the books.
5. **Report endpoints:** illaka roles are forced to their own `tenant` filter (server-side, not just UI); central roles can pass any illaka or request consolidated mode.
6. **Audit hooks** write `auditLogs` on every create/update/delete across scoped collections.
7. **Numbering sequences** key by `(tenant, docType, fiscalYear)` so each illaka's receipts/vouchers run 1, 2, 3… independently — receipts are legal documents.

---

## 21. UI design — illaka across the SPA

The billing SPA shell stays as-is (collapsible grouped sidebar, SyncBanner, header with sync pill + Guide + Sign out). Illaka surfaces through **one header control, one badge, and scoped data everywhere** — with a simple rule to avoid chrome noise:

> **Rule of thumb:** illaka UI only appears when it matters — a single-illaka user sees **no switcher at all**; the `C00` badge and illaka column only appear in **All (consolidated) mode**.

### 21.1 Header — IllakaSwitcher

A new `IllakaSwitcher` component sits in the header, immediately left of the sync pill:

- **Central roles** (empty `tenants` array — central scope): a dropdown — `All Illakas (consolidated)` · `Central (C00)` · divider · `Illaka 01 — Name` … `Illaka 10 — Name`. Selection persists in `localStorage` (`billing.tenant`) and drives a React context (`TenantProvider`).
- **Illaka-scoped roles** (e.g. Illaka 03 Treasurer): a **static locked chip** — `IL03 · Kathmandu` with a lock icon. No dropdown; the server enforces scope anyway, the UI just communicates it.
- **Viewer**: read-only dropdown (same options, disabled).
- **Default** for central roles: `Central (C00)` — keeps the current single-book feel for existing data.

### 21.2 The C00 badge

A small monospace chip `C00` (neutral gray, tooltip "Central Organization") marks **central-owned** rows: central bank account, central documents, central programs, central parties. It appears in lists only in **All mode**, next to the name. In single-illaka mode it is hidden — the scope is already implied. Illakas get a stable **accent dot** (hue derived from the illaka code) used in the switcher, list rows, and report chart series.

### 21.3 Scoped dropdowns (forms)

Every picker (account, party, program, bank) filters to the current scope:

- **Single illaka** → only that illaka's records, plain list (no prefixes).
- **All mode** → options grouped by illaka with code prefixes (`03 · 4100 Membership Fee`), and **entry forms are disabled**: consolidated mode is for viewing/auditing, not for creating documents (a document belongs to exactly one illaka). *Carve-out:* Settings is an admin action, not a document entry form — central roles may edit the org COA template and run "seed illaka charts" in All mode (§21.4).
- **Empty state** in pickers: "No accounts in Illaka 03 yet — add one in Settings".

Client-side filtering mirrors the server hook (fail-fast before the request), but the server remains the source of truth.

### 21.4 Screen-by-screen

| Screen | Single-illaka scope | All (consolidated) mode |
|---|---|---|
| **Dashboard** | KPI cards recompute for the scope; banner `Illaka 03 — Kathmandu` | KPI cards for the whole org + an **Illaka Performance** table (code, members, income, expense, balance) — rows are clickable and switch the scope |
| **Vouchers / Journal / Daybooks** | List filtered by scope; no illaka column | **Illaka column** (code + name, sortable, first column); totals consolidate |
| **Accounts / Parties / Items** | Scoped lists; COA editor operates on the current illaka's chart | Read-only; illaka column + grouped views |
| **Trial Balance / Aging / Reports** | Report filters pinned to scope | **Scope selector in the report toolbar**; grouping by illaka; consolidated totals |
| **Settings** | Chart-of-accounts manager for the current illaka | Central-only: org **COA template editor** + "seed illaka charts" action (runs the cloning hook) |
| **Approvals / Letters** (future) | Own illaka's requests | Inbox of all illakas, each row badged with its illaka |

**Print/PDF** (existing export flow): the report footer line becomes `Scope: Illaka 03 — Kathmandu · FY 2082/83` so every printed/exported document is labeled (mirrors the existing PDF meta block).

### 21.5 Sync & offline interplay

- **Cache and outbox keys gain a scope dimension** — `cursor:${tenant}:${collection}`, `pulled:${tenant}:${collection}`, `idmap:${tenant}` — so an illaka user's device never serves another illaka's cached rows, even if the same browser/device previously signed in as central. This is a **security requirement**, not a nicety.
- Flush sends each queued write's own tenant; the server hook re-validates it against the caller's scope.
- Scope is otherwise **local state** — switching scope re-pulls only that scope's collections (bounded by the scoped cursors), not the whole cache.
- The sync pill behaves identically; the switcher just changes what the cache serves.

---

## 22. Technical mapping to the existing codebase

The billing module (`apps/billing` + Payload collections) already provides the accounting core. This plan **reuses** it and adds the organization layer:

| Existing | New requirement | Work |
|---|---|---|
| `tenants` collection (already labeled "Ilaka", target of all `tenant` relations) | Illaka dimension with codes + Central | **Reuse** it — add `code`, `type`, `active`; create the `C00` row; no new collection |
| `Members` collection (tenant-aware, Google-sheet sync) | Membership module | **Reuse** it — add `membershipType`, `joinedAt`, `renewalAt`, `status`, `lastReceipt`; no new collection |
| Multi-tenant plugin's `tenants` array on users | Illaka-scoped roles | **Reuse** the array as the scope source; add the org `role` enum; no new user field |
| Optional `tenant` field on the 7 billing collections | **Enforced scoping** | Promote to required; wire name stays `tenant` (display as "illaka") |
| `admin` / `super-admin` roles | 10 granular roles with illaka scope | Extend better-auth role model + permission checks |
| `accounts`, `documents`, `journalEntries` | Per-illaka books, central parent org | Scope queries by tenant; central sees all |
| Posting engine + trial balance/ledger/reports | Illaka-wise + consolidated reports | Add `tenant` filter to report endpoints |
| `accountGroups.tenant` field | Groups stay org-wide | **Drop** the field (§23.1) — groups are the shared taxonomy |
| — | Membership module | New collections: `members`, `membershipTypes`, receipts → journal |
| — | Government funds tracking | New collection: `governmentFunds` (source, amount, program, status) |
| — | Programs as cost centers | New collection: `programs` with program P&L |
| — | Approvals / official letters | New collections: `approvals`, `letters` with status workflow |
| — | Audit trail | `auditLogs` collection + beforeChange hooks; immutable posted entries |
| — | BS dates / fiscal year | Nepali date library; fiscal-year field on transactions |

---

## 23. Data migration plan — single-book → C00

Existing rows have no `illaka`. The migration backfills them to **`C00` (Central)**, then enforcement hooks are switched on only after the data is verified clean.

### 23.1 Decisions up front

| Item | Decision | Why |
|---|---|---|
| Where does existing data go? | **All existing rows → `C00`** | It's the org's current books; Central is the natural owner |
| `accountGroups` | **Stay org-wide** (shared COA taxonomy/template) — and **drop its `tenant` field** | Groups are the template; `accounts` carry the illaka (§19); the field is unused today |
| Existing users | Keep no `illaka` (central scope), keep current `admin`/`super-admin` roles | Least surprise; they already see everything |
| Timing | Migration **before** `beforeOperation` hooks are enabled | Hooks would block the backfill itself |

### 23.2 Steps (one idempotent script, dry-run first)

1. **Pre-flight:** stop writes (or run in maintenance window); take a full DB dump (`pg_dump`).
2. **Create the `C00` tenant** row in `tenants` (code `C00`, name `Central Organization`, type `central`).
3. **Backfill** each scoped collection — `accounts`, `parties`, `items`, `documents`, `journalEntries`, `stockMovements` (and `programs`/`governmentFunds` if already present) — setting `tenant = C00` where null. Idempotent: skip rows that already have a tenant.
4. **Users:** leave `illaka` null (central scope); map roles `admin`→`central-exec`, `super-admin`→`super-admin` if the role enum changes.
5. **Offline clients (desktop):** bump the local DB schema version; on first launch, default the scope to the **signing-in user's scope** (C00 for central users, their own illaka for illaka users) and backfill cached rows / outbox entries to that scope. Cache/outbox keys gain the scope dimension (`cursor:${tenant}:${collection}`, `idmap:${tenant}`) so a device shared between central and illaka users never leaks rows. Outbox entries already carry bodies, so queued writes inherit the user's scope.
6. **Enable enforcement** — deploy `beforeOperation` scoping hooks, `POST /api/transfers`, and report `illaka` filters **after** the backfill lands.

### 23.3 Verification (exit criteria for the migration)

- **Numbers unchanged:** trial balance, ledger, and report totals computed for `illaka = C00` exactly match the pre-migration single-book figures (diff the JSON output before/after).
- **No orphans:** every `documents.journalEntry` points at a `journalEntries` row with the same illaka; no journal line references an account of a different illaka.
- **Counts match:** per-collection row counts pre- vs post-backfill (minus none).
- **Numbering restarts cleanly:** receipt/voucher sequences keyed by `(tenant, docType, fiscalYear)` start at 1 for each new illaka without collisions.
- **Hooks bite:** after enforcement, an illaka-scoped user creating a document gets `tenant` forced to their own, and cross-illaka access returns 403.
- **Offline clients** sync cleanly after the local schema bump (no duplicate pushes).

### 23.4 Rollback

- Before enforcement is enabled, rollback = restore the dump.
- After enforcement, rollback = disable hooks (data stays correct; scoping just stops being enforced) — a safer unwind than undoing the backfill.

---

## 24. Roadmap

| Phase | Scope | Exit criteria |
|---|---|---|
| **P1** | **Illaka foundation** (per §20 schema): extend `tenants` with `code`/`type`/`active` + create `C00` · org `role` enum on users (scope from the plugin's `tenants` array) · promote the existing `tenant` field to required on `accounts`/`documents`/`journalEntries` (wire name stays `tenant`) · **COA seeding hook** (clone org template on tenant create) · **`beforeOperation` scoping hooks** on every scoped collection · `POST /api/transfers` + `…/:id/void` (atomic cross-illaka, `transferRef`) · report endpoints with server-side `tenant` filter + consolidated mode · per-`(tenant, docType, fiscalYear)` numbering · data migration of existing single-book rows to `C00` · scope-partitioned offline cache keys | Illaka users see only their illaka; central sees all; cross-illaka transfers post and void on both books atomically |
| **P2** | Membership module: types, members, fee receipts → journal entries | Join → receipt → cash book entry, per illaka |
| **P3** | Income classification + government funds + programs as cost centers | Program P&L; government-funds register |
| **P4** | Approvals & official letters workflow | Draft → central approve → letter generated |
| **P5** | Audit trail + central audit dashboard | Every change logged; drill-down per illaka |
| **P6** | Annual report generator (PDF/Excel) + BS fiscal-year calendar | Full report set exported |
| **P7** | Offline/desktop reuse (existing billing engine) per illaka | Desktop works offline per illaka and syncs |

The existing M1–M6 billing milestones stay valid — they build the engine this plan sits on top of.

---

## 25. Decisions & risks

| Decision | Choice | Why |
|---|---|---|
| Single- vs multi-branch | Multi-branch, illaka-scoped | Mirrors the real org structure; money never mixes |
| Double-entry core | Reuse existing engine | Already built and tested |
| Illaka dimension | First-class, enforced — **reusing the existing `tenants` collection** | Prevents cross-illaka corruption by construction; no parallel tables |
| Members | **Extend the existing `Members` collection** | Already tenant-aware with Google-sheet sync |
| User→illaka binding | **Reuse the plugin's `tenants` array** + new org `role` enum | No second, parallel mechanism |
| Wire name | **`tenant`** on the wire, "illaka" in the UI | Avoids breaking the existing API/offline engine |
| Central data entry | None — illakas self-enter, central audits | Keeps central workload low, roles clear |
| Fiscal year | Nepali BS fiscal year | Correct reporting for the org |
| Scope of v1 | P1–P3 first | Deliver usable value before approvals/audit polish |

**Risks (highest first):**
1. **Illaka-scoping bugs** — a leak lets one illaka see/edit another's money; test every collection + endpoint with tenant filters.
2. **Offline cache scope leaks** — a shared device could serve another illaka's cached rows; scope-partitioned cache keys are mandatory, not optional (§21.5).
3. **Role granularity** — 10 roles is a lot; start with Super Admin / Central roles / Illaka roles and add sub-roles as needed.
4. **Scope creep** — the full plan is years of work; P1–P3 alone deliver the core value.
5. **Data migration** — existing single-book data must be assigned to C00 when scoping is enforced; the `tenant` wire name must be preserved end-to-end.

---

*Prepared from the organization's centralized multi-illaka accounting requirements. Supersedes the single-book scope in `docs/billing/PLAN.md`; the billing engine is retained as the accounting core.*
