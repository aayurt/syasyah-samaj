# ADR-0004: Excel Import/Export with Deduplication Strategy

**Status:** Accepted
**Date:** 2026-10-01
**Deciders:** Architecture team

## Context

Community staff and accountants need to bulk import member records, opening balances, chart of accounts, and other master data from Excel/CSV files (not just technical JSON). They also need reliable exports for audits and committee meetings.

Key requirements:
- **No data duplication** on import — must detect and handle duplicates
- **User choice** on conflict resolution (skip/update/append)
- **Validation preview** before commit
- **Accounting-grade accuracy** — amounts, dates, balances must be exact
- **Nepali support** — Devanagari digits, BS dates in Excel

## Decision

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Import/Export Layer                    │
├─────────────────────────────────────────────────────────┤
│  excelImportExport.ts  │  importExport.ts (CSV/JSON)    │
│  - parseExcel()        │  - parseCsvText()              │
│  - buildWorkbook()     │  - buildExportCsv/Json()       │
│  - buildTemplate()     │  - classifyRecords()           │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                  Deduplication Engine                   │
├─────────────────────────────────────────────────────────┤
│  classifyRecords(imported, existing, collection)       │
│  Returns: { newRecords, exactDuplicates, similarRecords }│
│  Keys per collection in DEDUP_KEYS config              │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                  Import Preview UI                      │
├─────────────────────────────────────────────────────────┤
│  ImportPreviewModal                                     │
│  - Step 1: File + Collection                            │
│  - Step 2: Column Mapping                               │
│  - Step 3: Conflict Rules (skip/update/append)         │
│  - Step 4: Validation Preview (color-coded)            │
│  - Step 5: Execute with Progress                        │
└─────────────────────────────────────────────────────────┘
```

### Deduplication Strategy

**Three-tier matching:**

1. **Exact ID Match** — `id` or `_id` field matches existing record
   - Action: Update (if user chooses) or Skip
   
2. **Business Key Match** — Collection-specific unique fields:
   - Members: `memberId`, `phone`, `email`
   - Parties: `name` + `phone`, `gstNumber`
   - Items: `code`, `name`
   - Accounts: `code`, `name`
   - Opening Balances: `accountId` + `fiscalYear`
   
3. **Fuzzy Match** — Name similarity (Levenshtein distance ≤ 2)
   - Warning only, user decides

### Conflict Resolution Options

| Option | Behavior | Use Case |
|--------|----------|----------|
| **Skip Duplicates** | Keep existing, ignore imported | New member registration (don't overwrite) |
| **Update Existing** | Merge imported into existing | Membership renewal, address updates |
| **Append All** | Force create new records | Historical data load, test data |

### Excel Format

**Export (.xlsx):**
- Sheet 1: Data (all fields, typed)
- Sheet 2: Metadata (exportedAt, tenant, count, version)
- Sheet 3: Template (headers + 2 example rows + instructions)
- Nepali digits option (per-tenant setting)
- BS date columns alongside AD dates

**Import (.xlsx, .xls, .csv):**
- Header detection (row 1)
- Column mapping UI (file column → system field)
- Type coercion (numbers, dates, booleans)
- Validation: required fields, formats, ranges, cross-field rules

### Offline Integration

- Import executes via `offlineRequest()` → queued in outbox
- Large imports chunked (500 records/batch)
- Progress tracked via SyncEngine state
- Conflicts resolved in ConflictResolutionModal

## Consequences

**Positive:**
- Non-technical users can manage data
- Zero duplicates with proper config
- Audit trail via outbox + import logs

**Negative:**
- Complex dedup logic per collection
- Large file handling (memory)
- Mapping UI maintenance

## Related

- ADR-0001: Data Model Governance (dedup keys in mcp-rules)
- ADR-0002: Offline-First (import uses outbox)
- ADR-0003: Nepali Calendar (BS dates in Excel)
- `apps/billing/src/lib/excelImportExport.ts` — new implementation
- `apps/billing/src/lib/importExport.ts` — existing CSV/JSON
- `apps/billing/src/components/ImportPreviewModal.tsx` — UI
- `apps/billing/src/pages/DataManagement.tsx` — page integration