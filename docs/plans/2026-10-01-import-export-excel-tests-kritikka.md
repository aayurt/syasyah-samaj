# Plan: Excel Import/Export, Tests, Offline Flow Refinement & kritikka-mcp Integration

**Date:** 2026-10-01  
**Status:** Active  
**Priority:** P1 (High)

---

## Executive Summary

This plan addresses four major workstreams:
1. **Integrate `kritikka-mcp`** — Add the repository governance MCP server to syasyah-samaj
2. **Excel Import/Export** — Extend existing JSON/CSV import-export to support `.xlsx` (Excel) with proper dedup, validation, and offline support
3. **Comprehensive Testing** — Add unit/integration tests for all import/export/accounting modules
4. **Offline Flow Refinement** — Harden the offline-first architecture (outbox, sync, conflict resolution)

---

## 1. kritikka-mcp Integration

### 1.1 Add kritikka-mcp as a Dev Dependency
- Install `kritikka-mcp` in the syasyah-samaj workspace (root or billing app)
- Add to `package.json` devDependencies

### 1.2 Create `mcp-rules.json` at Repo Root
- Define governance rules for the syasyah-samaj codebase
- Rule types: `forbidden`, `requireAdr`, `requireTest`, `requireDocUpdate`, `layerDependency`
- Cover: `src/collections/**`, `apps/billing/src/pages/**`, `apps/billing/src/lib/**`

### 1.3 Configure MCP Client Access
- Add to `.vscode/mcp.json` or Claude Code config for agent access
- Ensure agents can invoke kritikka-mcp tools (validation, planning, context retrieval)

### 1.4 CI Integration
- Add kritikka-mcp validation step to GitHub Actions
- Run `validate_change` on PR diffs

---

## 2. Excel Import/Export Enhancement

### 2.1 Current State Analysis
- **Export:** `buildExportJson` (JSON), `buildExportCsv` (CSV with BOM)
- **Import:** `parseImportFile` handles JSON + CSV; `classifyRecords` for dedup
- **Missing:** Excel (.xlsx) support — both read and write

### 2.2 Add Excel Library
- Add `xlsx` (SheetJS) or `exceljs` as dependency
- Prefer `exceljs` for richer formatting, streaming, and style control

### 2.3 Implement `buildExportExcel` Function
```typescript
// apps/billing/src/lib/importExport.ts
export function buildExportExcel<T extends Record<string, unknown>>(
  collection: string,
  docs: T[],
  options?: {
    sheetName?: string
    columns?: { key: string; header: string; width?: number }[]
    tenantName?: string
  }
): Blob
```
- Create workbook with metadata sheet + data sheet
- Apply column widths, header styling, freeze panes
- Support Nepali/Devanagari text (UTF-8)
- Add BOM for Excel compatibility

### 2.4 Implement `parseExcelFile` Function
```typescript
export async function parseExcelFile<T>(file: File): Promise<ParsedImport<T>>
```
- Read `.xlsx` using exceljs
- Handle multiple sheets (first sheet = data, optional "meta" sheet)
- Reuse header normalization logic from `parseCsvText`
- Return same `ParsedImport` structure for unified handling

### 2.5 Update `parseImportFile` to Handle Excel
- Detect `.xlsx`/`.xls` extension
- Route to `parseExcelFile`
- Maintain backward compatibility with JSON/CSV

### 2.6 Update DataManagement UI
- Add "Export Excel (.xlsx)" buttons alongside JSON/CSV
- Add file input accept=".xlsx,.xls,.csv,.json"
- Show format badge in import preview

### 2.7 Collection-Specific Export Configurations
Define column mappings per collection for clean Excel output:

| Collection | Key Fields | Notes |
|------------|-----------|-------|
| `members` | memberId, fullName, phone, email, address, ward, bloodGroup, membershipType, appliedDateBs | Include family members as nested rows or separate sheet |
| `parties` | name, phone, email, address, pan, gstin, type, openingBalance | |
| `items` | name, code, unit, rate, taxType, openingStock, openingValue | |
| `accounts` | code, name, type, class, group, openingBalance | Hierarchical (group → accounts) |
| `documents` / `journal-entries` | voucherNo, date, type, party, narration, lines[debit/credit/account] | Multi-sheet: header + lines |

---

## 3. Deduplication & Data Integrity (Import)

### 3.1 Enhance `classifyRecords` for Excel
- Same logic works — `classifyRecords` is format-agnostic
- Ensure `DEDUP_KEYS` covers all collections

### 3.2 Add Import Validation Rules
```typescript
// Per-collection validation schemas (zod)
const memberImportSchema = z.object({
  memberId: z.string().optional(), // Server generates if missing
  fullName: z.string().min(1),
  phone: z.string().regex(/^\+?[0-9]{10,15}$/).optional(),
  email: z.string().email().optional().or(z.literal('')),
  // ... etc
})
```
- Validate each row before import
- Return row-level errors with line numbers
- Show in ImportPreviewModal

### 3.3 Import Actions per Record
- **Create** — New record (no match)
- **Update** — Match by ID or unique key (phone, memberId, code)
- **Skip** — Duplicate, user chooses not to import
- **Merge** — (Future) Combine fields from import + existing

### 3.4 Dry-Run / Preview Enhancement
- Show validation errors per row (red rows)
- Show warnings (amber rows) — e.g., missing optional fields
- Show "will create/update/skip" badges
- Allow per-row action override

---

## 4. Accounting-Specific Excel Import/Export

### 4.1 Chart of Accounts (CoA)
- Export: Hierarchical (groups → accounts) with indentation
- Import: Support parent group reference by name or code
- Validate: No duplicate codes, valid types, balanced tree

### 4.2 Journal Entries / Vouchers
- Export: Two sheets — "Headers" + "Lines"
- Headers: voucherNo, date, type, party, narration, fy
- Lines: lineNo, accountCode, debit, credit, narration
- Import: Reconstruct vouchers from lines; validate double-entry (Σdebit = Σcredit)

### 4.3 Opening Balances
- Export: accountCode, debit, credit, asOfDate
- Import: Validate accounts exist; create opening balance records

### 4.4 Bank Reconciliation
- Export: statement lines + matched/unmatched status
- Import: Match by date + amount + narration (fuzzy)

### 4.5 Stock / Inventory
- Export: itemCode, warehouse, qty, rate, value (AVCO)
- Import: Validate items exist; create stock movements

---

## 5. Comprehensive Testing Strategy

### 5.1 Test Infrastructure
- **Unit Tests:** Vitest (already configured)
- **Integration Tests:** Test import/export round-trips
- **E2E Tests:** Playwright (existing setup, needs local DB)
- **Test Data:** Fixtures in `apps/billing/tests/fixtures/`

### 5.2 Module Test Coverage Targets

| Module | Unit Tests | Integration Tests | Key Scenarios |
|--------|-----------|-------------------|---------------|
| `importExport.ts` | ✅ | ✅ | parseCsv, parseExcel, buildExportJson/Csv/Excel, classifyRecords, executeImport |
| `ImportPreviewModal` | ✅ | | render states, action selection, progress, error display |
| `DataManagement` | ✅ | | export buttons, file upload, modal integration |
| `csv.ts` (existing) | ✅ | | downloadCsv, export round-trip |
| Accounting reports | | ✅ | CoA export/import, journal export/import, opening balances |

### 5.3 Specific Test Cases to Implement

#### `importExport.test.ts`
```typescript
describe('buildExportExcel', () => {
  it('creates valid .xlsx with metadata sheet')
  it('applies column widths and header styles')
  it('handles Nepali/Devanagari text')
  it('handles empty docs array')
  it('supports custom column config')
})

describe('parseExcelFile', () => {
  it('parses simple .xlsx to ParsedImport')
  it('handles header normalization (Nepali/English)')
  it('skips empty rows')
  it('reads meta sheet if present')
  it('throws on corrupt file')
})

describe('parseImportFile (unified)', () => {
  it('routes .json → JSON parser')
  it('routes .csv → CSV parser')
  it('routes .xlsx → Excel parser')
  it('handles bare array JSON')
  it('handles {docs:[], _export:{}} JSON')
})

describe('classifyRecords', () => {
  it('detects exact ID duplicates')
  it('detects fuzzy name/phone duplicates for members')
  it('detects code duplicates for accounts/items')
  it('returns newRecords for non-matches')
  it('handles empty existing array')
})

describe('executeImport', () => {
  it('creates new records via POST')
  it('updates existing via PATCH by ID')
  it('skips when action=skip')
  it('tracks created/updated/skipped/errors')
  it('calls onProgress callback')
})
```

#### `accounting-import.test.ts`
```typescript
describe('CoA Excel round-trip', () => {
  it('exports CoA with groups and accounts')
  it('imports CoA — creates groups then accounts')
  it('import preserves hierarchy (group parent refs)')
  it('rejects duplicate account codes')
  it('validates account types (asset/liability/equity/income/expense)')
})

describe('Journal/Voucher Excel round-trip', () => {
  it('exports vouchers with header + lines sheets')
  it('imports balanced journal (Σdebit = Σcredit)')
  it('rejects unbalanced journal lines')
  it('links lines to accounts by code')
  it('assigns fiscal year from header or defaults')
})

describe('Opening Balances Excel', () => {
  it('exports opening balances with asOfDate')
  it('imports — creates OpeningBalance records')
  it('validates accounts exist')
})
```

#### `offline-import.test.ts`
```typescript
describe('Offline import flow', () => {
  it('queues import to outbox when offline')
  it('processes queued imports on reconnect')
  it('handles conflict resolution after sync')
  it('preserves import metadata (tenant, user, timestamp)')
})
```

### 5.4 Test Commands
```bash
# Unit tests
pnpm --filter billing test

# E2E tests (needs local Postgres)
E2E_DATABASE_URI=postgresql://postgres:postgres@localhost:5432/billing_e2e pnpm --filter billing test:e2e

# Coverage
pnpm --filter billing test --coverage
```

---

## 6. Offline Flow Refinement

### 6.1 Current Offline Architecture
- **Cache Layer:** IndexedDB (collections, reports) + localStorage (globals, calendar)
- **Outbox:** IndexedDB queue for POST/PATCH/DELETE
- **Sync:** Background flush when online
- **API:** `api()` function handles cache-first reads + outbox writes

### 6.2 Gaps to Address

| Gap | Solution |
|-----|----------|
| Import operations not offline-capable | Queue import batches to outbox; process on reconnect |
| Large Excel imports block UI | Chunk import (50 rows/batch); show progress; allow background |
| Conflict resolution after sync | Server returns conflicts; UI prompts for resolution |
| No import status persistence | Store import job in IndexedDB with status (pending/synced/failed) |
| Offline export | Snapshot current cache to Excel/JSON for download |

### 6.3 Implementation Tasks

#### 6.3.1 Offline Import Queue
```typescript
// apps/billing/src/lib/offlineImport.ts
interface OfflineImportJob {
  id: string
  collection: string
  records: { doc: AnyDoc; action: ImportAction }[]
  status: 'pending' | 'processing' | 'synced' | 'failed' | 'conflict'
  createdAt: number
  syncedAt?: number
  result?: ImportResult
  conflicts?: Conflict[]
}
```
- Add to outbox as special "import" operation type
- Process in background when online
- Handle server conflicts (409) → store for user resolution

#### 6.3.2 Chunked Import Processing
- Split large imports (1000+ rows) into batches of 50
- Each batch = one outbox entry
- Progress tracked per batch

#### 6.3.3 Conflict Resolution UI
- New modal: "Sync Conflicts — Import"
- Show server version vs. local version
- Actions: Use Server / Use Local / Merge
- Apply resolution → retry sync

#### 6.3.4 Offline Export
- "Export Current Data (Offline)" button
- Reads from IndexedDB cache
- Generates Excel/JSON/CSV locally
- Useful for backup before destructive operations

---

## 7. Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Add `exceljs` dependency
- [ ] Add `kritikka-mcp` dev dependency
- [ ] Create `mcp-rules.json`
- [ ] Set up test fixtures directory
- [ ] Write core `importExport.test.ts` (Excel parse/build, classifyRecords, executeImport)

### Phase 2: Excel Import/Export Core (Week 1-2)
- [ ] Implement `buildExportExcel`
- [ ] Implement `parseExcelFile`
- [ ] Update `parseImportFile` for Excel
- [ ] Add collection-specific export configs
- [ ] Update DataManagement UI (Excel buttons, file accept)

### Phase 3: Accounting Excel Features (Week 2)
- [ ] CoA hierarchical export/import
- [ ] Journal/Voucher two-sheet export/import
- [ ] Opening balances export/import
- [ ] Validation schemas (zod) per collection

### Phase 4: Import Preview & Dedup Enhancement (Week 2-3)
- [ ] Row-level validation errors in preview
- [ ] Per-row action override (create/update/skip)
- [ ] Dry-run validation report
- [ ] Improve dedup for accounting collections

### Phase 5: Testing (Week 3)
- [ ] Complete unit test coverage for importExport
- [ ] Integration tests for accounting round-trips
- [ ] E2E test for import/export flow (with local DB)
- [ ] Offline import queue tests

### Phase 6: Offline Flow Hardening (Week 3-4)
- [ ] Offline import queue in outbox
- [ ] Chunked import processing
- [ ] Conflict resolution UI
- [ ] Offline export from cache
- [ ] Sync status indicators

### Phase 7: kritikka-mcp Integration (Week 4)
- [ ] Configure MCP client access
- [ ] CI validation step
- [ ] Documentation for team

---

## 8. File Inventory — What Changes Where

### New Files
```
apps/billing/src/lib/importExport.ts           ← extend (add Excel functions)
apps/billing/src/lib/offlineImport.ts          ← NEW: offline import queue
apps/billing/src/lib/validationSchemas.ts      ← NEW: zod schemas per collection
apps/billing/src/components/ImportPreviewModal.tsx  ← extend (validation errors, per-row actions)
apps/billing/src/components/SyncConflictsModal.tsx  ← NEW: conflict resolution UI
apps/billing/tests/fixtures/                   ← NEW: test Excel/JSON/CSV samples
apps/billing/tests/unit/importExport.test.ts   ← NEW
apps/billing/tests/integration/accounting-import.test.ts ← NEW
apps/billing/tests/integration/offline-import.test.ts ← NEW
mcp-rules.json                                 ← NEW (repo root)
.vscode/mcp.json                               ← NEW (or update)
```

### Modified Files
```
apps/billing/src/pages/DataManagement.tsx      ← Excel buttons, file accept
apps/billing/src/lib/api.ts                    ← (potential) offline import queue integration
apps/billing/src/lib/useCachedList.ts          ← (potential) cache snapshot for offline export
package.json                                   ← add exceljs, kritikka-mcp
.github/workflows/ci.yml                       ← add kritikka-mcp validation
```

---

## 9. Acceptance Criteria

### Excel Import/Export
- [ ] User can download `.xlsx` for Members, Parties, Items, Accounts, Journal Entries
- [ ] User can upload `.xlsx` and see preview with validation
- [ ] Duplicate detection works for Excel imports (same as JSON/CSV)
- [ ] Nepali/Devanagari text renders correctly in Excel
- [ ] CoA imports preserve group hierarchy
- [ ] Journal imports validate double-entry balance

### Testing
- [ ] All `importExport.ts` functions have unit tests (≥90% coverage)
- [ ] Accounting round-trip tests pass (export → import → data matches)
- [ ] Offline import queue tests pass
- [ ] E2E import/export flow works (manual verification)

### Offline Flow
- [ ] Import works offline → queued → syncs on reconnect
- [ ] Large imports chunked and processed in background
- [ ] Conflicts after sync shown in resolution UI
- [ ] Offline export downloads cached data

### kritikka-mcp
- [ ] `mcp-rules.json` exists and validates repo
- [ ] `npx kritikka-mcp --root .` runs successfully
- [ ] CI runs validation on PRs

---

## 10. Dependencies & Risks

| Dependency | Risk | Mitigation |
|------------|------|------------|
| `exceljs` bundle size | +200KB | Lazy-load only on import/export pages |
| Large Excel files (>5MB) | Memory/performance | Stream processing, chunked import |
| Offline IndexedDB quota | Storage full | Cleanup old jobs, warn user |
| Playwright E2E needs Postgres | CI complexity | Use GitHub Actions Postgres service |
| kritikka-mcp Node ≥20 | Env mismatch | Verify Node version in CI |

---

## 11. Todo List (Actionable)

See `TODO.md` in the same directory for the actionable checklist.

---

## 12. Related Documents

- `docs/plans/2026-09-09-remaining-work.md` — Items #9 (Members CSV import) and #10 (Component split) are related
- `apps/billing/src/lib/importExport.ts` — Current implementation
- `apps/billing/src/pages/DataManagement.tsx` — Current UI
- `sketches/004-import-export-workflow/index.html` — Wireframe reference
- `sketches/005-high-fidelity-dashboard-import/index.html` — High-fidelity reference