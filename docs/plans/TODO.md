# TODO: Excel Import/Export, Tests, Offline Flow & kritikka-mcp Integration

**Generated:** 2026-10-01  
**Status:** Active  
**Source Plan:** `docs/plans/2026-10-01-import-export-excel-tests-kritikka.md`

---

## Phase 1: Foundation (Week 1)

### Setup & Dependencies
- [ ] Add `exceljs` to `apps/billing/package.json` dependencies
- [ ] Add `kritikka-mcp` to `package.json` devDependencies (workspace root)
- [ ] Run `pnpm install` to install new dependencies
- [ ] Create `apps/billing/tests/fixtures/` directory with sample files:
  - [ ] `members-sample.xlsx` (with Nepali names, phone, blood group)
  - [ ] `coa-sample.xlsx` (hierarchical groups + accounts)
  - [ ] `journal-sample.xlsx` (header + lines sheets, balanced)
  - [ ] `opening-balances-sample.xlsx`
  - [ ] Corresponding JSON/CSV versions for regression testing

### kritikka-mcp Integration
- [ ] Create `mcp-rules.json` at repo root (`/Users/aayurtshrestha/Projects/supreme/syasyah-samaj/mcp-rules.json`)
  - [ ] `forbidden`: `dist/**`, `build/**`, `node_modules/**`, `.next/**`
  - [ ] `requireTest`: `apps/billing/src/**/*.ts` → test match `**/*.test.ts`
  - [ ] `requireAdr`: `apps/billing/src/collections/**` → ADR for data model
  - [ ] `layerDependency`: tools → engine → foundation (define layers)
  - [ ] `requireDocUpdate`: `apps/billing/src/lib/**` → `docs/ARCHITECTURE.md`
- [ ] Test: `npx kritikka-mcp --root .` runs without errors
- [ ] Add `.vscode/mcp.json` for VS Code / Claude Code integration

### Test Infrastructure
- [ ] Verify `pnpm --filter billing test` runs (Vitest)
- [ ] Add test script aliases if needed

---

## Phase 2: Excel Import/Export Core (Week 1-2)

### Implement Excel Export (`apps/billing/src/lib/importExport.ts`)
- [ ] Add `buildExportExcel` function:
  - [ ] Creates workbook with "Meta" sheet + "Data" sheet
  - [ ] Meta sheet: collection, tenant, exportedAt, count, version
  - [ ] Data sheet: headers, rows, column widths, header style, freeze pane
  - [ ] UTF-8 BOM for Devanagari support
  - [ ] Accepts optional `columns` config for custom headers/widths
- [ ] Add collection-specific export configs (exportConfigs object):
  - [ ] `members`: memberId, fullName, phone, email, address, ward, bloodGroup, membershipType, appliedDateBs
  - [ ] `parties`: name, phone, email, address, pan, gstin, type, openingBalance
  - [ ] `items`: name, code, unit, rate, taxType, openingStock, openingValue
  - [ ] `accounts`: code, name, type, class, group, openingBalance (with group hierarchy)
  - [ ] `documents`/`journal-entries`: Two sheets (Headers + Lines)

### Implement Excel Import (`apps/billing/src/lib/importExport.ts`)
- [ ] Add `parseExcelFile` function:
  - [ ] Uses `exceljs` to read workbook
  - [ ] Reads first worksheet as data (skips "Meta" if present)
  - [ ] Reuses header normalization from `parseCsvText`
  - [ ] Returns `ParsedImport` (same as CSV/JSON)
- [ ] Update `parseImportFile`:
  - [ ] Detect `.xlsx`/`.xls` extension
  - [ ] Route to `parseExcelFile`
  - [ ] Maintain backward compatibility

### Unit Tests for Core Functions (`apps/billing/tests/unit/importExport.test.ts`)
- [ ] `buildExportExcel` tests:
  - [ ] Creates valid .xlsx blob
  - [ ] Meta sheet has correct metadata
  - [ ] Data sheet has headers + rows
  - [ ] Column widths applied
  - [ ] Header style applied (bold, background)
  - [ ] Freeze pane on row 1
  - [ ] Handles empty docs array
  - [ ] Handles Nepali/Devanagari text
  - [ ] Custom column config respected
- [ ] `parseExcelFile` tests:
  - [ ] Parses simple .xlsx
  - [ ] Header normalization (Nepali/English aliases)
  - [ ] Skips empty rows
  - [ ] Reads meta sheet if present (validates collection match)
  - [ ] Throws on corrupt file
  - [ ] Handles date cells (converts to ISO string)
- [ ] `parseImportFile` unified tests:
  - [ ] Routes .json → JSON parser
  - [ ] Routes .csv → CSV parser
  - [ ] Routes .xlsx → Excel parser
  - [ ] Handles bare array JSON
  - [ ] Handles `{docs:[], _export:{}}` JSON
- [ ] `classifyRecords` tests (extend existing):
  - [ ] Exact ID duplicates
  - [ ] Fuzzy name/phone for members
  - [ ] Code duplicates for accounts/items
  - [ ] New records for non-matches
  - [ ] Empty existing array
- [ ] `executeImport` tests:
  - [ ] Creates via POST
  - [ ] Updates via PATCH by ID
  - [ ] Skips when action=skip
  - [ ] Tracks created/updated/skipped/errors
  - [ ] Calls onProgress callback

---

## Phase 3: Accounting Excel Features (Week 2)

### CoA Hierarchical Export/Import
- [ ] Export: Groups with accounts nested (indented rows or group column)
- [ ] Import: Create groups first, then accounts with group reference
- [ ] Validation: No duplicate codes, valid types, parent group exists
- [ ] Test: CoA round-trip (export → import → verify structure)

### Journal/Voucher Two-Sheet Export/Import
- [ ] Export: "Headers" sheet + "Lines" sheet
- [ ] Headers: voucherNo, date, type, party, narration, fy, status
- [ ] Lines: lineNo, accountCode, debit, credit, narration
- [ ] Import: Reconstruct vouchers, validate Σdebit = Σcredit per voucher
- [ ] Test: Journal round-trip with balanced/unbalanced validation

### Opening Balances Export/Import
- [ ] Export: accountCode, debit, credit, asOfDate, fy
- [ ] Import: Validate accounts exist, create OpeningBalance records
- [ ] Test: Opening balances round-trip

### Validation Schemas (`apps/billing/src/lib/validationSchemas.ts`)
- [ ] Create zod schemas per collection:
  - [ ] `memberImportSchema`
  - [ ] `partyImportSchema`
  - [ ] `itemImportSchema`
  - [ ] `accountImportSchema`
  - [ ] `journalImportSchema` (header + lines)
  - [ ] `openingBalanceImportSchema`
- [ ] Add `validateImportRows(docs, schema)` helper
- [ ] Return row-level errors with line numbers

---

## Phase 4: Import Preview & Dedup Enhancement (Week 2-3)

### ImportPreviewModal Enhancements (`apps/billing/src/components/ImportPreviewModal.tsx`)
- [ ] Show validation errors per row (red badge + error message)
- [ ] Show warnings per row (amber badge)
- [ ] Add "Validate All" button → runs validation schemas
- [ ] Per-row action dropdown: Create / Update / Skip (already exists, enhance)
- [ ] Bulk actions: "Set all valid to Create", "Set all duplicates to Update"
- [ ] Show line numbers from original file
- [ ] Progress bar during import (already exists)

### DataManagement UI Updates (`apps/billing/src/pages/DataManagement.tsx`)
- [ ] Add "Export Excel (.xlsx)" buttons for each collection
- [ ] Update file input: `accept=".xlsx,.xls,.csv,.json"`
- [ ] Show format badge in import preview (Excel/CSV/JSON)
- [ ] Add collection selector for import (currently guesses from filename)
- [ ] Toast notifications for export/import start/complete/error

---

## Phase 5: Testing (Week 3)

### Integration Tests (`apps/billing/tests/integration/`)
- [ ] `accounting-import.test.ts`:
  - [ ] CoA Excel round-trip
  - [ ] Journal/Voucher Excel round-trip (balanced)
  - [ ] Journal import rejects unbalanced
  - [ ] Opening balances round-trip
  - [ ] Validation errors caught per row
- [ ] `offline-import.test.ts`:
  - [ ] Import queued to outbox when offline
  - [ ] Queued imports process on reconnect
  - [ ] Conflict resolution after sync
  - [ ] Import job metadata persisted

### E2E Tests (Manual / Playwright)
- [ ] Set up local Postgres for E2E: `E2E_DATABASE_URI=postgresql://postgres:postgres@localhost:5432/billing_e2e`
- [ ] Run `pnpm --filter billing test:e2e`
- [ ] Verify import/export flow in browser:
  - [ ] Export Members → Excel → Open in Excel → Verify data
  - [ ] Modify Excel → Import → Preview → Confirm → Verify in Members page
  - [ ] Export Journal → Excel (2 sheets) → Import → Verify in Vouchers
  - [ ] Offline: Disconnect network → Import → Reconnect → Verify sync

### Coverage
- [ ] Run `pnpm --filter billing test --coverage`
- [ ] Target: ≥90% for `importExport.ts`, ≥80% for validation schemas

---

## Phase 6: Offline Flow Hardening (Week 3-4)

### Offline Import Queue (`apps/billing/src/lib/offlineImport.ts`)
- [ ] Define `OfflineImportJob` interface
- [ ] Add `queueImportJob(collection, records)` → stores in IndexedDB outbox
- [ ] Add `processImportQueue()` → called on online event
- [ ] Chunk large imports: 50 records per batch
- [ ] Track progress per batch in job record

### API Integration
- [ ] Update `api()` or create `importApi()` to handle import operations
- [ ] Import POST/PATCH goes through outbox when offline
- [ ] Server conflict response (409) → store conflict in job

### Conflict Resolution UI (`apps/billing/src/components/SyncConflictsModal.tsx`)
- [ ] New modal component
- [ ] List conflicts: server version vs local version
- [ ] Per-conflict actions: Use Server / Use Local / Merge (manual)
- [ ] "Resolve All" with same action
- [ ] Apply resolutions → retry sync

### Offline Export
- [ ] Add "Export Current Data (Offline)" to DataManagement
- [ ] Read from IndexedDB cache (use `useCachedList` data)
- [ ] Generate Excel/JSON/CSV locally (no network)

### Sync Status Indicators
- [ ] Show sync status in header/footer (synced / pending / conflict)
- [ ] Badge on DataManagement: "X imports pending sync"
- [ ] Auto-retry with exponential backoff

---

## Phase 7: kritikka-mcp CI Integration (Week 4)

### CI Pipeline
- [ ] Add GitHub Actions step: `npx kritikka-mcp validate-change --diff <PR_DIFF>`
- [ ] Or: `npx kritikka-mcp retrieve-relevant-context --task <task>`
- [ ] Fail PR if validation errors (severity: error)
- [ ] Warn on warnings (severity: warning)

### Documentation
- [ ] Add `docs/KRITTIKA_MCP.md` with usage guide
- [ ] Document `mcp-rules.json` rule types and examples
- [ ] Add to AGENTS.md or CLAUDE.md for agent awareness

---

## Quick Wins (Can Do Anytime)

- [ ] Add Excel export to existing report pages (BalanceSheet, ProfitLoss, etc.)
- [ ] Add "Download Template" buttons for each collection (blank Excel with headers)
- [ ] Improve CSV export: add BOM, better header mapping
- [ ] Add import history log (last 10 imports with status)

---

## Blockers / Questions

- [ ] **Decision:** `exceljs` vs `xlsx` (SheetJS)? → `exceljs` chosen for streaming/styles
- [ ] **Decision:** Where to store offline import queue? → IndexedDB outbox (existing pattern)
- [ ] **Decision:** Conflict resolution — merge strategy? → Start with Use Server/Use Local, merge later
- [ ] **Dependency:** Local Postgres for E2E tests → Need to install/configure

---

## Progress Tracking

| Phase | Total Tasks | Done | In Progress | Blocked |
|-------|-------------|------|-------------|---------|
| 1: Foundation | 8 | 0 | 0 | 0 |
| 2: Excel Core | 15 | 0 | 0 | 0 |
| 3: Accounting Excel | 10 | 0 | 0 | 0 |
| 4: Preview/UI | 8 | 0 | 0 | 0 |
| 5: Testing | 12 | 0 | 0 | 0 |
| 6: Offline Flow | 10 | 0 | 0 | 0 |
| 7: CI/kritikka | 5 | 0 | 0 | 0 |
| **Total** | **68** | **0** | **0** | **0** |

---

## Notes

- Update this file as tasks are completed
- Check off `[x]` when done
- Add new tasks as discovered
- Reference related GitHub issues/PRs if created