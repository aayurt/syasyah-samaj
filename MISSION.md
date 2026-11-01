# MISSION — Full-Cycle Excel Import/Export + Complete Component Test Coverage

> **Status:** Draft for execution
> **Scope:** `apps/billing` (Billing SPA) + shared import/export layer
> **Governing docs:** [ADR-0004](docs/adr/0004-excel-import-export-dedup.md), [TEST_PLAN.md](apps/billing/docs/TEST_PLAN.md), tdd-workflow skill (tests first, ≥80% coverage)

---

## 1. Mission Statement

Give every accounting entity in the Billing SPA **Excel export AND Excel import**, plus **one master workbook** — a single `.xlsx` containing all data in separate, cross-linked sheets — that round-trips (export → edit → import) without data loss. In parallel, put **every page and component of the accounting app under automated tests** with ≥80% coverage (≥90% for `src/lib`, 100% for the import/export path).

### Objectives

| ID | Objective | Acceptance criterion (measurable) |
|----|-----------|-----------------------------------|
| **OBJ-1** | Test every component & page | Vitest suite runs green in `apps/billing`; coverage ≥80% lines/functions/branches/statements globally, ≥90% for `src/lib/**`; every page (40) and component (33) has ≥1 test file; existing 12 Playwright specs still pass + 1 new import/export E2E spec |
| **OBJ-2** | Per-entity Excel import **and** export | Every entity in the registry (16 entities, §4.2) has: an Excel export button, an Excel import path (parse → validate → dedup → preview → execute), and a downloadable blank template with example row |
| **OBJ-3** | Single master workbook, linked, round-trippable | One `.xlsx` with one sheet per entity + `_Index` + `_Manifest`; sheets linked via FK business keys, VLOOKUP display columns, SUMIF cross-sheet totals, and data-validation dropdowns; importing it into an empty tenant reproduces all data (0 diffs) and Trial Balance stays balanced |

**TDD rule (from skill):** for every milestone M1–M6, write the failing tests first, then implement.

---

## 2. Current-State Audit (verified on this branch)

### What exists ✅

- `apps/billing/src/lib/importExport.ts` (~1,000 lines): `fetchAllDocs`, `buildExportCsv/Json/Excel`, `parseCsvText`, `parseExcelFile`, `parseImportFile`, `classifyRecords` (3-tier dedup), `validateImportRows`, `executeImport`, `EXPORT_COLUMNS`, header normalization (EN + Nepali).
- Specialized builders **written but never wired to any UI**: `buildCoaExcel`, `parseCoaExcel`, `buildJournalExcel` (2-sheet Headers+Lines), `parseJournalExcel`, `buildOpeningBalancesExcel`, `parseOpeningBalancesExcel`.
- Import UI: [ImportPreviewModal.tsx](apps/billing/src/components/ImportPreviewModal.tsx) (5-step: file → mapping → conflict rules → validation preview → execute), opened from [DataManagement.tsx](apps/billing/src/pages/DataManagement.tsx).
- Export UI: [ExportModal.tsx](apps/billing/src/components/ExportModal.tsx) (CSV/JSON only — **no Excel option**, and reachable **only from Dashboard**) + inline JSON/Excel buttons in DataManagement for 5 slugs + `ImportPreviewModal` opened from only 6 pages (Accounts, DataManagement, Items, Dashboard, Members, Parties).
- E2E: 12 Playwright specs (`apps/billing/e2e/specs/00–10, 90`), ~36 tests.
- Root Jest config works: `npx jest` → `src/utilities/syncSheets.test.ts` passes (6 tests).

### What is broken or missing ❌ (evidence)

| # | Finding | Evidence |
|---|---------|----------|
| F1 | **The only unit test fails to run**: imports `vitest`, which is not installed anywhere | `npx jest` → `Test Suites: 1 failed… Cannot find module 'vitest'` |
| F2 | **No test runner for the SPA**: `apps/billing/package.json` has no `test` script; README documents `pnpm test / test:watch / test:ui` that don't exist | `apps/billing/package.json` scripts: only `dev/build/preview/test:e2e` |
| F3 | **Zero component/page tests**: no `*.test.tsx` anywhere in `apps/billing/src` | `find apps/billing/src -name "*.test.*"` → empty; `tests/{unit,integration,fixtures}` mostly empty |
| F4 | **Slug mismatch breaks account export**: DataManagement exports slug `accounts`, but the API/collection is `gl-accounts` → `fetchAllDocs('accounts')` hits `/accounts` (404) | [DataManagement.tsx:319](apps/billing/src/pages/DataManagement.tsx#L319) vs [Accounts.tsx:61](apps/billing/src/pages/Accounts.tsx) |
| F5 | Same mismatch in `EXPORT_COLUMNS` (`accounts`), `guessCollection()` returns `accounts`, `DEDUP_KEYS` uses `accounts` | `importExport.ts` |
| F6 | **No Excel in ExportModal** — format state is `'csv' \| 'json'` only | [ExportModal.tsx:59](apps/billing/src/components/ExportModal.tsx#L59) |
| F7 | **No master/multi-sheet workbook** anywhere — closest is the unused 2-sheet journal builder | grep for `buildJournalExcel` → definition only, no callers |
| F8 | **No blank-template download** feature (despite branch name `jules/download-templates`) | grep `template` in `apps/billing/src` → 2 unrelated hits |
| F9 | Import covers only `members/parties/items/accounts/documents/journal-entries` heuristically; 10+ entities (fiscal-years, tax-types, membership-types, account-groups, opening-balances, stock-movements, bank-statements, expense-claims, recurring-schedules, fixed-assets) have **no import/export config at all** | `guessCollection()` + `EXPORT_COLUMNS` keys |
| F10 | Coverage thresholds from README (lib ≥90%, components ≥80%) are not enforced anywhere | no coverage config exists |

---

## 3. Architecture Overview

```
                 ┌──────────────────────────────────────────────┐
                 │        ENTITY REGISTRY (single source)       │
                 │  slug · sheetName · columns · dedupKeys ·    │
                 │  validator · fkLinks · importOrder · kind    │
                 └───────┬──────────────────────────┬───────────┘
                         │                          │
        OBJ-2            ▼                          ▼   OBJ-3
   ┌─────────────────────────────┐   ┌────────────────────────────────┐
   │  Per-Entity Excel I/O       │   │  Master Workbook               │
   │  buildEntityExcel(cfg,docs) │   │  buildMasterWorkbook(docsMap)  │
   │  parseEntityExcel(cfg,file) │   │  parseMasterWorkbook(file)     │
   │  buildTemplate(cfg)         │   │  - _Index (links + counts)     │
   │  + CSV/JSON back-compat     │   │  - _Manifest (sheet→slug map)  │
   └──────────────┬──────────────┘   │  - 16 data sheets, linked      │
                  │                  └──────────────┬─────────────────┘
                  └────────────┬────────────────────┘
                               ▼
              ┌────────────────────────────────────────┐
              │  SHARED IMPORT PIPELINE                │
              │  parse → validate → FK-resolve →       │
              │  classifyRecords (dedup) → preview UI  │
              │  → executeImport (dependency order)    │
              └────────────────────────────────────────┘

  OBJ-1 test pyramid (vitest in apps/billing, jest stays for server):
  unit (lib ≥90%) → component/page tests (RTL, ≥80%) → Playwright E2E
```

---

## 4. Design

### 4.1 Test foundation (fixes F1–F3, F10)

- Install in `apps/billing`: `vitest`, `@vitest/coverage-v8`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`.
- Add to `apps/billing/vite.config.ts` a `test` block (`environment: 'jsdom'`, setup file, `include: ['src/**/*.{test,spec}.{ts,tsx}']`, coverage thresholds 80/80/80/80, `src/lib/**` 90).
- Add scripts: `test` (= `vitest run --coverage`), `test:watch`, `test:ui` — making README's documented commands real.
- **Split of duties (document in TESTING.md):** `vitest` = SPA (`apps/billing`), `jest` = server (`src/**`) — keep both; migrate `tests/unit/importExport.test.ts` → `src/lib/importExport.test.ts` so vitest picks it up (it stops failing under jest).
- Colocate all new tests next to source: `src/components/X/X.test.tsx`, `src/pages/X.test.tsx`, `src/lib/x.test.ts`.
- Component tests mock the network boundary only: `vi.mock('../lib/api')`, `useCachedList`/`useCachedGlobals` return fixtures; never test internal state, test rendered output + user events (per skill).

### 4.2 Entity registry — single source of truth (fixes F4, F5, F9)

New file `apps/billing/src/lib/excel/entities.ts`:

```ts
export interface EntityExcelConfig {
  slug: string                    // real API slug, e.g. 'gl-accounts'
  sheetName: string               // Excel sheet name
  label: string                   // UI label (en + np)
  kind: 'master' | 'transaction'
  importOrder: number             // dependency order for master import
  columns: ExcelExportColumn[]    // reused by CSV export too
  dedupKeys: { key: string; field: string }[]
  validate(doc): ValidationError[]
  fkLinks?: { field: string; ref: string; refField: string }[] // sheet links
  headerAliases?: Record<string, string>  // EN/Nepali header normalization
}
export const ENTITY_REGISTRY: EntityExcelConfig[]  // ordered by importOrder
```

Entity roster (P0 = must ship, P1 = fast follow):

| # | slug (API) | Sheet name | Kind | Dedup business keys | Phase |
|---|-----------|------------|------|---------------------|-------|
| 1 | `fiscal-years` | Fiscal Years | master | `label` | P0 |
| 2 | `account-groups` | Account Groups | master | `name` | P0 |
| 3 | `gl-accounts` | Chart of Accounts | master | `code` (hierarchical) | P0 |
| 4 | `tax-types` | Tax Types | master | `name` | P0 |
| 5 | `membership-types` | Membership Types | master | `name` | P0 |
| 6 | `members` | Members | master | `memberId`, `phone` | P0 |
| 7 | `parties` | Parties | master | `name`+`phone`, `pan` | P0 |
| 8 | `items` | Items | master | `code`, `name` | P0 |
| 9 | `opening-balances` | Opening Balances | master | `accountCode`+`fiscalYear` | P0 |
| 10 | `documents` | Vouchers | txn | `voucherNo` | P0 |
| 11 | `journal-entries` | Journal Entries | txn | `voucherNo`+`accountCode`+line | P0 |
| 12 | `fixed-assets` | Fixed Assets | master | `code` | P1 |
| 13 | `stock-movements` | Stock Movements | txn | `docNo`+line | P1 |
| 14 | `bank-statements` | Bank Statements | txn | `ref`+`date`+`amount` | P1 |
| 15 | `expense-claims` | Expense Claims | txn | `claimNo` | P1 |
| 16 | `recurring-schedules` | Recurring Schedules | txn | `name`/`id` | P1 |

Migration: refactor `importExport.ts` to derive `EXPORT_COLUMNS`, `DEDUP_KEYS`, `guessCollection`, sheet names from the registry; delete the `accounts` key everywhere in favor of `gl-accounts` (fixes F4/F5). `guessCollection` stays only as filename fallback for headerless files.

### 4.3 Per-entity Excel I/O + templates (OBJ-2)

New file `apps/billing/src/lib/excel/entityIo.ts`:

- `buildEntityExcel(cfg, docs, opts)` — generic: styled header (crimson), frozen row, auto-filter, `_Meta` sheet (collection, tenant, exportedAt, count, registry version), dual BS/AD date columns via existing `nepaliDate` helpers.
- `parseEntityExcel(cfg, file)` — reads `_Meta`, normalizes headers via `cfg.headerAliases`, resolves rich-text/date/formula cells (reuse existing logic).
- `buildTemplate(cfg)` — blank `.xlsx`: headers + 1 example row (commented `— example, delete me`) + data-validation dropdowns on FK columns (account code, party, tax type) + a `_ReadMe` sheet with column glossary (EN/NP).
- `exportEntity(slug, format)` / `importEntity(file, slug)` facades used by UI.

Special builders: keep `buildCoaExcel`/`parseCoaExcel` as the `gl-accounts` implementation (hierarchy indentation + group rows); the standalone 2-sheet journal builder becomes the `journal-entries` implementation; **wire all previously unused builders into the UI** (fixes part of F7).

Per-entity coverage — each of the 16 entities gets: export button (Excel + CSV/JSON retained), template download, import entry point, unit tests.

### 4.4 Master workbook format (OBJ-3)

**File:** `syasyah-all-data_<tenant>_<date>.xlsx`

**Sheet layout:**

| Sheet | Contents |
|-------|----------|
| `_Index` | Title, tenant, exported-at, per-sheet hyperlinks, live record counts (`=COUNTA('Members'!A:A)-1`), Trial Balance check (`=ROUND(SUM(debit)-SUM(credit),2)` must show 0) |
| `_Manifest` | Machine-readable: format version, tenant, exportedAt, and the `sheetName → slug → columns → importOrder` map. **This replaces filename guessing on import.** |
| 16 data sheets | One per entity roster row in §4.2, in `importOrder` sequence |

**Linking mechanisms ("all data linked in the excel")** — 4 layers:

1. **FK business keys as plain values** (the authoritative link): `Journal Entries.accountCode → Chart of Accounts.code`, `journal.voucherNo → Vouchers.voucherNo`, `Members.membershipType → Membership Types.name`, `Opening Balances.accountCode → accounts.code`, `Vouchers.party → Parties.name`.
2. **Derived lookup columns** (display-only, `_`-prefixed): `_accountName = IFERROR(VLOOKUP(D2,'Chart of Accounts'!$A:$B,2,FALSE),"⚠ missing")` — VLOOKUP (not XLOOKUP) for Excel/LibreOffice/Google-Sheets compatibility.
3. **Cross-sheet aggregates**: on Vouchers, `_debitTotal = SUMIF('Journal Entries'!$A:$A, A2, 'Journal Entries'!$F:$F)` and `_balanced = IF(_debitTotal=_creditTotal,"✓","✗")`.
4. **Data-validation dropdowns** on every FK column sourced from the referenced sheet range (`formulae: ["='Chart of Accounts'!$A$2:$A$1000"]`), plus named ranges/tables (`tblAccounts`, `tblJournal`, …) and `_Index` hyperlinks.

**Round-trip rule (critical):** ExcelJS-written formulas carry **no cached result** until a spreadsheet app opens the file. Therefore:

- All `_`-prefixed columns are **derived/display-only and skipped on import**.
- Import reads only plain-value columns (FK keys + payload fields).
- Parser still honors `cell.value.result` when present (file was opened in Excel), but never requires it.
- Tests assert both paths: freshly-generated workbook (no cached results) and re-saved workbook (cached results present).

### 4.5 Import pipeline — single and master (shared)

```
file → detect: has _Manifest? → masterImport else per-entity (slug from _Meta or UI selection)
  1. parse sheets (registry-driven header normalization)
  2. validate rows           → errors[] (severity error|warning, sheet+row+field)
  3. FK resolve (master only) → orphan report: e.g. Journal Entries!G14 → accountCode 9999 not in Chart of Accounts
  4. fetch existing (fetchAllDocs) → classifyRecords per entity (3-tier dedup)
  5. PREVIEW: multi-sheet summary — table of entity × (new / duplicate / error), row-level drill-down, color-coded (reuse ImportPreviewModal styling)
  6. conflict rule: global default (skip | update | append) + per-sheet override
  7. executeImport in importOrder (masters before transactions), chunked with per-sheet progress
     - master sheet fatal error → abort remaining masters, report
     - transaction row error → collect & continue
  8. POST-IMPORT VERIFY: refetch counts, trial-balance re-check, summary report + downloadable errors sheet
```

**Bulk-write caution:** every `api()` POST queues to the IndexedDB outbox (offline-first). Import must chunk (e.g. 25/req with progress) and surface queue depth via existing `SyncStatus`; measure 1,000-row import time in E2E and cap/warn beyond a threshold (see Risks).

### 4.6 UI changes

| Surface | Change |
|---------|--------|
| [ExportModal.tsx](apps/billing/src/components/ExportModal.tsx) | Add `Excel (.xlsx)` + `Template (.xlsx)` options (fixes F6); collection list driven by registry; fix its `gl-accounts` label vs DataManagement `accounts` inconsistency |
| [DataManagement.tsx](apps/billing/src/pages/DataManagement.tsx) | Slug list from registry (fixes F4); add **“Export all — master workbook”** button; Import section accepts master workbook; show multi-sheet preview |
| [ImportPreviewModal.tsx](apps/billing/src/components/ImportPreviewModal.tsx) | Multi-sheet mode: summary table → per-sheet drill-down → per-sheet conflict rule → unified progress |
| Entity pages (Accounts, Parties, Items, Members, …) | Each gets an `Export ▾` (Excel/CSV/JSON/Template) and `Import` action wired to the registry (today: import exists on only 6 pages, export modal only on Dashboard) |
| Vouchers / Journal pages | Export via specialized 2-sheet journal builder + import entry |

---

## 5. Work Breakdown (M0–M6)

Each milestone is **test-first**: write failing tests → run (red) → implement → run (green) → refactor → coverage gate.

### M0 — Test foundation (unblocks everything)
- [x] Install vitest + RTL + jsdom + coverage in `apps/billing`; add `test`/`test:watch`/`test:ui` scripts; vitest config with thresholds (80 global / 90 lib) — *thresholds intentionally NOT enabled yet: see §10 status*
- [x] Migrate `tests/unit/importExport.test.ts` → `src/lib/importExport.test.ts`; suite green under vitest; root `npx jest` still green (server only)
- [x] Smoke tests: `Login`, `Toaster`, `Skeleton` prove RTL pipeline works
- **DoD:** `pnpm --dir apps/billing test` green with coverage report; `npx jest` green ✅

### M1 — Entity registry + slug fixes (F4/F5/F9)
- [x] Tests first: registry integrity (every entity has slug/sheet/columns/dedupKeys/validator/order; no duplicate sheet names; `importOrder` unique & sorted; slug matches Payload collection slugs)
- [x] Create `entities.ts`; refactor `importExport.ts` to derive configs; rename `accounts` → `gl-accounts` everywhere (incl. `guessCollection`, DataManagement slug list)
- [x] Tests: account export hits `/gl-accounts`; dedup on `code` still works; existing import test suite stays green
- **DoD:** no `accounts` slug remains in export/import paths; all tests green ✅

### M2 — Per-entity Excel export + templates (OBJ-2, P0 entities 1–11)
- [x] Tests first: `buildEntityExcel` per entity (sheet name, columns, `_Meta`, Devanagari round-trip, BS/AD dates, empty dataset); `buildTemplate` (headers, example row, dropdown validation present, `_ReadMe`)
- [x] Implement `entityIo.ts`; wire unused builders (CoA, Journal 2-sheet, Opening Balances — CoA delegation live; journal handled by `expand`)
- [x] ExportModal gains Excel + Template options; DataManagement slugs from registry (all 16) + template button
- [x] P1 entities (12–16) follow the same registry-driven pattern
- **DoD:** each of 16 entities exports `.xlsx` + template from Data Management/Export Modal; unit tests per entity ✅ *(per-page Export ▾ buttons deferred — both surfaces are registry-driven)*

### M3 — Per-entity Excel import (OBJ-2 complete)
- [x] Tests first: `parseEntityExcel` per entity (headers EN/NP, dates, rich text, formula cells, corrupt file, empty file); validation rules per entity; dedup per entity; `executeImport` order + progress + error collection
- [x] Implement; wire through `parseImportFile` (all 6 pages with file inputs + Data Management get registry parsing for free)
- [x] executeImport: FK resolution (business key → id), members mapForApi, journal row grouping, boolean coercion — 10 integration tests
- **DoD:** import works for all 16 entities with preview + conflict rules ✅ *(validation-bucket display inside ImportPreviewModal deferred; `validateImportRows` is registry-backed + tested)*### M4 — Master workbook export (OBJ-3)
- [x] Tests first: `buildMasterWorkbook` produces `_Index` + `_Manifest` + 16 sheets; sheet order = importOrder; FK plain-value columns present; VLOOKUP/SUMIF/data-validation formulas present on link columns; `_Index` counts + hyperlinks + TB check formula; Devanagari survives; workbook reopens in ExcelJS with expected structure
- [x] Implement `masterWorkbook.ts`; add “Export all — master workbook” to Data Management
- **DoD:** one click downloads the linked workbook; structural assertions green ✅

### M5 — Master workbook import (OBJ-3 complete)
- [x] Tests first: `parseMasterWorkbook` detects `_Manifest`, maps sheets→slugs, skips `_`-prefixed derived columns, reports FK orphans (in-workbook), preserves importOrder, handles missing sheets, wrong-tenant/`_Manifest`-guard on single-entity path
- [x] Implement pipeline §4.5 (dependency-order execution + dedup per sheet); Data Management “Import ALL data” button with orphan/missing-sheet warnings + post-import summary
- [x] **Round-trip test (workbook level):** export master → parse → every sheet’s docs equal the source (0 diffs); import orchestration verified against a simulated DB (order, grouping, per-sheet errors isolated)
- **DoD:** round-trip 0 diffs ✅; FK orphan warnings surfaced ✅; DB-level E2E (Playwright + Postgres) not run — see §10

### M6 — Component test campaign (OBJ-1) — **PARTIAL**
- [x] lib unit tests: excel stack + importExport covered (`entities` 95%, `entityIo` 97% stmts; `importExport` 68% — legacy unused builders remain the gap)
- [x] component tests: **ExportModal (7) + ImportPreviewModal (5)** + M0 smoke (Login/Toaster/Skeleton)
- [ ] component tests: remaining ~27 components
- [ ] page tests: all 40 pages with mocked api/hooks
- [ ] Coverage gate in CI (thresholds deliberately left OFF until the campaign lands — enabling now would fail the build at ~10% global)
- [x] Update README/TEST_PLAN alignment: `pnpm test`/`test:watch`/`test:ui` now exist
- **DoD:** OBJ-1 acceptance criteria met ❌ — campaign outstanding (tracked in §10)

**Suggested sequence:** M0 → M1 → M2 → M3 → M4 → M5 → M6 (M6's lib tests can interleave with M2–M5 per the TDD loop; the full page/component campaign runs last against a stable API).

---

## 6. Component & Page Test Matrix (OBJ-1 inventory)

All currently **untested** (❌ = no test file exists today). Each entry gets a colocated test file.

### 6.1 Shared components (33 = 29 + 4 ui) — RTL, ≥80%

| Component | Must cover |
|-----------|-----------|
| ❌ ImportPreviewModal | 5 steps, conflict rules, color-coded rows, progress, multi-sheet mode (M5) |
| ❌ ExportModal | format selection (csv/json/excel/template), empty-data toast, filename shape |
| ❌ ConflictResolutionModal / ❌ ConflictDrawer | diff display, choose server/local/merge |
| ❌ VoucherViewModal / ❌ MemberViewModal / ❌ LedgerModal | renders doc fields, ledger math |
| ❌ AccountSelect / ❌ SearchSelect / ❌ SearchBox | filtering, keyboard nav, empty state |
| ❌ NepaliDateInput / ❌ FiscalYearSwitcher / ❌ IllakaSwitcher | BS/AD parsing, FY/tenant switching emits change |
| ❌ SyncStatus / ❌ DataStatus / ❌ ConnectingBanner | queue counts, offline states |
| ❌ BalanceBar | debit/credit bar proportions, balanced state |
| ❌ PrintVoucher / ❌ ErrorBoundary / ❌ Skeleton | print layout, error fallback, skeleton shape |
| ❌ CommandPalette / ❌ ActionMenu / ❌ SortableTh / ❌ Popover | ⌘K routing, actions fire, sort toggles, open/close |
| ❌ SetupChecklist / ❌ Tour / ❌ Toaster / ❌ UpdatePrompt | dismiss/complete logic, toast queue |
| ❌ OutstandingInvoices | invoice totals, empty state |
| ❌ ui/: AnimatedSidebar, Breadcrumbs, LiquidButton, LiquidLink | interaction + a11y roles |

### 6.2 Pages (40) — RTL with mocked `api`/`useCachedList`, ≥80%

| Group | Pages (❌ each untested) |
|-------|--------------------------|
| Masters (7) | ❌ Accounts, ❌ Parties, ❌ Items, ❌ Members, ❌ MembershipTypes, ❌ SetupOpeningBalances, ❌ SetupWizard — CRUD, validation, type→group filtering, export/import wiring |
| Bookkeeping (6) | ❌ Vouchers, ❌ VoucherForm, ❌ Journal, ❌ Daybooks, ❌ Posting, ❌ Transfers — number preview, post/void/reopen guards, balanced-entry blocking |
| Reports (18) | ❌ TrialBalance, ❌ BalanceSheet, ❌ ProfitLoss, ❌ Aging, ❌ PartyStatement, ❌ VatRegister, ❌ TaxSales, ❌ TaxPurchase, ❌ SalesReport, ❌ PurchaseReport, ❌ BankStatement, ❌ CashStatement, ❌ LowStockSummary, ❌ StockQuantity, ❌ InventoryValuation, ❌ ExpenseCategory, ❌ IncomeCategory, ❌ ReportsHub — FY filtering, totals math, negative returns rendering |
| Admin (7) | ❌ Settings, ❌ DataManagement, ❌ AuditLog, ❌ BankReconciliation, ❌ RecurringBilling, ❌ ExpenseClaims, ❌ Login — toggles persist, import/export UI, auth flow |
| Dashboard (2) | ❌ Dashboard, ❌ RecentActivity — KPI math, activity feed |

### 6.3 Lib unit tests (22 files) — ≥90% (`src/lib/**`)

Priority order: `importExport.ts` + new `excel/*` (**100%**, per README critical-path rule) → `dataOps.ts`, `nepaliDate.ts`, `nepaliNumbers.ts`, `calendar.tsx`, `fiscalYear.tsx`, `calcEval.ts`, `csv.ts`, `gridNav.ts`, `useSortSearch`, `auth.ts`, `api.ts` (mock fetch/outbox), `offline/`, `sync/` (queue, conflict), `i18n/`, `pdf.ts`.

### 6.4 E2E (Playwright)

- Keep all 12 existing specs green (regression gate for every milestone).
- **New `11-import-export.spec.ts`:** per-entity round-trip (M3), template download+import, master workbook round-trip with trial-balance re-check (M5).
- Fixtures in `apps/billing/tests/fixtures/` (currently empty): golden master workbook, corrupt file, headerless CSV, Devanagari/BS-date sample, orphan-FK workbook.

---

## 7. Definition of Done (mission-level)

1. `pnpm --dir apps/billing test` → green, coverage ≥80% global / ≥90% `src/lib/**` / 100% `importExport` + `excel/*` — enforced in CI.
2. `npx jest` (root/server) → green.
3. `pnpm --dir apps/billing test:e2e` → all 13 specs green (12 existing + import/export).
4. `npx tsc --noEmit` (root) and `cd apps/billing && npx tsc --noEmit` → clean.
5. All 16 entities: Excel export ✅, Excel import ✅, template ✅ from their own page.
6. Master workbook: exports in one click; re-imports into an empty tenant with **0 row diffs** and balanced trial balance; linked columns (VLOOKUP/SUMIF/dropdowns) verified by structural tests.
7. No `accounts` slug remains; README commands match reality; TEST_PLAN.md updated.

**Verification commands:**

```bash
pnpm --dir apps/billing test           # vitest + coverage (M0+)
npx jest                               # server suite
cd apps/billing && npx tsc --noEmit    # SPA typecheck
pnpm --dir apps/billing test:e2e       # Playwright (needs E2E_DATABASE_URI)
npx kritikka-mcp validate-change --changed-files "<git diff names>"
```

---

## 8. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| ExcelJS formulas have no cached values → import reads `undefined` | Master import silently drops linked data | §4.4 round-trip rule: `_`-prefix = display-only, skipped on import; tests for both fresh + Excel-re-saved files |
| Bulk import floods IndexedDB outbox (offline-first `api()`) | UI jank, sync storms, quota errors | Chunked execution w/ progress, row-count cap + warning, measure 1k-row import in E2E, surface via SyncStatus |
| `accounts` → `gl-accounts` rename breaks hidden callers | Regression in export/dedup | M1 registry-integrity test + grep gate for stale slug; full unit+E2E run before M2 |
| Dual test runners (jest vs vitest) confuse contributors | Tests run in wrong runner, false greens | Document split in TESTING.md: jest = `src/**` server, vitest = `apps/billing`; jest config excludes `apps/billing` |
| 40-page test campaign is the largest effort | Schedule risk | Page tests prioritize accounting-critical (VoucherForm, Posting, TrialBalance, DataManagement, import modals) first; campaign runs as M6 checklist, tracked in this file |
| Devanagari / BS dates mangled by Excel | Data corruption | Existing dual-column export + `nepaliDate`/`nepaliNumbers` helpers; explicit Unicode round-trip tests per entity |
| Playwright needs local Postgres (`E2E_DATABASE_URI`) | E2E can't run everywhere | CI job with service container; document in runbook; unit/component tiers give fast local signal |
| P1 entities (bank statements, stock…) schema churn | Rework | Registry makes adding an entity config-only; P1 starts after M3 proves the pattern |

---

## 9. Out of Scope

- New report types or accounting-logic changes (round-trip uses existing posting engine).
- Payload/DB schema migrations (import writes through existing collections only).
- CSV/JSON formats remain as-is (back-compat; registry just centralizes them).
- Desktop (Tauri) packaging changes — import/export runs through the same SPA code path.

---

*Plan built 2026-10-08 from codebase audit on branch `jules/download-templates`. Update checkboxes as milestones land.*
