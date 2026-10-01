# Testing Policy — syasyah-samaj

## Test Pyramid

```
        ┌─────────────┐
        │   E2E       │  ← Few, high confidence, slow
        │  (Playwright)│
        ├─────────────┤
        │ Integration │  ← Medium, real components + MSW
        │  (Vitest)   │
        ├─────────────┤
        │   Unit      │  ← Many, fast, isolated
        │  (Vitest)   │
        └─────────────┘
```

## Coverage Requirements

| Layer | Target | Enforcement |
|-------|--------|-------------|
| `src/lib/**` | ≥ 90% | CI fails below |
| `src/components/**` | ≥ 80% | CI fails below |
| `src/pages/**` | ≥ 70% | Warning only |
| `src/hooks/**` | ≥ 80% | CI fails below |
| Critical paths (accounting, sync, import) | 100% | Manual review |

## Test Types

### 1. Unit Tests (`vitest`)
**Location:** `src/**/__tests__/*.test.ts` or `src/**/*.test.ts`

**Scope:** Pure functions, utilities, hooks, validators
- `src/lib/importExport.ts` — CSV/JSON parse, export, dedup
- `src/lib/excelImportExport.ts` — Excel parse, workbook build
- `src/lib/nepaliNumbers.ts` — Number formatting, conversion
- `src/lib/api.ts` — Request helpers, error normalization
- `src/lib/offline/*.ts` — Adapters, outbox logic
- `src/lib/sync/*.ts` — SyncEngine, conflict detection
- `src/hooks/*.ts` — Custom hooks (`useSyncState`, `useTenantQuery`)

**Patterns:**
- Test pure functions with table-driven tests
- Mock external dependencies (IndexedDB, fetch, crypto)
- Use `vi.mock()` for module dependencies
- Memory adapter for offline tests (no real IndexedDB)

### 2. Component Tests (`vitest` + `@testing-library/react`)
**Location:** `src/**/__tests__/*.test.tsx`

**Scope:** React components in isolation
- `ImportPreviewModal` — validation preview, conflict actions
- `NepaliDateInput` — AD/BS conversion, keyboard nav
- `AccountSelect` / `SearchSelect` — portal, search, accessibility
- `VoucherForm` — line validation, debit=credit, submit
- Form components with React Hook Form + Zod

**Patterns:**
- Render with providers (Tenant, Theme, i18n, Toasts)
- User interactions via `@testing-library/user-event`
- Snapshot tests for stable UI (avoid for dynamic)
- Test accessibility (roles, labels, focus)

### 3. Integration Tests (`vitest` + MSW)
**Location:** `src/pages/__tests__/*.test.tsx`

**Scope:** Page flows with mocked API
- `DataManagement` — cleanup, seed, import wizard, export
- `Vouchers` — list, create, edit, post, void, filter
- `Members` — CRUD, import/export, search
- `Journal` / `Daybooks` — entry creation, posting
- `Posting` — queue, post, void, reopen

**Patterns:**
- MSW handlers for `/api/sync`, collection endpoints
- Mock `getEngine()` to return test SyncEngine
- Test full user flows (click → API → UI update)
- Verify offline queue behavior

### 4. E2E Tests (Playwright)
**Location:** `apps/billing/e2e/specs/*.spec.ts`

**Scope:** Real browser against local Postgres
- `00-shell` — app loads, navigation, theme
- `01-settings` — fiscal years, CoA, doc sequences
- `02-accounts` — CRUD, groups, opening balances
- `03-masters` — parties, items, tax types, members
- `04-vouchers` — full voucher lifecycle
- `05-journal` — journal entries, posting
- `06-reports` — trial balance, P&L, BS, party statement
- `07-offline` — offline create, sync, conflict resolution
- `08-desktop-storage` — Tauri SQLite persistence
- `09-spa-sqlite` — SPA with SQLite backend
- `10-membership` — membership types, renewals
- `11-import-export` — JSON/CSV import/export roundtrip
- `12-excel-import` — Excel template, import, validation, dedup
- `13-offline-flow` — offline voucher, sync, conflict UI
- `14-accounting` — debit=credit, trial balance=0, carry-forward

**Requirements:**
- Local Postgres (`E2E_DATABASE_URI`)
- Bootstrap script creates `default` tenant
- Tests independent (no shared state)
- CI: Postgres service container

## Test Utilities

### MSW Handlers (`tests/msw/handlers.ts`)
```typescript
export const handlers = [
  http.post('/api/sync', async ({ request }) => {
    const body = await request.json()
    // Simulate sync response
  }),
  http.get('/members', () => HttpResponse.json({ docs: [...] })),
  // ...
]
```

### Test Setup (`tests/setup.ts`)
```typescript
import '@testing-library/jest-dom'
import { server } from './msw/server'
beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

### Memory Adapter (for offline tests)
```typescript
// tests/adapters/memoryAdapter.ts
export class MemoryAdapter implements StorageAdapter {
  // In-memory implementation for fast unit tests
}
```

## Running Tests

```bash
# Unit + Integration + Component
cd apps/billing
pnpm test              # Run once with coverage
pnpm test:watch        # Watch mode
pnpm test:ui           # Vitest UI

# E2E (requires local Postgres)
E2E_DATABASE_URI=postgresql://postgres:test@localhost:5432/billing_e2e \
  pnpm test:e2e

# All tests
pnpm test && pnpm test:e2e
```

## CI Pipeline

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm test          # Unit/integration/component
      - run: pnpm build         # Typecheck + build

  e2e:
    needs: test
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: billing_e2e
          POSTGRES_PASSWORD: test
        ports: [5432:5432]
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install --frozen-lockfile
      - run: E2E_DATABASE_URI=postgresql://postgres:test@localhost:5432/billing_e2e pnpm --filter billing test:e2e
```

## Test Data

### Factories (`tests/factories/`)
```typescript
export function createMember(overrides = {}) {
  return {
    id: faker.number.int(),
    memberId: `M-${faker.string.alphanumeric(6)}`,
    fullName: faker.person.fullName(),
    phone: `98${faker.string.numeric(8)}`,
    bloodGroup: faker.helpers.arrayElement(['A+', 'B+', 'O+', 'AB+']),
    ...overrides
  }
}
```

### Fixtures (`tests/fixtures/`)
- `members-sample.csv` — 10 valid members
- `members-with-errors.csv` — missing required, invalid phone
- `vouchers-balanced.xlsx` — balanced vouchers for import test
- `vouchers-unbalanced.xlsx` — for validation error test

## Anti-Patterns (Avoid)

- ❌ Testing implementation details (private methods, internal state)
- ❌ Snapshot testing everything (use for stable UI only)
- ❌ Shared mutable state between tests
- ❌ Real network/DB in unit tests (use mocks/adapters)
- ❌ `waitFor` with long timeouts (fix flaky async instead)
- ❌ Testing library internals (test behavior, not internals)

## Debugging Failed Tests

1. **Unit/Component**: `pnpm test:watch` → press `u` to update snapshots
2. **Integration**: Check MSW handler matches request
3. **E2E**: `pnpm test:e2e -- --debug` → opens browser with pause
4. **Coverage**: `pnpm test -- --coverage` → open `coverage/index.html`

## Adding New Tests

1. Identify test level (unit/component/integration/E2E)
2. Create test file in appropriate `__tests__/` or `e2e/specs/`
3. Follow naming: `FeatureName.test.tsx` or `NN-feature.spec.ts`
4. Add factories/fixtures if needed
5. Run locally → verify coverage → commit
6. CI will enforce thresholds