# Syasyah Samaj — Comprehensive Project Plan (v2.0)
**Version:** 2.0 | **Date:** 2026-10-01  
**Status:** Phase 1-2 Complete (Governance + Excel I/O) → Phase 3-7 In Progress

---

## 1. Refined Project Goals

### Primary Goals (Must-Have)
| # | Goal | Success Criteria | Target |
|---|------|------------------|--------|
| G1 | **Production-Ready Accounting Core** | All voucher types functional, double-entry balanced, fiscal year scoped | Phase 3 |
| G2 | **True Offline-First Experience** | Read/write offline with seamless sync, conflict resolution | Phase 6 |
| G3 | **Nepali Localization Complete** | Devanagari UI, Bikram Sambat dates, Nepali digit formatting, Nepali amount-in-words | Phase 4 |
| G4 | **Import/Export Excellence** | Excel (styled), CSV, JSON with validation, preview, rollback | Phase 3 |
| G5 | **E2E Test Coverage** | Playwright tests running in CI with local Postgres | Phase 7 |

### Secondary Goals (Should-Have)
| # | Goal | Success Criteria | Target |
|---|------|------------------|--------|
| G6 | **Payroll Module** | Salary calculation, deductions, payslip generation | Phase 5 |
| G7 | **Bank Reconciliation** | Statement import (Excel/CSV), auto-matching, reconciliation reports | Phase 5 |
| G8 | **Print-Ready Documents** | A4 letterhead, thermal printer support, PDF export | Phase 4 |
| G9 | **Audit Trail** | User action logs, immutable journal entries, version history | Phase 6 |
| G10 | **Multi-tenant Isolation** | Ilaka/ward-scoped data, admin cross-tenant visibility | Phase 7 |

### Technical Excellence Goals
| # | Goal | Success Criteria |
|---|------|------------------|
| T1 | **Zero-Downtime Sync** | Background sync without blocking UI |
| T2 | **Sub-100ms Reads** | Cache-first reads from IndexedDB |
| T3 | **Conflict-Free Merges** | Last-write-wins with user confirmation for critical data |
| T4 | **Bundle Size < 500KB** | Code-splitting, tree-shaking, lazy-loaded routes |
| T5 | **100% Type Safety** | Strict TypeScript, no `any` types in core |

---

## 2. Comprehensive TODO List

### Phase 1: Kritikka-MCP Governance ✅ COMPLETE
- [x] Install `kritikka-mcp` as dev dependency
- [x] Create `mcp-rules.json` with 16 rules (5 rule types)
- [x] Create 5 ADRs with YAML frontmatter in `docs/adr/`
- [x] Create governance docs: `ARCHITECTURE.md`, `CONVENTIONS.md`, `TESTING.md`, `DEVELOPMENT.md`, `RUNBOOK.md`, `CONTRIBUTING.md`
- [x] Create CI/CD pipeline (`.github/workflows/ci.yml`)
- [x] Update `README.md` with architecture diagram
- [x] Verify: `validate-architecture` passes, `validate-change` passes

### Phase 2: Excel Import/Export Core ✅ COMPLETE
- [x] `buildExportExcel()` — Multi-sheet workbook (Data, _Meta, Template)
- [x] `parseExcelFile()` — ExcelJS parsing with header normalization
- [x] `classifyRecords()` — 3-tier dedup (exact ID, business key, fuzzy)
- [x] `validateImportRows()` — Collection-specific validation
- [x] `executeImport()` — Offline-queued import with progress
- [x] `EXPORT_COLUMNS` — Pre-defined column configs for 7 collections
- [x] `parseCsvText()` — RFC-4180 compliant CSV parser
- [x] `buildExportJson()` / `buildExportCsv()` — JSON/CSV export

### Phase 3: Accounting Excel Features 🔄 IN PROGRESS
**Priority:** P0 | **Target:** Week 1-2

#### 3.1 Chart of Accounts (CoA) Excel Export
- [ ] **3.1.1** Create `buildCoaExcel()` function
  - [ ] Sheet 1: "Chart of Accounts" with hierarchy (Group → Subgroup → Account)
  - [ ] Indent account names based on depth (Level 0, 1, 2, 3)
  - [ ] Columns: Code, Name, Type, Class, Opening Balance (Dr/Cr), PAN/GSTIN
  - [ ] Conditional formatting: Groups (bold), Accounts (normal)
  - [ ] Frozen header row, auto-filter
  - [ ] Meta sheet with fiscal year, export date, tenant info

- [ ] **3.1.2** Create `parseCoaExcel()` for import
  - [ ] Handle hierarchical reconstruction from indented names
  - [ ] Validate account codes (unique, numeric)
  - [ ] Validate parent-child relationships
  - [ ] Support both "Code-Name" and "Indented Name" formats

- [ ] **3.1.3** Unit tests for CoA Excel
  - [ ] Export: 3-level hierarchy renders correctly
  - [ ] Import: Reconstructs hierarchy from flat data
  - [ ] Validation: Duplicate codes rejected
  - [ ] Edge case: 10,000 accounts performance

#### 3.2 Journal Voucher 2-Sheet Excel
- [ ] **3.2.1** Master-Detail Excel format
  - [ ] Sheet 1: "Journal Headers" (Voucher No, Date, Narration, Total Amount, Status)
  - [ ] Sheet 2: "Journal Lines" (Voucher No [link], Account, Debit, Credit, Description)
  - [ ] Data validation: Voucher No must exist in Sheet 1
  - [ ] Formula: Auto-sum debits/credits per voucher

- [ ] **3.2.2** Import with validation
  - [ ] Cross-sheet validation (all lines have valid headers)
  - [ ] Balanced entry check (Dr = Cr per voucher)
  - [ ] Account code resolution (create if not exists, option)
  - [ ] Duplicate detection by voucher number + date

- [ ] **3.2.3** Unit tests
  - [ ] Round-trip: Export → Import → Data integrity
  - [ ] Unbalanced entry rejection
  - [ ] Orphan line detection (no matching header)

#### 3.3 Opening Balances Excel
- [ ] **3.3.1** Opening balances template
  - [ ] Columns: Account Code, Account Name, Debit Opening, Credit Opening
  - [ ] Validation: Only balance sheet accounts allowed
  - [ ] Check: Sum(Debits) = Sum(Credits) for balancing

- [ ] **3.3.2** Import with fiscal year scoping
  - [ ] Validate against selected fiscal year
  - [ ] Warn if opening balances already exist
  - [ ] Option to overwrite or append

- [ ] **3.3.3** Unit tests
  - [ ] Imbalanced opening balances rejected
  - [ ] P&L account rejection (income/expense not allowed)

### Phase 4: Preview Enhancements & Nepali Localization ⏳ PENDING
**Priority:** P1 | **Target:** Week 2-3

#### 4.1 Import Preview Modal Improvements
- [ ] **4.1.1** Enhanced review UI
  - [ ] Group by action type (Create/Update/Skip/Error)
  - [ ] Inline editing for mapped fields
  - [ ] Bulk select/deselect
  - [ ] Search/filter preview rows
  - [ ] Column reordering (drag-drop)

- [ ] **4.1.2** Pre-import validation report
  - [ ] Show error count by type (duplicate, invalid date, missing required)
  - [ ] Download error report as Excel
  - [ ] "Fix and re-upload" workflow

- [ ] **4.1.3** Rollback capability
  - [ ] Store import batch ID
  - [ ] Undo last import (soft delete created, restore updated)
  - [ ] Import history log

#### 4.2 Nepali Localization (Critical)
- [ ] **4.2.1** Nepali digit formatting (०-९)
  - [ ] Utility: `toNepaliDigits(number): string`
  - [ ] Utility: `toArabicDigits(nepaliStr): number`
  - [ ] Display toggle: Arabic / Nepali digits
  - [ ] Input handling: Accept both digit systems

- [ ] **4.2.2** Amount in Nepali words
  - [ ] Function: `amountInNepaliWords(amount): string`
  - [ ] Support: अर्ब, करोड, लाख, हजार, सय
  - [ ] Format: "रुपैयाँ [words] मात्र"
  - [ ] Decimal: पैसा handling

- [ ] **4.2.3** Date localization
  - [ ] Bikram Sambat full support (already partial)
  - [ ] Date picker: BS/AD toggle
  - [ ] Format: "२०८१ असोज १५" or "15 Ashoj 2081"
  - [ ] Excel import: Auto-detect BS dates

- [ ] **4.2.4** UI translations
  - [ ] Complete Nepali i18n for accounting terms
  - [ ] वाउचर, खाता, जर्नल, बिल, रसिद
  - [ ] Language switcher (EN/NE)

#### 4.3 Print-Ready Documents
- [ ] **4.3.1** A4 letterhead with tenant logo/address
- [ ] **4.3.2** Thermal printer support (80mm)
- [ ] **4.3.3** PDF export with Nepali formatting
- [ ] **4.3.4** Print preview with page margins

### Phase 5: Integration Tests & Payroll ⏳ PENDING
**Priority:** P2 | **Target:** Week 3-4

#### 5.1 Integration Test Suite
- [ ] **5.1.1** Test infrastructure
  - [ ] Setup: Test Postgres in Docker
  - [ ] Setup: Test IndexedDB (fake-indexeddb)
  - [ ] Setup: MSW (Mock Service Worker) for API mocking
  - [ ] CI: GitHub Actions workflow

- [ ] **5.1.2** Integration test scenarios
  - [ ] Full offline → online sync cycle
  - [ ] Concurrent edits conflict resolution
  - [ ] Import 1000 members performance
  - [ ] Fiscal year rollover
  - [ ] Multi-tenant data isolation

#### 5.2 Payroll Module (XL Feature)
- [ ] **5.2.1** Payroll schema
  - [ ] Collections: Employee, SalaryStructure, Payslip, Deduction
  - [ ] Fields: Basic, HRA, DA, PF, TDS, Insurance
  - [ ] Nepali calendar integration (monthly payroll)

- [ ] **5.2.2** Payroll calculations
  - [ ] Gross salary computation
  - [ ] Deduction calculations (PF percentage, TDS slabs)
  - [ ] Net payable
  - [ ] Employer contributions

- [ ] **5.2.3** Payslip generation
  - [ ] PDF payslip with Nepali formatting
  - [ ] Email/WhatsApp sharing
  - [ ] Bulk generation

#### 5.3 Bank Reconciliation
- [ ] **5.3.1** Statement import (Excel/CSV/PDF)
- [ ] **5.3.2** Auto-matching rules (amount, date, reference)
- [ ] **5.3.3** Manual match/unmatch UI
- [ ] **5.3.4** Reconciliation reports

### Phase 6: Offline Queue & Sync ⏳ PENDING
**Priority:** P0 (Critical) | **Target:** Week 4-6

#### 6.1 Outbox Queue Enhancement
- [ ] **6.1.1** Queue management
  - [ ] IndexedDB schema: outbox store (id, operation, payload, retryCount, createdAt)
  - [ ] Queue viewer UI (pending/failed/completed)
  - [ ] Manual retry for failed items
  - [ ] Bulk retry/cancel

- [ ] **6.1.2** Conflict detection
  - [ ] Version field on all collections (optimistic locking)
  - [ ] 409 conflict handling
  - [ ] User conflict resolution UI (server vs local)

- [ ] **6.1.3** Background sync
  - [ ] Service Worker periodic sync (where supported)
  - [ ] Fallback: sync on online event
  - [ ] Sync progress indicator
  - [ ] Partial failure handling (some succeed, some fail)

#### 6.2 Offline Import Handling
- [ ] **6.2.1** Queue imports when offline
  - [ ] Large imports don't block UI
  - [ ] Chunked processing (100 records at a time)
  - [ ] Resume interrupted imports

#### 6.3 Audit Trail
- [ ] **6.3.1** User action logs
- [ ] **6.3.2** Immutable journal entries
- [ ] **6.3.3** Version history for critical records

### Phase 7: CI/CD & E2E ⏳ PENDING
**Priority:** P0 | **Target:** Week 6-7

#### 7.1 E2E Test Fix
- [ ] **7.1.1** Local Postgres setup
  - [ ] Docker Compose for test DB
  - [ ] Test seed data
  - [ ] Auth bypass for tests

- [ ] **7.1.2** Playwright test suite
  - [ ] Login flow
  - [ ] Create voucher
  - [ ] Import members
  - [ ] Generate report
  - [ ] Offline mode simulation

#### 7.2 CI/CD Pipeline
- [ ] **7.2.1** GitHub Actions
  - [ ] Lint + Type check
  - [ ] Unit tests
  - [ ] Integration tests (with Postgres)
  - [ ] Build verification
  - [ ] Deploy to staging

---

## 3. Offline Handling Strategy (Detailed)

### 3.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                            │
├─────────────────────────────────────────────────────────────────────┤
│  UI Layer                    │  Sync Layer         │  API Layer   │
│  ─────────                   │  ──────────          │  ────────    │
│  • React Components          │  • outboxQueue.ts   │  • api.ts    │
│  • Hooks (useCachedList)    │  • syncEngine.ts    │  • fetcher   │
│  • Optimistic UI            │  • conflictResolver │  • retry     │
├─────────────────────────────────────────────────────────────────────┤
│                         STORAGE LAYER                               │
├─────────────────────────────────────────────────────────────────────┤
│  IndexedDB                    │  localStorage                      │
│  ─────────                    │  ───────────                       │
│  • collections (documents)   │  • globals (settings)              │
│  • reports (snapshots)       │  • auth tokens                     │
│  • outbox (pending writes)   │  • calendar state                  │
│  • importQueue (large jobs)  │  • UI preferences                  │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Read Strategy (Cache-First)

```typescript
// Pattern: useCachedList.ts enhancement
interface CacheStrategy {
  type: 'cache-first' | 'network-first' | 'cache-only';
  maxAge: number;      // ms, 0 = infinite
  staleWhileRevalidate: boolean;
}

const strategies: Record<string, CacheStrategy> = {
  members: { type: 'cache-first', maxAge: 5 * 60 * 1000, staleWhileRevalidate: true },
  accounts: { type: 'cache-first', maxAge: 30 * 60 * 1000, staleWhileRevalidate: true },
  reports: { type: 'network-first', maxAge: 0, staleWhileRevalidate: false },
  vouchers: { type: 'cache-first', maxAge: 2 * 60 * 1000, staleWhileRevalidate: true },
};
```

**Flow:**
1. Check IndexedDB for cached data
2. Return immediately (0ms if warm)
3. Background fetch from network
4. Update cache if changed (silent refresh)

### 3.3 Write Strategy (Outbox Pattern)

```typescript
// Core: outboxQueue.ts
interface OutboxItem {
  id: string;                    // UUID
  operation: 'create' | 'update' | 'delete';
  collection: string;
  payload: Record<string, any>;
  optimisticId?: string;         // Temp ID for UI
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  status: 'pending' | 'processing' | 'failed' | 'completed';
  error?: string;
  dependencies?: string[];       // For foreign key constraints
}
```

**Write Flow:**
```
User Action → Optimistic UI Update → Add to Outbox → Return Success
                                                    ↓
                                    Online? → Yes → Process Queue
                                        ↓
                                        No → Wait for Online Event
```

### 3.4 Conflict Resolution

| Scenario | Strategy | Implementation |
|----------|----------|----------------|
| Same record, same field | Last-write-wins | Version field (timestamp) |
| Delete vs Update | User decision | Conflict modal |
| Foreign key missing | Dependency queue | Wait for parent record |
| Network timeout | Exponential backoff | 1s, 2s, 4s, 8s, 16s max |

```typescript
// conflictResolver.ts
async function resolveConflict(
  local: OutboxItem,
  server: Record<string, any>
): Promise<'local' | 'server' | 'merge'> {
  if (local.operation === 'delete') {
    return showConflictModal(local, server);
  }
  
  // Automatic: newer timestamp wins
  const localTime = new Date(local.payload.updatedAt).getTime();
  const serverTime = new Date(server.updatedAt).getTime();
  
  return localTime > serverTime ? 'local' : 'server';
}
```

### 3.5 Large Import Handling (Offline)

```typescript
// offlineImport.ts
interface ImportJob {
  id: string;
  fileName: string;
  totalRows: number;
  processedRows: number;
  failedRows: number;
  status: 'queued' | 'processing' | 'paused' | 'completed' | 'failed';
  chunks: ImportChunk[];
  createdAt: Date;
}

// Chunking strategy: 100 rows per chunk
// Queue chunks in IndexedDB
// Process chunks sequentially with checkpointing
// Resume from last checkpoint on reconnect
```

### 3.6 Sync Status UI

```typescript
// Components needed:
// - SyncStatusIndicator (toolbar icon)
// - PendingChangesBadge (count of outbox items)
// - SyncDetailsModal (list of pending/failed items)
// - OfflineBanner (top notification when offline)
```

---

## 4. Testing Strategy (Per Module)

### 4.1 Test Pyramid

```
        /\
       /  \  E2E (Playwright) - Critical flows
      /____\     [10% of tests, highest confidence]
     /      \
    /--------\  Integration (Vitest + DB)
   /          \   [20% of tests, API + DB + Cache]
  /------------\
 /--------------\ Unit (Vitest)
/________________\ [70% of tests, pure functions]

Total Target: 500+ unit, 50+ integration, 20+ E2E
```

### 4.2 Module-Specific Testing

#### Module: Import/Export (`lib/importExport.ts`)

| Test Category | Cases | File |
|---------------|-------|------|
| **Excel Export** | Styled headers, frozen rows, formulas, multiple sheets | `importExport.test.ts` |
| | Meta sheet content validation | |
| | 10,000 row performance (< 2s) | |
| **Excel Import** | Header normalization (various formats) | `importExport.test.ts` |
| | Date parsing (AD/BS formats) | |
| | Formula evaluation (cached values) | |
| | Error handling (corrupted file) | |
| **CSV** | BOM handling, delimiter detection | `importExport.test.ts` |
| | Quote escaping, newlines in fields | |
| **JSON** | Schema validation, large file streaming | `importExport.test.ts` |

```typescript
// Example test structure
describe('buildExportExcel', () => {
  it('creates styled headers with frozen row', async () => {
    const data = generateMockMembers(100);
    const excel = await buildExportExcel('members', data);
    const workbook = XLSX.read(excel);
    
    expect(workbook.Sheets['Members']['!freeze']).toBeDefined();
    expect(workbook.Sheets['Members']['A1'].s.font.bold).toBe(true);
  });
  
  it('handles 10k rows in under 2 seconds', async () => {
    const data = generateMockMembers(10000);
    const start = performance.now();
    await buildExportExcel('members', data);
    expect(performance.now() - start).toBeLessThan(2000);
  });
});
```

#### Module: Offline Sync (`lib/sync/`)

| Test Category | Cases | File |
|---------------|-------|------|
| **Outbox Queue** | Add item, process, complete | `outboxQueue.test.ts` |
| | Retry with exponential backoff | |
| | Max retries exceeded → failed | |
| **Conflict Resolution** | Last-write-wins logic | `conflictResolver.test.ts` |
| | User prompt for delete conflict | |
| **Cache Management** | Cache-first read | `useCachedList.test.ts` |
| | Stale-while-revalidate | |
| | Cache eviction (LRU) | |

```typescript
describe('outboxQueue', () => {
  it('processes queue when online', async () => {
    const item = await addToOutbox({ operation: 'create', collection: 'members', payload: {} });
    await processQueue();
    expect(item.status).toBe('completed');
  });
  
  it('retries failed items with backoff', async () => {
    mockApiFailure();
    const item = await addToOutbox({ /* ... */ });
    await processQueue();
    expect(item.retryCount).toBe(1);
    expect(item.nextRetryAt).toBeGreaterThan(Date.now() + 1000);
  });
});
```

#### Module: Accounting Core (`collections/`)

| Test Category | Cases | File |
|---------------|-------|------|
| **Double Entry** | Balanced journal (Dr = Cr) | `journalValidation.test.ts` |
| | Unbalanced rejection | |
| **Fiscal Year** | Date within active year | `fiscalYear.test.ts` |
| | Year-end closing | |
| **Account Hierarchy** | Parent-child relationships | `accounts.test.ts` |
| | Circular reference prevention | |

#### Module: UI Components (`components/`)

| Test Category | Cases | File |
|---------------|-------|------|
| **ImportPreviewModal** | Render preview data | `ImportPreviewModal.test.tsx` |
| | Select/deselect rows | |
| | Confirm import action | |
| **NepaliDateInput** | BS date entry | `NepaliDateInput.test.tsx` |
| | AD/BS conversion | |
| | Validation | |

### 4.3 E2E Test Scenarios

```typescript
// e2e/specs/criticalFlows.spec.ts
test.describe('Critical Flows', () => {
  test('complete voucher creation flow', async ({ page }) => {
    await page.goto('/vouchers/new');
    await page.selectOption('select[name="type"]', 'Receipt');
    await page.fill('input[name="amount"]', '1000');
    await page.click('button[type="submit"]');
    await expect(page.locator('.success-toast')).toBeVisible();
    await expect(page.locator('text=Voucher created')).toBeVisible();
  });
  
  test('offline mode - create voucher, sync when online', async ({ page, context }) => {
    await context.setOffline(true);
    await page.goto('/vouchers/new');
    // Create voucher while offline
    await page.fill('input[name="amount"]', '5000');
    await page.click('button[type="submit"]');
    await expect(page.locator('.pending-badge')).toContainText('1');
    
    // Go online
    await context.setOffline(false);
    await page.waitForSelector('.sync-complete', { timeout: 10000 });
    await expect(page.locator('.pending-badge')).not.toBeVisible();
  });
  
  test('import members from Excel', async ({ page }) => {
    await page.goto('/data-management');
    await page.setInputFiles('input[type="file"]', 'test/fixtures/members.xlsx');
    await expect(page.locator('.preview-modal')).toBeVisible();
    await page.click('button:has-text("Confirm Import")');
    await expect(page.locator('.import-success')).toContainText('50 members imported');
  });
});
```

### 4.4 Test Data Management

```typescript
// tests/fixtures/
fixtures/
├── members/
│   ├── valid-50.xlsx
│   ├── valid-1000.xlsx
│   ├── invalid-dates.xlsx
│   └── duplicate-phones.csv
├── accounts/
│   ├── coa-hierarchy.xlsx
│   └── opening-balances.xlsx
└── seed/
    ├── fiscal-years.ts
    ├── members.ts
    └── accounts.ts
```

### 4.5 CI Test Pipeline

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install
      - run: pnpm test:unit --coverage
      - run: pnpm test:unit:coverage:report

  integration:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install
      - run: pnpm test:integration

  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install
      - run: pnpm test:e2e
```

---

## 5. Implementation Roadmap

### Immediate (This Week)
1. ✅ Complete Phase 3.1 (CoA Excel) 
2. ✅ Complete Phase 3.2 (Journal 2-sheet)
3. ✅ Complete Phase 3.3 (Opening Balances)
4. 🔄 Write unit tests for all Phase 3 features

### Short-term (Next 2 Weeks)
1. Phase 4.1 (Preview enhancements)
2. Phase 4.2 (Nepali localization - start with digits)
3. Fix Playwright E2E (Phase 7.1)
4. Setup integration test infrastructure (Phase 5.1)

### Medium-term (Month 1)
1. Complete Nepali localization
2. Payroll module design (Phase 5.2)
3. Outbox queue enhancement (Phase 6.1)
4. First integration tests

### Long-term (Month 2-3)
1. Complete offline sync (Phase 6)
2. Payroll implementation
3. Full E2E coverage
4. Production deployment

---

## 6. Key Decisions Log

| Date | Decision | Rationale | Status |
|------|----------|-----------|--------|
| 2026-10-01 | Use `exceljs` over `xlsx` | Better styling, streaming, formula support | ✅ Applied |
| 2026-10-01 | Keep IndexedDB for cache, add outbox queue | Separation of concerns (cache vs sync) | 🔄 In Progress |
| 2026-10-01 | Nepali digits as display layer only | Store Arabic digits in DB for compatibility | 📋 Planned |
| 2026-10-01 | Optimistic locking with version field | Simple conflict detection | 📋 Planned |

---

## 7. Governance Status (Kritikka-MCP)

### Active Rules (16 total)
| Type | Count | Status |
|------|-------|--------|
| Forbidden | 4 | ✅ Passing |
| Require ADR | 5 | ✅ Passing |
| Require Test | 3 | ✅ Passing |
| Require Doc Update | 2 | ⚠️ Warnings |
| Layer Dependency | 2 | ✅ Passing |

### ADRs (5 total, all Accepted)
| ID | Title | File |
|----|-------|------|
| 0001 | Data Model Governance | `docs/adr/0001-data-model-governance.md` |
| 0002 | Offline-First Architecture | `docs/adr/0002-offline-first-architecture.md` |
| 0003 | Nepali Calendar & Numbers | `docs/adr/0003-nepali-calendar-numbers.md` |
| 0004 | Excel Import/Export & Dedup | `docs/adr/0004-excel-import-export-dedup.md` |
| 0005 | Double-Entry Accounting Invariants | `docs/adr/0005-accounting-invariants.md` |

### Jules-Ready Verification
```bash
# Architecture validation
npx kritikka-mcp validate-architecture
# → valid: true

# Change validation
npx kritikka-mcp validate-change --changed-files "apps/billing/src/pages/Vouchers.tsx apps/billing/e2e/specs/04-vouchers.spec.ts docs/ARCHITECTURE.md"
# → valid: true

# Jules dispatch gates available
# validate_jules_ready, prepare_jules_task, validate_jules_result
```