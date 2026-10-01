# Jules-Ready Plan for Syasyah Samaj

**Generated:** 2026-09-30  
**Objective:** Make the project ready for Google Jules dispatch with kritikka-mcp governance, Excel import/export, full test coverage, and refined offline flow.

---

## 📋 Executive Summary

This plan transforms syasyah-samaj into a Jules-ready repository by:
1. **Integrating `kritikka-mcp`** — Repository governance via `mcp-rules.json`
2. **Excel Import/Export** — Full accounting data workflow with dedup
3. **Test Coverage** — Unit + integration + E2E for every module
4. **Offline Flow** — Robust sync, conflict resolution, background sync
5. **No Data Duplication** — Dedup on import with user choice

---

## 🎯 Phase 1: Kritikka-MCP Integration (Governance Layer)

### 1.1 Install & Configure kritikka-mcp
- [ ] `npm install -D kritikka-mcp` (dev dependency)
- [ ] Create `mcp-rules.json` at repo root
- [ ] Define governance rules:
  - **Forbidden paths**: `dist/**`, `node_modules/**`, `.next/**`, `build/**`
  - **Require ADR**: Architecture changes → ADR reference
  - **Require Tests**: All `src/**/*.tsx` + `src/**/*.ts` need tests
  - **Require Doc Updates**: Collection changes → update ARCHITECTURE.md
  - **Layer Dependencies**: Enforce import direction (ui → lib → api)

### 1.2 Create Required Governance Files
- [ ] `AGENTS.md` (already exists at root — verify completeness)
- [ ] `docs/ARCHITECTURE.md` — Architecture decision records
- [ ] `docs/CONVENTIONS.md` — Coding conventions
- [ ] `docs/TESTING.md` — Testing policy
- [ ] `docs/DEVELOPMENT.md` — Developer workflow
- [ ] `RUNBOOK.md` — Operational procedures
- [ ] `CONTRIBUTING.md` — Human contribution guide
- [ ] `docs/adr/` directory with initial ADRs

### 1.3 MCP Client Configuration
- [ ] Add to `.vscode/mcp.json` or `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "krittika": {
      "command": "npx",
      "args": ["-y", "kritikka-mcp", "--root", "."]
    }
  }
}
```
- [ ] Verify server starts: `npx kritikka-mcp --root .`

### 1.4 Jules Dispatch Gates
- [ ] Implement `validate_jules_ready` pre-dispatch check
- [ ] Implement `prepare_jules_task` for task packaging
- [ ] Implement `validate_jules_result` post-dispatch verification

---

## 📊 Phase 2: Excel Import/Export System

### 2.1 Core Infrastructure
- [ ] Add `xlsx` and `exceljs` to dependencies (apps/billing)
- [ ] Create `src/lib/excelImportExport.ts` with:
  - `exportToExcel(collection, docs, options)` — multi-sheet workbook
  - `importFromExcel(file, options)` — parse + validate + dedup
  - `buildTemplate(collection)` — downloadable template with instructions

### 2.2 Collections to Support
| Collection | Export | Import | Key Fields for Dedup |
|------------|--------|--------|---------------------|
| Members | ✅ | ✅ | memberId, phone, email |
| Parties | ✅ | ✅ | name, phone, gstNumber |
| Items | ✅ | ✅ | code, name |
| Accounts | ✅ | ✅ | code, name |
| Journal Entries | ✅ | ⚠️ (review) | voucherNumber + date |
| Vouchers/Documents | ✅ | ⚠️ (review) | voucherNumber |
| Opening Balances | ✅ | ✅ | accountId + fiscalYear |
| Membership Types | ✅ | ✅ | name |

### 2.3 Import Wizard UI (DataManagement page)
- [ ] **Step 1**: File upload + collection selection + template download
- [ ] **Step 2**: Column mapping (auto-detect headers → field mapping UI)
- [ ] **Step 3**: Conflict resolution rules:
  - Skip duplicates (default)
  - Update existing (by match key)
  - Append all (force create)
- [ ] **Step 4**: Validation preview — color-coded rows (valid/warning/error)
- [ ] **Step 5**: Confirm & execute with progress bar

### 2.4 Dedup Logic (Reuse + Extend `classifyRecords`)
- [ ] Exact match: `id` / `_id` 
- [ ] Business key match: configurable per collection
- [ ] Fuzzy match: name similarity (Levenshtein) for warnings
- [ ] User choice persisted per import session

### 2.5 Export Features
- [ ] Multi-sheet Excel: Data + Metadata + Template sheet
- [ ] Nepali digit support in exported numbers
- [ ] Date columns: both AD and BS (Nepali) formats
- [ ] Filtered exports (date range, tenant, status)
- [ ] One-click "Export All" → ZIP with all collections

---

## 🧪 Phase 3: Test Infrastructure & Coverage

### 3.1 Test Stack Setup
- [ ] **Unit/Integration**: Vitest (already in kritikka-mcp, adopt same)
- [ ] **E2E**: Playwright (already configured in apps/billing/e2e)
- [ ] **Component**: React Testing Library + Vitest
- [ ] **API**: MSW (Mock Service Worker) for offline-first testing

### 3.2 Test Structure
```
apps/billing/
├── src/
│   ├── lib/
│   │   ├── __tests__/           # Unit tests for utils
│   │   │   ├── api.test.ts
│   │   │   ├── importExport.test.ts
│   │   │   ├── excelImportExport.test.ts
│   │   │   ├── nepaliNumbers.test.ts
│   │   │   ├── offline/*.test.ts
│   │   │   └── sync/*.test.ts
│   │   └── ...
│   ├── components/
│   │   ├── __tests__/           # Component tests
│   │   │   ├── ImportPreviewModal.test.tsx
│   │   │   ├── NepaliDateInput.test.tsx
│   │   │   └── ...
│   │   └── ...
│   ├── pages/
│   │   ├── __tests__/           # Page integration tests
│   │   │   ├── DataManagement.test.tsx
│   │   │   ├── Vouchers.test.tsx
│   │   │   ├── Members.test.tsx
│   │   │   └── ...
│   │   └── ...
│   └── hooks/
│       └── __tests__/           # Custom hook tests
├── e2e/
│   ├── specs/
│   │   ├── 00-shell.spec.ts
│   │   ├── 01-settings.spec.ts
│   │   ├── 02-accounts.spec.ts
│   │   ├── 03-masters.spec.ts
│   │   ├── 04-vouchers.spec.ts
│   │   ├── 05-journal.spec.ts
│   │   ├── 06-reports.spec.ts
│   │   ├── 07-offline.spec.ts
│   │   ├── 08-desktop-storage.spec.ts
│   │   ├── 09-spa-sqlite.spec.ts
│   │   ├── 10-membership.spec.ts
│   │   ├── 11-import-export.spec.ts      # NEW
│   │   ├── 12-excel-import.spec.ts       # NEW
│   │   └── 90-defects.spec.ts
│   └── ...
└── vitest.config.ts
```

### 3.3 Critical Test Scenarios

#### Excel Import/Export Tests
- [ ] Export → Import roundtrip preserves data
- [ ] Duplicate detection: exact ID, business key, fuzzy name
- [ ] Conflict resolution: skip / update / append
- [ ] Invalid data: wrong types, missing required, malformed dates
- [ ] Large file handling (10k+ rows)
- [ ] Nepali digits in Excel → correct parsing
- [ ] BS date parsing in Excel
- [ ] Template download has correct headers + example rows

#### Offline Flow Tests
- [ ] Create voucher offline → sync on reconnect
- [ ] Edit offline → conflict with server edit
- [ ] Delete offline → sync delete
- [ ] Outbox ordering preserved
- [ ] Background sync every 60s
- [ ] Tab visibility sync trigger
- [ ] Cache invalidation on sync
- [ ] Report staleness detection

#### Accounting Module Tests
- [ ] Voucher posting (debit = credit)
- [ ] Opening balance carry-forward
- [ ] Fiscal year closing
- [ ] VAT calculation (13%)
- [ ] Party statement accuracy
- [ ] Trial balance = 0
- [ ] Bank reconciliation match

---

## 🔄 Phase 4: Offline Flow Refinement

### 4.1 Current State Analysis
- Existing: `apps/billing/src/lib/offline/` + `src/lib/sync/`
- Adapters: IndexedDB (web) + SQLite (Tauri desktop)
- Engine: `SyncEngine` + `CompatibilityEngine` wrapper

### 4.2 Improvements Needed
- [ ] **Conflict Resolution UI**: Visual diff for conflicts (server vs local)
- [ ] **Selective Sync**: Sync specific collections only
- [ ] **Sync Progress**: Real-time progress for large syncs
- [ ] **Offline Indicator**: Persistent banner with pending count
- [ ] **Manual Retry**: Per-entry retry with merged body
- [ ] **Discard with Confirmation**: Clear warning before discarding
- [ ] **Sync Logs**: Viewable history of sync attempts/results

### 4.3 Background Sync Hardening
- [ ] Exponential backoff on failures
- [ ] Network detection (online/offline events)
- [ ] Periodic pull (5 min) + push (60s) configurable
- [ ] Battery-aware sync (defer on low battery)
- [ ] Sync on app focus/visibility change

### 4.4 SQLite Adapter (Desktop)
- [ ] Verify Tauri SQL plugin integration
- [ ] Migration strategy for schema changes
- [ ] Vacuum/compact on large databases
- [ ] WAL mode for concurrent access

---

## 📝 Phase 5: Jules-Ready Checklist

### 5.1 Repository Requirements
- [ ] `mcp-rules.json` at root with all 5 rule types
- [ ] `docs/adr/` with at least 3 ADRs
- [ ] `AGENTS.md` complete with agent instructions
- [ ] `RUNBOOK.md` with deploy/rollback procedures
- [ ] `CONTRIBUTING.md` with PR template
- [ ] `docs/TESTING.md` with test policies
- [ ] `.github/workflows/ci.yml` running: typecheck, lint, test, build

### 5.2 CI/CD Pipeline
```yaml
# .github/workflows/ci.yml
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test          # vitest unit + integration
      - run: pnpm build
      - run: npx kritikka-mcp validate-change --changed-files ${{ github.event.pull_request.changed_files }}
  e2e:
    needs: validate
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env: { POSTGRES_DB: billing_e2e, POSTGRES_PASSWORD: test }
        ports: [5432:5432]
    steps:
      - uses: actions/checkout@v4
      - run: E2E_DATABASE_URI=postgresql://postgres:test@localhost:5432/billing_e2e pnpm --filter billing test:e2e
```

### 5.3 Jules Dispatch Verification
- [ ] Run `npx kritikka-mcp validate-jules-ready` — must pass
- [ ] Create sample task → `prepare-jules-task` → verify output
- [ ] Simulate Jules result → `validate-jules-result` — must pass

---

## 📦 Phase 6: Dependencies & Package Updates

### 6.1 Root package.json
- [ ] Add `kritikka-mcp` to devDependencies
- [ ] Add test scripts: `test`, `test:watch`, `test:coverage`
- [ ] Add `typecheck` script

### 6.2 apps/billing/package.json
- [ ] Add: `xlsx`, `exceljs`, `vitest`, `@testing-library/react`, `msw`
- [ ] Add test scripts
- [ ] Configure `vitest.config.ts` with coverage thresholds

---

## ✅ Acceptance Criteria (Definition of Done)

| Area | Criteria |
|------|----------|
| **Kritikka-MCP** | `npx kritikka-mcp --root .` starts; all 20 tools respond; `validate_change` catches violations |
| **Excel Import** | Import 1000 members from Excel → dedup works → no duplicates created |
| **Excel Export** | Export all collections → valid .xlsx with Nepali digits + BS dates |
| **Tests** | `pnpm test` ≥ 80% coverage; all E2E specs pass against local Postgres |
| **Offline** | Create 10 vouchers offline → reconnect → all sync without conflicts |
| **Jules** | `validate_jules_ready` passes; sample dispatch succeeds |

---

## 🗓️ Estimated Effort

| Phase | Effort | Priority |
|-------|--------|----------|
| 1. Kritikka-MCP Integration | 2 days | P0 |
| 2. Excel Import/Export | 4 days | P0 |
| 3. Test Infrastructure | 3 days | P0 |
| 4. Offline Flow Refinement | 3 days | P1 |
| 5. Jules-Ready Polish | 1 day | P0 |
| **Total** | **~13 days** | |

---

## 🚀 Quick Start Commands

```bash
# 1. Install kritikka-mcp
cd /Users/aayurtshrestha/Projects/supreme/syasyah-samaj
pnpm add -D kritikka-mcp

# 2. Create mcp-rules.json (see template in plan)

# 3. Verify
npx kritikka-mcp --root .

# 4. Add Excel deps
cd apps/billing
pnpm add xlsx exceljs
pnpm add -D vitest @testing-library/react @testing-library/user-event msw

# 5. Run tests
pnpm test
pnpm test:e2e
```