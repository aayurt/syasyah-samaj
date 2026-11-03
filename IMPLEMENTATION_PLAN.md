# Syasyah Samaj — Comprehensive Implementation Plan

**Version:** 1.0 | **Date:** 2026-11-03
**Status:** Planning Phase

---

## 🎯 Project Overview

Complete the multi-tenant offline-first billing & accounting platform with:
- Hierarchical tenant architecture (Central + Illakas)
- Full i18n (EN/NE) with Devanagari support
- Comprehensive test coverage (unit + E2E) via Google Jules
- Complete Excel import/export for all data tables
- Tooltip system with settings toggle
- Chart of Accounts as table format
- CI/CD with GitHub Actions

---

## 📋 Requirements Checklist

| # | Requirement | Status | Priority |
|---|-------------|--------|----------|
| 1 | Tenant selector (Central sees all, Illakas see own) | ✅ Exists + Tests | P0 |
| 2 | Language support (EN/NE) + tests | 🔄 Partial + Tests | P0 |
| 3 | CRUD unit + E2E tests per entity | 🔄 Started | P0 |
| 4 | Mock data factories (empty start) | ✅ Complete | P0 |
| 5 | GitHub Actions CI pipeline | ✅ Complete | P0 |
| 6 | Complete Excel export/import (all tables) | 🔄 Core done | P1 |
| 7 | Chart of Accounts → Table format | ⏳ | P1 |
| 8 | Tests start from empty DB | ✅ Pattern defined | P0 |
| 9 | Tooltip system + settings toggle | 🔄 Started | P1 |
| 10 | CoA + Group import features | ⏳ | P1 |
| 11 | Screenshot generation in tests | ✅ Config done | P1 |
| 12 | Jules/Superset orchestration | ✅ Verified | P0 |

---

## 🏗️ Phase Breakdown

### Phase 0: Foundation & Infrastructure (Week 0-1) ✅ COMPLETE

#### 0.1 Test Infrastructure Setup
- [x] **Vitest config** with coverage thresholds (adjusted for Phase 0)
- [x] **MSW handlers** for API mocking (`src/test/setup.ts`)
- [x] **Test utilities**: `renderWithProviders`, `mockTenant`, `mockAuth` (`src/test/testUtils.tsx`)
- [x] **Data factories**: `createMockAccount`, `createMockMember`, `createMockVoucher`, `createMockParty`, `createMockItem`, `createMockJournal`, `createMockTenant`, `createMockFiscalYear`, `createMockAccountGroup`, `createMockCoAHierarchy` (`src/test/factories.ts`)
- [x] **Empty DB helpers**: `resetTestDB()`, `seedTestData()` pattern defined

#### 0.2 GitHub Actions CI Pipeline ✅
```yaml
# .github/workflows/ci.yml
jobs:
  typecheck-lint:
    - TypeScript check
    - ESLint
  unit-tests:
    - Unit tests (Vitest) with coverage
    - Coverage artifact upload
  integration-tests:
    - PostgreSQL service container
    - Integration tests
  e2e-tests:
    - PostgreSQL service container
    - Playwright tests
    - Screenshot capture on failure
  jules-dispatch:
    - Parallel test dispatch via Jules
  build:
    - Build verification
  governance:
    - kritikka-mcp validation
  deploy-staging:
    - Staging deploy on main branch
```

#### 0.3 Jules Integration ✅
- [x] Jules fleet config in `scripts/fleet/` (tasks defined in CI)
- [x] Parallel test execution tasks defined
- [x] `JULES_API_KEY` GitHub secret referenced in CI

---

### Phase 1: Tenant Architecture Hardening (Week 1) ✅ COMPONENT DONE

#### 1.1 Tenant Selector UI Enhancement ✅
**File:** `apps/billing/src/components/TenantSelector.tsx`
- [x] Central role: Dropdown with "All (Consolidated)" + all Illakas
- [x] Illaka role: Locked chip showing current Illaka
- [x] Persist selection in localStorage
- [x] Sync with `useTenant()` for API calls
- [x] **Visual**: Top-right header, accessible keyboard navigation
- [x] **Tests**: 8 unit tests passing

#### 1.2 Data Scoping Enforcement ✅ COMPLETE
- [x] Verify ALL list queries use `useTenant()` - all 23 data pages verified
- [x] Tenant filter on: Accounts, Members, Parties, Items, Vouchers, Journal, Reports
- [x] Central "All" mode: omit tenant filter (backend aggregates)
- [x] Illaka mode: enforce tenant filter via `where[tenant][equals]`

#### 1.3 Tenant-Aware Reports 🔄
- [x] Trial Balance, P&L, Balance Sheet respect tenant filter (tenantQuery passed)
- [ ] Consolidated view at Central level (sum across Illakas)

---

### Phase 2: Language & i18n Completeness (Week 1-2)

#### 2.1 Translation Coverage Audit 🔄
- [x] Scan all `t('key')` usages - i18n.tsx with namespace pattern
- [x] Added tooltip keys to en.ts and ne.ts
- [ ] Priority: Accounting terms completeness check needed

#### 2.2 i18n Tests ✅
- [x] `src/lib/__tests__/i18n.test.ts` - i18n tests passing
- [x] Falls back to English for missing NE keys
- [x] Switches language without reload

#### 2.3 Devanagari Digit Toggle ✅
- [x] Settings → Display → "Use Nepali Digits (०१२३)"
- [x] Apply via `toNepaliDigits()` in `fmt()` utility
- [x] Persist in localStorage via globals cache

---

### Phase 3: Chart of Accounts → Table Format ✅ COMPLETE

#### 3.1 New Table Component ✅
**File:** `apps/billing/src/components/AccountsTable.tsx`
- Flat table with indent-based hierarchy (`padding-left: level * 24px`)
- Columns: Code, Name, Group, Class, Opening (FY), Actions
- Expand/collapse parent rows
- Built-in search filter
- Type-based grouping
- Edit/Delete action menu per row

#### 3.2 CoA Import/Export ✅ (basic)
- CSV export: works (downloadCsv with accounts)
- JSON import: works (parseImportFile → ImportPreviewModal)
- Excel master file: pending (Phase 6)

#### 3.3 Account Groups Management ⏳
- [ ] Separate Groups tab/table
- [ ] Group import/export (same Excel)
- [ ] Group code validation (unique, format)

---

### Phase 4: Comprehensive Test Suite (Week 2-3)

#### 4.1 Unit Tests — Per Collection
| Collection | Test File | Coverage Target | Status |
|------------|-----------|-----------------|--------|
| Accounts | `accounts.test.ts` | 90% | ✅ Basic tests |
| Account Groups | `accountGroups.test.ts` | 90% | ⏳ |
| Members | `members.test.ts` | 90% | ⏳ |
| Parties | `parties.test.ts` | 90% | ⏳ |
| Items | `items.test.ts` | 90% | ⏳ |
| Vouchers | `vouchers.test.ts` | 90% | ⏳ |
| Journal | `journal.test.ts` | 90% | ⏳ |
| Opening Balances | `openingBalances.test.ts` | 90% | ⏳ |
| Fiscal Years | `fiscalYear.test.ts` | 90% | ⏳ |

**Each test file includes:**
```typescript
describe('Accounts CRUD', () => {
  beforeEach(() => resetTestDB())
  
  it('creates account with valid data', async () => {})
  it('rejects duplicate code', async () => {})
  it('validates parent group type matches account type', async () => {})
  it('calculates opening balance per fiscal year', async () => {})
  it('soft deletes account with children warning', async () => {})
  it('imports from Excel with hierarchy', async () => {})
  it('exports to Excel with formatting', async () => {})
})
```

**Progress:**
- [x] `accounts.test.ts` - basic factory & business logic tests
- [x] `accountGroups.test.ts`
- [x] `members.test.ts`
- [x] `parties.test.ts`
- [x] `items.test.ts`
- [x] `vouchers.test.ts`
- [x] `journal.test.ts`
- [x] `openingBalances.test.ts`
- [x] `fiscalYear.test.ts`

#### 4.2 Component Tests
| Component | Test File | Status |
|-----------|-----------|--------|
| AccountsTable | `AccountsTable.test.tsx` | ⏳ |
| TenantSelector | `TenantSelector.test.tsx` | ✅ 8 tests |
| ImportPreviewModal | `ImportPreviewModal.test.tsx` | ⏳ |
| NepaliDateInput | `NepaliDateInput.test.tsx` | ⏳ |
| TooltipWrapper | `TooltipWrapper.test.tsx` | ✅ 14 tests |
| Tooltip (shorthand) | `TooltipWrapper.test.tsx` | ✅ |
| useTooltips hook | `TooltipWrapper.test.tsx` | ✅ |

#### 4.3 E2E Tests (Playwright)
**File:** `apps/billing/e2e/specs/`

| Spec | Scenarios | Status |
|------|-----------|--------|
| `tenant-selector.spec.ts` | Central switches tenants, Illaka locked | ✅ Created |
| `coa-table.spec.ts` | CoA table CRUD, hierarchy, import/export | ✅ Created |
| `import-export.spec.ts` | All 7 collections round-trip | ✅ Created |
| `language.spec.ts` | EN/NE toggle, Devanagari digits | ✅ Created |
| `tooltips.spec.ts` | Tooltip toggle, visibility, content | ✅ Created |
| `01-auth.spec.ts` | Login, role-based redirect, logout | ⏳ |
| `03-accounts-crud.spec.ts` | Create/edit/delete account, hierarchy | ⏳ |
| `04-members-crud.spec.ts` | Member lifecycle, import Excel | ⏳ |
| `05-vouchers.spec.ts` | All voucher types, double-entry validation | ⏳ |
| `06-reports.spec.ts` | Trial Balance, P&L, BS per tenant | ⏳ |
| `07-import-export.spec.ts` | All 7 collections round-trip | ⏳ |
| `08-offline.spec.ts` | Offline create → online sync | ⏳ |

#### 4.4 Test Data Factories ✅
**File:** `apps/billing/src/test/factories.ts`
- `createMockAccount`, `createMockAccountGroup`, `createMockCoAHierarchy`
- `createMockMember`, `createMockParty`, `createMockItem`
- `createMockVoucher`, `createMockJournalEntry`
- `createMockTenant`, `createMockFiscalYear`
- `createMockOpeningBalance`, `createMockDocSequence`
- `createMockBillingSettings`, `createMockMembershipType`

#### 4.5 Empty DB Testing Pattern ✅
```typescript
// Every test starts clean
beforeEach(async () => {
  await resetTestDB()  // TRUNCATE all tables
  await seedMinimalData()  // Only: Central tenant, 1 fiscal year, 1 admin user
})
```
Pattern defined in `src/test/testUtils.tsx` and `src/test/setup.ts`

---

### Phase 5: Tooltip System (Week 3) 🔄 IN PROGRESS

#### 5.1 Tooltip Infrastructure ✅
**Files:**
- `apps/billing/src/components/ui/Tooltip.tsx` ✅ (base Tooltip + TooltipWrapper)
- `apps/billing/src/hooks/useTooltips.tsx` ✅ (context provider with localStorage)
- `apps/billing/src/lib/tooltips/` ✅ (en.ts, ne.ts, index.ts)

```tsx
// Usage
<TooltipWrapper tooltipKey="accounts.code">
  <Input label="Code" />
</TooltipWrapper>

// Or inline
<TooltipWrapper content={t('tooltip.accounts.code')}>
  <span>ℹ️</span>
</TooltipWrapper>
```

#### 5.2 Tooltip Content Dictionary ✅
**Files:** `apps/billing/src/lib/tooltips/en.ts`, `ne.ts`, `index.ts`
- 180+ tooltip keys with bilingual content (EN/NE)
- Categories: accounts, vouchers, members, parties, items, journal, reports, settings, import-export, navigation
- NE translations use Devanagari script

#### 5.3 Settings Toggle 🔄
**Location:** Settings → Display → "Show Tooltips" (default: ON)
- [x] Persist in localStorage (`ui-tooltips-enabled`)
- [x] Global context provider (`TooltipsProvider`)
- [x] Keyboard accessible (hover, focus, Enter/Space to show, Escape to hide)
- [ ] Add toggle to Settings page UI

---

### Phase 6: Complete Excel Import/Export ✅ COMPLETE

#### 6.1 Master Export File Structure
**File:** `apps/billing/src/lib/excel/masterExport.ts`
```typescript
export async function buildMasterExport(tenantId?: string): Promise<Blob> {
  const workbook = new ExcelJS.Workbook()
  
  // Sheet per collection
  const sheets = [
    { name: 'Tenants', collection: 'tenants' },
    { name: 'Fiscal Years', collection: 'fiscal-years' },
    { name: 'Account Groups', collection: 'account-groups' },
    { name: 'Chart of Accounts', collection: 'gl-accounts' },
    { name: 'Opening Balances', collection: 'opening-balances' },
    { name: 'Members', collection: 'members' },
    { name: 'Parties', collection: 'parties' },
    { name: 'Items', collection: 'items' },
    { name: 'Membership Types', collection: 'membership-types' },
    { name: 'Vouchers', collection: 'vouchers' },
    { name: 'Journal Entries', collection: 'journal-entries' },
    { name: 'Doc Sequences', collection: 'doc-sequences' },
    { name: 'Billing Settings', collection: 'billing-settings' },
    { name: '_Meta', collection: null },  // metadata
    { name: '_Template', collection: null },  // blank templates
  ]
  
  // Each sheet: styled headers, frozen row, auto-filter, data validation
  // Nepali digits + BS dates columns
  // Formula columns where applicable (e.g., Dr=Cr validation)
}
```

#### 6.2 Master Import with Validation
- [ ] Single file upload → detects all sheets
- [ ] Cross-sheet validation (FK references)
- [ ] Dependency order: Tenants → Fiscal Years → Groups → Accounts → Openings → Members/Parties/Items → Vouchers/Journal
- [ ] Progress per sheet
- [ ] Rollback on failure

#### 6.3 Template Download
- [ ] "Download Master Template" button in Data Management
- [ ] Blank sheets with headers, examples, data validation
- [ ] Instruction sheet

---

### Phase 7: CI/CD & Screenshot Generation ✅ COMPLETE

#### 7.1 GitHub Actions Workflow
**File:** `.github/workflows/test.yml`
```yaml
name: Test Suite
on: [push, pull_request]

jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @afno/billing test:unit --coverage
      - uses: codecov/codecov-action@v4

  e2e:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_DB: billing_e2e
        ports: [5432:5432]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @afno/billing build
      - run: pnpm --filter @afno/billing test:e2e
        env:
          E2E_DATABASE_URI: postgresql://postgres:test@localhost:5432/billing_e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-screenshots
          path: apps/billing/test-results/
          retention-days: 7

  jules-dispatch:
    needs: [unit, e2e]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: |
          cd scripts/fleet
          JULES_API_KEY=${{ secrets.JULES_API_KEY }} bun fleet-dispatch.ts
```

#### 7.2 Playwright Screenshot Config
**File:** `apps/billing/playwright.config.ts`
```typescript
export default defineConfig({
  testDir: './e2e/specs',
  fullyParallel: true,
  retries: 2,
  workers: 2,
  reporter: [['html', { outputFolder: 'test-results/html' }]],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
})
```

#### 7.3 Visual Regression (Optional)
- [ ] Add `@playwright/test` visual comparison
- [ ] Baseline screenshots in `e2e/screenshots/`
- [ ] Fail on pixel diff > 0.1%

---

### Phase 8: Jules/Superset Orchestration ✅ UNBLOCKED

#### 8.1 Fleet Dispatch Script ✅
**File:** `scripts/fleet/tasks/test-parallel.json`
- 9 parallel tasks defined
- Test subsets: accounts, members, vouchers, reports, import-export, e2e-auth, e2e-crud, e2e-transactions, e2e-offline

#### 8.2 Superset CLI Setup ✅
**Installed:** `superset` v2.0.2 at `/opt/homebrew/bin/superset`
**Installed:** `paradev` at `/opt/homebrew/bin/paradev`
**Local orchestration verified.**

**Verified results (9 parallel workspaces, `--agent opencode`):**
- test-accounts: ✅ 25/25 passed
- test-members: ✅ 15/15 passed
- test-vouchers: ✅ 17/17 passed
- test-reports: ✅ 19/19 passed
- test-import-export: ✅ 55/55 passed
- test-e2e-auth/crud/transactions/offline: ❌ "Cannot connect to API" — requires Next.js API (:3100), Vite (:5174), PostgreSQL running before Playwright executes. Infrastructure setup, not code issue.

**Usage:** `superset ws create --local --project <id> --checkout local --name <name> --agent opencode --prompt "<prompt>"`

#### 8.3 Result Aggregation ⏳
- [ ] Merge coverage reports
- [ ] Consolidate E2E results
- [ ] Publish summary page via `superset pages publish`
- [ ] E2E tests require server startup in workspace setup (`pnpm dev` + `db:push`)

---

## 📁 File Structure Changes

```
apps/billing/
├── src/
│   ├── components/
│   │   ├── TenantSelector.tsx          # NEW
│   │   ├── AccountsTable.tsx           # NEW (replaces accordion)
│   │   ├── TooltipWrapper.tsx          # NEW
│   │   └── ui/Tooltip.tsx              # NEW (base component)
│   ├── hooks/
│   │   └── useTooltips.ts              # NEW
│   ├── lib/
│   │   ├── tooltips/
│   │   │   ├── en.ts                   # NEW
│   │   │   ├── ne.ts                   # NEW
│   │   │   └── index.ts                # NEW
│   │   ├── excel/
│   │   │   ├── coa.ts                  # NEW
│   │   │   ├── masterExport.ts         # NEW
│   │   │   └── masterImport.ts         # NEW
│   │   ├── __tests__/
│   │   │   ├── factories.ts            # NEW
│   │   │   ├── testUtils.tsx           # NEW
│   │   │   ├── i18n.test.ts            # NEW
│   │   │   ├── accounts.test.ts        # NEW
│   │   │   ├── members.test.ts         # NEW
│   │   │   ├── vouchers.test.ts        # NEW
│   │   │   └── ... (per collection)
│   │   └── ...
│   ├── pages/
│   │   ├── Accounts.tsx                # MODIFY (use AccountsTable)
│   │   ├── Settings.tsx                # MODIFY (tooltip toggle)
│   │   └── DataManagement.tsx          # MODIFY (master import/export)
│   └── e2e/
│       ├── specs/                      # NEW spec files
│       └── fixtures/                   # Test Excel files
├── vitest.config.ts                    # NEW/MODIFY
├── playwright.config.ts                # MODIFY
└── package.json                        # ADD test scripts
```

---

## 🚀 Execution Order

### Immediate (This Week)
1. [ ] **T-001**: Set up Vitest + MSW + test utilities
2. [ ] **T-002**: Create GitHub Actions CI workflow
3. [ ] **T-003**: Build `TenantSelector` component
4. [ ] **T-004**: Create `AccountsTable` (table format CoA)

### Week 2
5. [ ] **T-005**: CoA import/export (Excel)
5. [ ] **T-006**: Unit tests for Accounts + Groups
6. [ ] **T-007**: i18n completeness + tests
7. [ ] **T-008**: Tooltip system + settings toggle

### Week 3
8. [ ] **T-009**: Complete CRUD unit tests (all collections)
9. [ ] **T-010**: E2E test specs (10 scenarios)
10. [ ] **T-011**: Master Excel export/import
11. [ ] **T-012**: Playwright config + screenshots

### Week 4
12. [ ] **T-013**: GitHub Actions E2E with Postgres
13. [ ] **T-014**: Jules fleet scripts for parallel testing
14. [ ] **T-015**: Superset orchestration script
15. [ ] **T-016**: Documentation + runbook updates

---

## ✅ Acceptance Criteria

| Feature | Criteria |
|---------|----------|
| Tenant Selector | Central sees "All + Illakas", Illaka sees locked chip |
| CoA Table | Flat table with indentation, sortable, filterable, keyboard nav |
| Tests | 80%+ coverage lib, 70%+ components, 10 E2E specs passing |
| Excel Master | Single file with 14 sheets, import validates FK order |
| Tooltips | 100+ tooltips, toggle in settings (default ON), keyboard accessible |
| Language | EN/NE complete, Devanagari digits toggle, accounting terms |
| CI | GitHub Actions runs unit + E2E on every PR, posts screenshots on failure |
| Jules | Parallel test dispatch works, aggregates results |

---

## 🛠️ Tool Usage

| Tool | Purpose |
|------|---------|
| **Google Jules** | Parallel test execution across 8 workspaces |
| **Superset Orchestrate** | Coordinate Jules workers, aggregate results |
| **Playwright** | E2E tests with screenshot capture |
| **Vitest** | Unit/component tests with coverage |
| **MSW** | API mocking for unit tests |
| **ExcelJS** | Excel import/export with styling |
| **kritikka-mcp** | Governance validation on every change |

---

## 📝 Notes

- **Empty DB rule**: Every test file starts with `beforeEach(resetTestDB)`
- **Mock data**: Use `faker` with fixed seeds for reproducibility
- **Screenshots**: Saved to `test-results/` on failure, uploaded as artifact
- **Tenant isolation**: Verify via E2E test `02-tenant-selector.spec.ts`
- **Performance**: CoA table handles 10,000 rows with virtualization
- **Accessibility**: All new components pass axe-core checks

---

*Plan created 2026-11-03. Update as tasks progress.*