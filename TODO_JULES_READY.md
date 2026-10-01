# Syasyah Samaj - Jules Ready Implementation Todo List

**Project:** syasyah-samaj (Billing SPA)  
**Target:** Google Jules dispatch ready with kritikka-mcp governance  
**Created:** 2026-09-30  
**Updated:** 2026-10-01 (v2.0 - Comprehensive Plan)  
**Tracking:** This file serves as the master todo list

---

## 📋 Phase 1: Kritikka-MCP Governance Setup ✅ COMPLETE

### 1.1 Installation & Configuration
- [x] **TASK-001** Install kritikka-mcp as dev dependency
  ```bash
  cd /Users/aayurtshrestha/Projects/supreme/syasyah-samaj
  pnpm add -D kritikka-mcp
  ```

- [x] **TASK-002** Create `mcp-rules.json` at repository root
  - Forbidden paths: `dist/**`, `node_modules/**`, `.next/**`, `build/**`, `*.log`
  - Require ADR for: `src/collections/**`, `src/lib/api.ts`, `src/lib/offline/**`
  - Require tests for: `src/**/*.ts`, `src/**/*.tsx` (exempt: `*.d.ts`, `*.config.*`)
  - Require doc updates for: `src/collections/**` → `docs/ARCHITECTURE.md`
  - Layer dependencies: `ui (pages/components)` → `lib (api, offline, sync)` → `foundation (types, config)`

- [x] **TASK-003** Verify kritikka-mcp starts
  ```bash
  npx kritikka-mcp --root .
  ```

- [x] **TASK-004** Add MCP client config (`.vscode/mcp.json` or Claude Desktop)

### 1.2 Governance Documentation
- [x] **TASK-005** Create/verify `docs/ARCHITECTURE.md`
  - System overview, data flow, offline architecture, sync protocol

- [x] **TASK-006** Create/verify `docs/CONVENTIONS.md`
  - TypeScript, React, naming, imports, error handling, i18n patterns

- [x] **TASK-007** Create/verify `docs/TESTING.md`
  - Unit, integration, E2E policies; coverage thresholds; mock strategies

- [x] **TASK-008** Create/verify `docs/DEVELOPMENT.md`
  - Local setup, dev workflow, debug, common tasks

- [x] **TASK-009** Create `docs/adr/` with initial ADRs:
  - ADR-0001: Data Model Governance
  - ADR-0002: Offline-First Architecture with SyncEngine
  - ADR-0003: Nepali calendar (BS) + Gregorian (AD) dual date system
  - ADR-0004: Excel import/export with deduplication strategy
  - ADR-0005: Double-Entry Accounting Invariants

- [x] **TASK-010** Create/verify `RUNBOOK.md`
  - Deploy, rollback, monitoring, incident response, backup/restore

- [x] **TASK-011** Create/verify `CONTRIBUTING.md`
  - PR template, commit conventions, review checklist

### 1.3 Jules Dispatch Gates
- [x] **TASK-012** Test `validate_jules_ready` tool
- [x] **TASK-013** Test `prepare_jules_task` tool with sample task
- [x] **TASK-014** Test `validate_jules_result` tool with mock result

---

## 📊 Phase 2: Excel Import/Export System ✅ CORE COMPLETE

### 2.1 Core Library (`apps/billing/src/lib/importExport.ts`)
- [x] **TASK-015** Add dependencies: `exceljs` (installed)
  ```bash
  cd apps/billing && pnpm add exceljs
  ```

- [x] **TASK-016** Implement `buildExportExcel(collection, docs, options)`
  - Multi-sheet: Data, Metadata, Template
  - Nepali digit formatting option
  - BS date columns alongside AD dates
  - Column width auto-fit

- [x] **TASK-017** Implement `parseExcelFile(file, options)`
  - Parse .xlsx/.xls/.csv
  - Header detection + mapping
  - Row validation with detailed errors
  - Streaming parse for large files

- [x] **TASK-018** Implement `buildTemplate(collection)`
  - Required columns marked
  - Example rows with valid data
  - Instructions sheet

- [x] **TASK-019** Extend `classifyRecords` for Excel-specific dedup
  - Business key configs per collection
  - Fuzzy match threshold configurable

- [x] **TASK-020** `buildExportJson()` / `buildExportCsv()` / `parseCsvText()` / `parseImportFile()`

### 2.2 Collection Configurations
- [x] **TASK-021** Define export/import config for **Members**
  - Keys: `memberId`, `phone`, `email`
  - Required: `fullName`, `phone`, `address`, `bloodGroup`, `membershipType`
  - BS date: `appliedDateBs`

- [x] **TASK-022** Define config for **Parties**
  - Keys: `name`, `phone`, `gstNumber`
  - Required: `name`, `type`, `phone`, `address`

- [x] **TASK-023** Define config for **Items**
  - Keys: `code`, `name`
  - Required: `name`, `code`, `unit`, `rate`, `taxType`

- [x] **TASK-024** Define config for **Accounts**
  - Keys: `code`, `name`
  - Required: `code`, `name`, `group`, `type`, `openingBalance`

- [x] **TASK-025** Define config for **Opening Balances**
  - Keys: `accountId` + `fiscalYear`
  - Required: `accountId`, `fiscalYear`, `debit`, `credit`

- [x] **TASK-026** Define config for **Membership Types**
  - Keys: `name`
  - Required: `name`, `fee`, `durationMonths`

### 2.3 UI: Import Wizard (DataManagement Page) 🔄 IN PROGRESS
- [ ] **TASK-027** Step 1: File upload + collection select + template download
  - Drag-drop zone with file type validation
  - Collection dropdown with descriptions
  - "Download Template" button per collection

- [ ] **TASK-028** Step 2: Column mapping UI
  - Auto-detect headers from file
  - Map file columns → system fields
  - Required field indicators
  - Save mapping as preset

- [ ] **TASK-029** Step 3: Conflict resolution rules
  - Radio: Skip duplicates / Update existing / Append all
  - Match key selector (per collection config)
  - Preview of how many would match

- [ ] **TASK-030** Step 4: Validation preview table
  - Color badges: ✓ Valid / ⚠ Warning / ✗ Error
  - Expandable row details for errors
  - Filter: All / Valid / Warnings / Errors
  - Row count summary

- [ ] **TASK-031** Step 5: Execute with progress
  - Progress bar with current row
  - Cancel button (stops further processing)
  - Results summary: created/updated/skipped/errors
  - Download error report

### 2.4 Export UI Enhancements
- [ ] **TASK-032** Add Excel export buttons to each list page
  - Members, Parties, Items, Accounts, Vouchers, Journal Entries
  - Filtered export (respects current filters)

- [ ] **TASK-033** "Export All" → ZIP download
  - One-click backup of all collections
  - Progress indicator

- [ ] **TASK-034** Export options modal
  - Date range filter
  - Include BS dates toggle
  - Nepali digits toggle
  - Format: Excel / CSV / JSON

---

## 🧪 Phase 3: Accounting Excel Features 🔄 IN PROGRESS

### 3.1 Chart of Accounts (CoA) Excel Export
- [ ] **TASK-035** Create `buildCoaExcel()` function
  - [ ] Sheet 1: "Chart of Accounts" with hierarchy (Group → Subgroup → Account)
  - [ ] Indent account names based on depth (Level 0, 1, 2, 3)
  - [ ] Columns: Code, Name, Type, Class, Opening Balance (Dr/Cr), PAN/GSTIN
  - [ ] Conditional formatting: Groups (bold), Accounts (normal)
  - [ ] Frozen header row, auto-filter
  - [ ] Meta sheet with fiscal year, export date, tenant info

- [ ] **TASK-036** Create `parseCoaExcel()` for import
  - [ ] Handle hierarchical reconstruction from indented names
  - [ ] Validate account codes (unique, numeric)
  - [ ] Validate parent-child relationships
  - [ ] Support both "Code-Name" and "Indented Name" formats

- [ ] **TASK-037** Unit tests for CoA Excel
  - [ ] Export: 3-level hierarchy renders correctly
  - [ ] Import: Reconstructs hierarchy from flat data
  - [ ] Validation: Duplicate codes rejected
  - [ ] Edge case: 10,000 accounts performance

### 3.2 Journal Voucher 2-Sheet Excel
- [ ] **TASK-038** Master-Detail Excel format
  - [ ] Sheet 1: "Journal Headers" (Voucher No, Date, Narration, Total Amount, Status)
  - [ ] Sheet 2: "Journal Lines" (Voucher No [link], Account, Debit, Credit, Description)
  - [ ] Data validation: Voucher No must exist in Sheet 1
  - [ ] Formula: Auto-sum debits/credits per voucher

- [ ] **TASK-039** Import with validation
  - [ ] Cross-sheet validation (all lines have valid headers)
  - [ ] Balanced entry check (Dr = Cr per voucher)
  - [ ] Account code resolution (create if not exists, option)
  - [ ] Duplicate detection by voucher number + date

- [ ] **TASK-040** Unit tests
  - [ ] Round-trip: Export → Import → Data integrity
  - [ ] Unbalanced entry rejection
  - [ ] Orphan line detection (no matching header)

### 3.3 Opening Balances Excel
- [ ] **TASK-041** Opening balances template
  - [ ] Columns: Account Code, Account Name, Debit Opening, Credit Opening
  - [ ] Validation: Only balance sheet accounts allowed
  - [ ] Check: Sum(Debits) = Sum(Credits) for balancing

- [ ] **TASK-042** Import with fiscal year scoping
  - [ ] Validate against selected fiscal year
  - [ ] Warn if opening balances already exist
  - [ ] Option to overwrite or append

- [ ] **TASK-043** Unit tests
  - [ ] Imbalanced opening balances rejected
  - [ ] P&L account rejection (income/expense not allowed)

---

## 🧪 Phase 4: Test Infrastructure & Coverage 🔄 IN PROGRESS

### 4.1 Test Stack Setup
- [ ] **TASK-044** Configure Vitest in apps/billing
  - `vitest.config.ts` with coverage thresholds (80%)
  - React Testing Library setup
  - MSW handlers for API mocking

- [ ] **TASK-045** Add test scripts to package.json
  ```json
  "test": "vitest run --coverage",
  "test:watch": "vitest",
  "test:ui": "vitest --ui",
  "test:e2e": "playwright test"
  ```

### 4.2 Unit Tests - Lib Utilities
- [ ] **TASK-046** `src/lib/__tests__/api.test.ts`
  - Request/response handling
  - Error normalization
  - Tenant query injection

- [ ] **TASK-047** `src/lib/__tests__/importExport.test.ts`
  - CSV parse/export roundtrip
  - JSON export/import roundtrip
  - Dedup classification accuracy

- [ ] **TASK-048** `src/lib/__tests__/excelImportExport.test.ts`
  - Excel export creates valid .xlsx
  - Excel import parses correctly
  - Nepali digits preserved
  - BS dates parsed correctly
  - Large file (10k rows) performance

- [ ] **TASK-049** `src/lib/__tests__/nepaliNumbers.test.ts`
  - `toNepaliDigits` / `fromNepaliDigits`
  - `fmt()` with nepaliDigits setting
  - Amount in words (EN + NE)

- [ ] **TASK-050** `src/lib/offline/__tests__/*.test.ts`
  - IndexedDB adapter CRUD
  - MemoryDB adapter (test double)
  - Outbox queue ordering
  - Conflict detection

- [ ] **TASK-051** `src/lib/sync/__tests__/*.test.ts`
  - SyncEngine flush/pull
  - Adapter switching (IndexedDB/SQLite)
  - Cache invalidation

### 4.3 Component Tests
- [ ] **TASK-052** `ImportPreviewModal.test.tsx`
  - Renders validation rows correctly
  - Conflict action changes reflect
  - Submit calls executeImport

- [ ] **TASK-053** `NepaliDateInput.test.tsx`
  - AD ↔ BS conversion
  - Keyboard navigation
  - Validation messages

- [ ] **TASK-054** `AccountSelect.test.tsx` / `SearchSelect.test.tsx`
  - Portal rendering
  - Search filtering
  - Keyboard accessibility

### 4.4 Page Integration Tests
- [ ] **TASK-055** `DataManagement.test.tsx`
  - Cleanup flow
  - Demo seed flow
  - Import wizard full flow
  - Export buttons

- [ ] **TASK-056** `Vouchers.test.tsx`
  - List, create, edit, post, void
  - Offline create → sync
  - Filter/sort/pagination

- [ ] **TASK-057** `Members.test.tsx`
  - CRUD + import/export
  - Member view modal
  - Search/filter

- [ ] **TASK-058** `Journal.test.tsx` / `Daybooks.test.tsx`
  - Entry creation
  - Posting validation
  - Report generation

### 4.5 E2E Tests (Playwright)
- [ ] **TASK-059** `11-import-export.spec.ts`
  - Export members → import same file → verify count
  - Export parties → modify → import with update
  - Duplicate detection in UI

- [ ] **TASK-060** `12-excel-import.spec.ts`
  - Download template → fill → upload → validate → import
  - Invalid data shows errors
  - Large file (1000 rows) imports successfully
  - Nepali digits in Excel import correctly

- [ ] **TASK-061** `13-offline-flow.spec.ts`
  - Go offline → create voucher → go online → verify sync
  - Conflict: edit offline + server edit → resolve in UI
  - Background sync triggers on focus

- [ ] **TASK-062** `14-accounting.spec.ts`
  - Voucher posting: debit = credit enforced
  - Opening balance carry forward
  - Trial balance = 0
  - Party statement matches vouchers

---

## 🔄 Phase 5: Preview Enhancements & Nepali Localization ⏳ PENDING

### 5.1 Import Preview Modal Improvements
- [ ] **TASK-063** Enhanced review UI
  - [ ] Group by action type (Create/Update/Skip/Error)
  - [ ] Inline editing for mapped fields
  - [ ] Bulk select/deselect
  - [ ] Search/filter preview rows
  - [ ] Column reordering (drag-drop)

- [ ] **TASK-064** Pre-import validation report
  - [ ] Show error count by type (duplicate, invalid date, missing required)
  - [ ] Download error report as Excel
  - [ ] "Fix and re-upload" workflow

- [ ] **TASK-065** Rollback capability
  - [ ] Store import batch ID
  - [ ] Undo last import (soft delete created, restore updated)
  - [ ] Import history log

### 5.2 Nepali Localization (Critical)
- [ ] **TASK-066** Nepali digit formatting (०-९)
  - [ ] Utility: `toNepaliDigits(number): string`
  - [ ] Utility: `toArabicDigits(nepaliStr): number`
  - [ ] Display toggle: Arabic / Nepali digits
  - [ ] Input handling: Accept both digit systems

- [ ] **TASK-067** Amount in Nepali words
  - [ ] Function: `amountInNepaliWords(amount): string`
  - [ ] Support: अर्ब, करोड, लाख, हजार, सय
  - [ ] Format: "रुपैयाँ [words] मात्र"
  - [ ] Decimal: पैसा handling

- [ ] **TASK-068** Date localization
  - [ ] Bikram Sambat full support (already partial)
  - [ ] Date picker: BS/AD toggle
  - [ ] Format: "२०८१ असोज १५" or "15 Ashoj 2081"
  - [ ] Excel import: Auto-detect BS dates

- [ ] **TASK-069** UI translations
  - [ ] Complete Nepali i18n for accounting terms
  - [ ] वाउचर, खाता, जर्नल, बिल, रसिद
  - [ ] Language switcher (EN/NE)

### 5.3 Print-Ready Documents
- [ ] **TASK-070** A4 letterhead with tenant logo/address
- [ ] **TASK-071** Thermal printer support (80mm)
- [ ] **TASK-072** PDF export with Nepali formatting
- [ ] **TASK-073** Print preview with page margins

---

## 🧪 Phase 6: Integration Tests & Payroll ⏳ PENDING

### 6.1 Integration Test Suite
- [ ] **TASK-074** Test infrastructure
  - [ ] Setup: Test Postgres in Docker
  - [ ] Setup: Test IndexedDB (fake-indexeddb)
  - [ ] Setup: MSW (Mock Service Worker) for API mocking
  - [ ] CI: GitHub Actions workflow

- [ ] **TASK-075** Integration test scenarios
  - [ ] Full offline → online sync cycle
  - [ ] Concurrent edits conflict resolution
  - [ ] Import 1000 members performance
  - [ ] Fiscal year rollover
  - [ ] Multi-tenant data isolation

### 6.2 Payroll Module (XL Feature)
- [ ] **TASK-076** Payroll schema
  - [ ] Collections: Employee, SalaryStructure, Payslip, Deduction
  - [ ] Fields: Basic, HRA, DA, PF, TDS, Insurance
  - [ ] Nepali calendar integration (monthly payroll)

- [ ] **TASK-077** Payroll calculations
  - [ ] Gross salary computation
  - [ ] Deduction calculations (PF percentage, TDS slabs)
  - [ ] Net payable
  - [ ] Employer contributions

- [ ] **TASK-078** Payslip generation
  - [ ] PDF payslip with Nepali formatting
  - [ ] Email/WhatsApp sharing
  - [ ] Bulk generation

### 6.3 Bank Reconciliation
- [ ] **TASK-079** Statement import (Excel/CSV/PDF)
- [ ] **TASK-080** Auto-matching rules (amount, date, reference)
- [ ] **TASK-081** Manual match/unmatch UI
- [ ] **TASK-082** Reconciliation reports

---

## 🔄 Phase 7: Offline Queue & Sync ⏳ PENDING

### 7.1 Outbox Queue Enhancement
- [ ] **TASK-083** Queue management
  - [ ] IndexedDB schema: outbox store (id, operation, payload, retryCount, createdAt)
  - [ ] Queue viewer UI (pending/failed/completed)
  - [ ] Manual retry for failed items
  - [ ] Bulk retry/cancel

- [ ] **TASK-084** Conflict detection
  - [ ] Version field on all collections (optimistic locking)
  - [ ] 409 conflict handling
  - [ ] User conflict resolution UI (server vs local)

- [ ] **TASK-085** Background sync
  - [ ] Service Worker periodic sync (where supported)
  - [ ] Fallback: sync on online event
  - [ ] Sync progress indicator
  - [ ] Partial failure handling (some succeed, some fail)

### 7.2 Offline Import Handling
- [ ] **TASK-086** Queue imports when offline
  - [ ] Large imports don't block UI
  - [ ] Chunked processing (100 records at a time)
  - [ ] Resume interrupted imports

### 7.3 Audit Trail
- [ ] **TASK-087** User action logs
- [ ] **TASK-088** Immutable journal entries
- [ ] **TASK-089** Version history for critical records

---

## 📝 Phase 8: CI/CD & E2E ⏳ PENDING

### 8.1 E2E Test Fix
- [ ] **TASK-090** Local Postgres setup
  - [ ] Docker Compose for test DB
  - [ ] Test seed data
  - [ ] Auth bypass for tests

- [ ] **TASK-091** Playwright test suite
  - [ ] Login flow
  - [ ] Create voucher
  - [ ] Import members
  - [ ] Generate report
  - [ ] Offline mode simulation

### 8.2 CI/CD Pipeline
- [ ] **TASK-092** GitHub Actions
  - [ ] Lint + Type check
  - [ ] Unit tests
  - [ ] Integration tests (with Postgres)
  - [ ] Build verification
  - [ ] Deploy to staging

---

## 🎯 Definition of Done Checklist

| Checklist Item | Status |
|----------------|--------|
| kritikka-mcp starts and validates repo | ✅ |
| `mcp-rules.json` has all 5 rule types | ✅ |
| All governance docs exist (ARCHITECTURE, CONVENTIONS, TESTING, DEVELOPMENT, ADRs, RUNBOOK, CONTRIBUTING) | ✅ |
| Excel import works for all 7 collections | ✅ Core |
| Excel export works for all 7 collections | ✅ Core |
| Import wizard: 5 steps functional | 🔄 0/5 |
| Dedup: exact + business key + fuzzy | ✅ |
| Unit tests: ≥ 80% coverage on lib/ | ⏳ 0% |
| Component tests: all shared components | ⏳ 0% |
| Page integration tests: 5+ pages | ⏳ 0% |
| E2E tests: import/export + offline + accounting | ⏳ 0% |
| Offline conflict resolution UI | ⏳ |
| Background sync: backoff, network-aware, visibility | ⏳ |
| SQLite adapter verified on desktop | ⏳ |
| CI passes: typecheck, lint, test, build | ⏳ |
| E2E CI passes with Postgres | ⏳ |
| `validate_jules_ready` passes | ✅ |
| Jules dispatch cycle verified | ✅ |

---

## 📝 Notes & Blockers

> **Blocker**: Need local Postgres for E2E tests (see `apps/billing/e2e/playwright.config.ts` - uses `E2E_DATABASE_URI`)
> 
> **Decision**: Use `postgres:16` in Docker for CI; document local setup in DEVELOPMENT.md
> 
> **Dependency**: kritikka-mcp requires Node ≥ 20 - verify CI uses Node 20+

---

## 🔗 Related Files

- **Plan v2**: `PROJECT_PLAN_v2.md`
- **Rules**: `mcp-rules.json`
- **Governance**: `docs/adr/`, `docs/ARCHITECTURE.md`, etc.
- **Tests**: `apps/billing/src/**/__tests__/`, `apps/billing/e2e/specs/`
- **Offline**: `apps/billing/src/lib/offline/`, `apps/billing/src/lib/sync/`
- **Import/Export**: `apps/billing/src/lib/importExport.ts`