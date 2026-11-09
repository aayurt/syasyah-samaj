# Lightpanda E2E Test Plan — Feature by Feature

## Strategy
Migrate from Playwright to Lightpanda, one feature group at a time. Lightpanda's `page.setCookie()` works over HTTP without Secure/SameSite restrictions, so auth cookie issues disappear. Start with the simplest features first to validate the pipeline, then add each feature group.

## Phase 1: Auth + Shell (S0)
- `auth.setup.ts` → `lightpanda-auth.ts` — API sign-in + `page.setCookie()`, no cookie verification round-trip
- `00-shell.spec.ts` → `lightpanda-shell.ts` — fiscal year switcher, sidebar groups, ⌘K palette
- **Exit criteria:** S0 tests pass in CI without cookie errors

## Phase 2: Settings + Tenant Selector (S1)
- `01-settings.spec.ts` → `lightpanda-settings.ts` — feature toggle persistence
- `tenant-selector.spec.ts` → `lightpanda-tenant.ts` — Central vs Illaka data scoping
- **Exit criteria:** Settings and tenant selector pass

## Phase 3: Masters + COA
- `02-accounts.spec.ts` + `coa-table.spec.ts` → `lightpanda-accounts.ts` — flat COA table, indentation, sort/filter
- `03-masters.spec.ts` → `lightpanda-masters.ts` — parties, items, account groups
- **Exit criteria:** COA and masters pass

## Phase 4: Transactions
- `04-vouchers.spec.ts` → `lightpanda-vouchers.ts` — voucher entry, posting
- `05-journal.spec.ts` → `lightpanda-journal.ts` — journal entries
- **Exit criteria:** Vouchers and journal pass

## Phase 5: Reports + Import/Export
- `06-reports.spec.ts` → `lightpanda-reports.ts` — P&L, balance sheet
- `import-export.spec.ts` → `lightpanda-import-export.ts` — Excel master file, cross-sheet FK validation
- **Exit criteria:** Reports and import/export pass

## Phase 6: Language + Tooltips + Offline + Misc
- `language.spec.ts` → `lightpanda-language.ts` — Nepali default, `t()` returns Nepali strings
- `tooltips.spec.ts` → `lightpanda-tooltips.ts` — toggle default ON, keyboard accessible
- `07-offline.spec.ts` → `lightpanda-offline.ts` — offline session fallback
- `08-desktop-storage.spec.ts` → `lightpanda-desktop-storage.ts`
- `09-spa-sqlite.spec.ts` → `lightpanda-spa-sqlite.ts`
- `10-membership.spec.ts` → `lightpanda-membership.ts`
- `90-defects.spec.ts` → `lightpanda-defects.ts`
- **Exit criteria:** All remaining features pass

## CI Changes
1. Install `@lightpanda/lightpanda` package
2. Replace `npx playwright test` with `npx lightpanda test` (or `lightpanda run`)
3. Keep background API + SPA servers (ports 3100 + 5174)
4. Keep PostgreSQL + Redis services
5. Keep screenshots on failure as CI artifacts

## Prerequisites
- Lightpanda CLI installed via npm
- `lightpanda.config.ts` at `apps/billing/e2e/`
- Base URL: `http://localhost:5174` (SPA proxy → API port 3100)
