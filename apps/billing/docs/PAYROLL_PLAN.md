# Payroll System — Plan & Spec

> Status: Proposed plan — ready for review.
> Last updated: September 2026.

## Goal

Add a **Nepal-compliant payroll module** to the billing app:

1. **Employees** — staff master (distinct from community `members`).
2. **Salary structures** — per-employee pay components (basic, allowances) and deductions.
3. **Payroll runs** — a monthly (BS-month) process that computes gross, statutory
   deductions (SSF, PIT, CIT), and net pay for every active employee.
4. **Posting integration** — one aggregated journal voucher per run through the
   existing posting engine (no silent wrong postings; missing default accounts
   block the run, same as other voucher types).
5. **Payslips & reports** — printable payslips (existing PDF lib), payroll
   register, PIT return, SSF return — ready for filing.

The module is **tenant-scoped** (each illaka runs its own payroll), respects
fiscal years / BS calendar, and follows the app's offline-first rules.

---

## 1. Domain Concepts (Nepal)

| Concept | Meaning | Handled in |
|---|---|---|
| **Pay period** | One BS month (e.g. Bhadra 2083). | `payroll-runs.period` (BS `YYYY-MM`) + fiscal year |
| **SSF** | Social Security Fund — employee 11% + employer 20% of (basic + dearness allowance), under Social Security Act 2074. Rates come from settings (change per Finance Act). | Run calculation |
| **PIT** | Pay-As-You-Earn income tax — progressive slabs (per Finance Act, configurable per fiscal year). Base = gross − employee SSF − CIT. | Run calculation |
| **CIT** | Citizen Investment Trust — fixed monthly amount (e.g. Rs 1,000), optional per employee. | Run calculation |
| **Festival / bonus** | One-month basic festival allowance is tax-exempt under current rules. | Phase 2 (v1 = manual line) |
| **Payslip** | Per-employee earnings/deductions/net breakdown for one run. | `payroll-run-lines` + PDF |

### Salary component model (v1)

| Component | Type | Example |
|---|---|---|
| Basic pay | earnings | 25,000 |
| Dearness allowance | earnings (SSF base) | 3,000 |
| House rent / transport / medical | earnings (not SSF base) | 5,000 |
| Other earnings (overtime, bonus) | earnings, added per run | — |
| Employee SSF | deduction (11% of basic+DA) | 3,080 |
| Employer SSF | employer cost (20% of basic+DA) | 5,600 |
| PIT | deduction (slabs) | 1,250 |
| CIT | deduction (fixed) | 1,000 |
| Other deductions (loan, advance) | deduction, per run | — |

**Calculation order per employee:**

```
gross        = basic + allowances + other earnings
ssfBase      = basic + dearness
empSSF       = round(ssfBase × ssfEmployeeRate)
cit          = employee CIT amount (0 if none)
pitBase      = gross − empSSF − cit
pit          = slabTax(pitBase)        // progressive slabs from settings
otherDed     = per-run deductions
net          = gross − empSSF − cit − pit − otherDed
employerSSF  = round(ssfBase × ssfEmployerRate)
```

---

## 2. Data Model (new Payload collections)

### `employees`

| Field | Type | Notes |
|---|---|---|
| `fullName` | text, required | |
| `employeeCode` | text, indexed | e.g. `EMP-001` (tenant-scoped) |
| `email` / `phone` | email / text | |
| `pan` | text | Employee PAN for PIT records |
| `ssfId` | text | SSF member number |
| `citId` | text | CIT account number |
| `department` | text | optional grouping |
| `designation` | text | |
| `joinedDate` / `exitDate` | date | exitDate → excluded from runs |
| `status` | select | `active` \| `inactive` \| `exited` |
| `bankName` / `bankAccount` | text | net-pay disbursement |
| `salaryStructure` | relationship → `salary-structures` | |
| `tenant` | relationship | auto-assigned (`assignTenant`) |
| `user` | relationship → `users` | optional login link |

### `salary-structures`

| Field | Type | Notes |
|---|---|---|
| `name` | text, required | "Default", "Manager", … |
| `basic` | number | |
| `dearnessAllowance` | number | SSF base |
| `houseRent` / `transport` / `medical` | number | non-SSF earnings |
| `citAmount` | number | default 0 |
| `ssfEnabled` | checkbox | default true (PF fallback = Phase 3) |
| `tenant` | relationship | |

### `payroll-runs`

| Field | Type | Notes |
|---|---|---|
| `period` | text, required | BS `YYYY-MM` (e.g. `2083-05`) |
| `fiscalYear` | relationship → `fiscal-years` | derived from period |
| `status` | select | `draft` → `posted` → `voided` |
| `runDate` | date | posting date (BS) |
| `narration` | text | auto: "Payroll — Bhadra 2083" |
| `grossTotal` / `deductionTotal` / `netTotal` / `employerTotal` | number | computed totals |
| `journalEntry` | relationship → `journal-entries` | posted voucher |
| `tenant` | relationship | |

### `payroll-run-lines` (array on `payroll-runs`)

| Field | Type | Notes |
|---|---|---|
| `employee` | relationship → `employees` | |
| `workedDays` / `daysInMonth` | number | v1: manual; Phase 3: attendance |
| `basic` … `net` | number | full computed breakdown (mirror of §1) |
| `earningsJson` / `deductionsJson` | json | flexible per-run additions |

### `salary-settings` (new global)

| Field | Notes |
|---|---|
| `ssfEmployeeRate` / `ssfEmployerRate` | default 0.11 / 0.20 |
| `pitSlabs` | json: `[{from, to, rate}]` per fiscal year |
| `citDefault` | default monthly CIT amount |
| `festivalExemptionEnabled` | Phase 2 |
| `payrollAccounts` | see §3 (moved here so one place) |

---

## 3. Accounting Integration

### New default accounts (billing-settings)

| Field | Role |
|---|---|
| `salaryExpenseAccount` | **Dr** gross + employer SSF |
| `payrollPayableAccount` (bank/cash reused) | **Cr** net pay |
| `pitPayableAccount` | **Cr** PIT |
| `ssfPayableAccount` | **Cr** employee + employer SSF |
| `citPayableAccount` | **Cr** CIT |

Mirror of existing pattern: each field is a `relationship → gl-accounts` in the
"Default accounts" collapsible of `src/globals/BillingSettings.ts`; the posting
engine refuses to post a run when one is missing (clear message, no silent
wrong postings).

### Posting rule (one aggregated `journal-voucher` per run)

```
Dr Salary Expense            grossTotal + employerTotal
   Cr Bank/Cash              netTotal
   Cr PIT Payable            pitTotal
   Cr SSF Payable            empSsfTotal + employerSsfTotal
   Cr CIT Payable            citTotal
```

Implemented as a server endpoint `POST /payroll-runs/:id/post` that:
1. Validates every line balances (sum check, per-employee net ≥ 0).
2. Creates the `journal-voucher` document via the existing `postDocument()`
   engine (voucher number `JV-2083-84-…`, fiscal-year respected).
3. Marks the run `posted`; stores `journalEntry` id.

Voiding a run = voiding its journal voucher (existing void endpoint) + run
status → `voided`.

### Payslips

Not posted — pure reporting. Rendered from `payroll-run-lines` + employee
master, printable via the existing `exportReportPdf` / print path.

---

## 4. UI Design

### Nav

New sidebar group **Payroll** (between Masters and Inventory):

| Item | Route | Page |
|---|---|---|
| Employees | `/employees` | master list + CRUD (mirrors `Parties.tsx`) |
| Payroll Run | `/payroll/run` | build + post a run |
| Payslips | `/payroll/payslips` | browse by run/employee, print |
| Payroll Reports | `/payroll/reports` | register, PIT, SSF |

### Payroll Run page (the core screen)

1. **Header**: period picker (BS month, defaults to current FY month),
   fiscal-year badge, status pill (`Draft` / `Posted` / `Voided`).
2. **Draft mode**
   - "Add employees" picker → rows appear with live computed columns
     (gross, emp SSF, PIT, CIT, net) using §1 order.
   - Inline edit: worked days, other earnings, other deductions, CIT override.
   - Totals footer: gross / deductions / net / employer SSF.
   - **Save draft** (offline-first, outbox) / **Save & post** (queues create +
     custom `/post` op — same shape as voucher Save & post).
3. **Posted mode**: read-only; **Print payslips** (all or one employee), view
   linked journal voucher (number clickable → Journal, like Daybook), **Void**
   with reason.
4. Validation errors surface inline: "PIT slab missing for FY 2083-84",
   "Salary Expense account not set in Settings → Default Accounts".

### Reports (reuse `vatShared`-style patterns)

| Report | Content |
|---|---|
| **Payroll Register** | per run: employee, PAN, gross, each deduction, net |
| **PIT Return** | monthly/annual: taxable base per employee, tax, PAN |
| **SSF Return** | employee SSF + employer SSF per employee, SSF IDs |
| **Payslip** | one employee × one run, printable |

CSV / PDF / Print on all (existing `downloadCsv`, `exportReportPdf`).

---

## 5. Implementation Steps

### Step 1 — Backend collections (Payload)

- `src/collections/Employees/index.ts`, `SalaryStructures/index.ts`,
  `PayrollRuns/index.ts` (+ migration files, mirroring
  `src/migrations/20260826_expense_claims.ts`).
- Tenant scoping via existing `scopedCreate/Read/Update/Delete` +
  `assignTenant`; access: admin + illaka payroll roles.
- `src/globals/SalarySettings.ts` (PIT slabs, SSF rates, payroll accounts).

### Step 2 — Run posting endpoint

- `POST /payroll-runs/:id/post` in `PayrollRuns/index.ts` — compute-validate →
  `postDocument()` journal-voucher → mark posted (see §3).
- Slab/tax helpers in `src/collections/PayrollRuns/pit.ts` (pure functions,
  unit-testable).

### Step 3 — Sync allowlist + offline

- Add `employees`, `salary-structures`, `payroll-runs` (+ lines) to
  `ALLOWED_COLLECTIONS` + `changeCollections` in `src/app/api/sync/route.ts`.
- Draft runs: cache-first reads, outbox writes (same as documents).
- `post` action: queued custom op with `_action: 'post'` (same as voucher
  post — verified by e2e S8/S9 patterns). `salary-settings` global stays
  localStorage-cached like billing-settings.

### Step 4 — SPA pages

- `apps/billing/src/pages/Employees.tsx`, `SalaryStructures.tsx` (mirror
  `Parties.tsx` CRUD, offline-first).
- `apps/billing/src/pages/PayrollRun.tsx` (§4 core screen).
- `apps/billing/src/pages/PayrollReports.tsx` + shared
  `payrollShared.ts` (computation + row builder — pure, tested).
- Wire nav (`App.tsx` navGroups), routes, `features` gating (bank-reconciliation
  pattern).

### Step 5 — Reports + print

- Register / PIT / SSF tables (reuse report scaffolding: `DataStatus`,
  `ReportSkeleton`, totals footer).
- Payslip PDF via `apps/billing/src/lib/pdf.ts`.

### Step 6 — E2E (extend the journey)

- New `08-payroll`-style project after 07-offline:
  - S-P1: create employee + salary structure (offline-first CRUD).
  - S-P2: draft run → assert computed net matches the dataset's expected
    figures (dataset.json gains a payroll fixture).
  - S-P3: Save & post → assert journal voucher posted, PIT/SSF/net legs
    reconcile to the run totals, payslip prints.
  - S-P4: repeat-run idempotence (second run same period blocked or warned).

---

## 6. Files to Create / Modify

| File | Action |
|---|---|
| `src/collections/Employees/index.ts` | **NEW** |
| `src/collections/SalaryStructures/index.ts` | **NEW** |
| `src/collections/PayrollRuns/index.ts` | **NEW** (incl. `/post`, `/void`) |
| `src/collections/PayrollRuns/pit.ts` | **NEW** (PIT slab calc, pure) |
| `src/globals/SalarySettings.ts` | **NEW** |
| `src/globals/BillingSettings.ts` | add 5 payroll default-account fields |
| `src/migrations/20xxxxxx_payroll.ts` | **NEW** (tables) |
| `src/app/api/sync/route.ts` | add 3 collections to allowlist |
| `src/payload.config.ts` | register collections + global |
| `apps/billing/src/pages/Employees.tsx` | **NEW** |
| `apps/billing/src/pages/SalaryStructures.tsx` | **NEW** |
| `apps/billing/src/pages/PayrollRun.tsx` | **NEW** |
| `apps/billing/src/pages/PayrollReports.tsx` | **NEW** |
| `apps/billing/src/lib/payrollShared.ts` | **NEW** (calc + row builder) |
| `apps/billing/src/App.tsx` | nav group + routes |
| `apps/billing/src/lib/types.ts` | types |
| `apps/billing/e2e/dataset.json` | payroll fixture |
| `apps/billing/e2e/specs/…payroll…` | **NEW** project |

---

## 7. Offline & Sync Summary

| Collection | Push | Pull | Notes |
|---|---|---|---|
| `employees` | ✅ | ✅ | like parties |
| `salary-structures` | ✅ | ✅ | |
| `payroll-runs` (+lines) | ✅ | ✅ | draft-safe; **post is a custom op** |
| `salary-settings` (global) | — | localStorage | like billing-settings |

Computed endpoints stay server-side (run posting is atomic — never queued as a
raw CRUD; the custom post op is the unit of sync, same as voucher `/post`).

---

## 8. Out of Scope (for now)

- **Attendance/leave module** — v1 uses manual worked-days on the run; Phase 3
  can import attendance.
- **Festival allowance auto-tax-exemption** — Phase 2 (slab config lands in v1).
- **PF instead of SSF**, gratuity, loans ledger — Phase 3.
- **Bank file export** (salary disbursement) — Phase 3.
- **IRD e-filing upload** — same as VAT registers (report-only today).
- **Employee self-service portal** — payslips delivered by admins.

---

## 9. Decisions to Confirm

1. **Employees vs Members** — plan assumes a **new `employees` collection**
   (staff ≠ community members who pay membership fees). If the org only has
   ~handful of paid staff and you'd rather reuse `members` with a
   `isEmployee` flag, say so — the calc engine is unaffected, only the master.
2. **SSF vs PF** — v1 assumes **SSF** (employee 11% / employer 20%). If your
   org is on Provident Fund, the deduction set changes (PF 10%+10%, no
   employer-expense leg… same shape, different rates) — one settings toggle.
3. **Pay period** — v1 is **monthly BS** runs. If fortnightly/weekly needed,
   the period field generalizes but reports assume monthly.
4. **Posting granularity** — plan posts **one aggregated voucher per run**
   (manager.io style). Per-employee vouchers are possible but noisy.