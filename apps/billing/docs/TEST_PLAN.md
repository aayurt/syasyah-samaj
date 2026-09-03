# Overall Test Plan — Afno Billing

> Status: Living document — updated as features ship.
> Scope: full end-to-end QA of the billing SPA + Payload backend (server,
> sync engine, fiscal years, VAT registers, offline/desktop behaviour).
> Verification today is manual (no browser automation exists) + typechecks.

## 0. Environment & data prep (once per test session)

| Step | Command / action | Expected |
|---|---|---|
| 0.1 | Server typecheck | `npx tsc --noEmit` → clean |
| 0.2 | Billing typecheck | `cd apps/billing && npx tsc --noEmit` → clean |
| 0.3 | Schema typecheck | after any collection change: `npx payload generate:types` → clean |
| 0.4 | Reset/seed DB (staging only) | run `billing-seed.mjs` → tenants, chart of accounts, default accounts, fiscal year 2083-84 (`2026-07-16`→`2027-07-15`) active |
| 0.5 | Start server + SPA | dev servers up; login page renders (crimson sign-in) |
| 0.6 | Log in as admin | provided credentials; landing on Dashboard, no console errors |
| 0.7 | Note baseline | FY switcher = 2083-84, illaka = default/org, time format per settings |

**QA hygiene**: after every failure record — page/route, exact steps, expected vs
actual, browser console/network errors, screenshot.

---

## 1. Automated checks (run before/after each change set)

1. `npx tsc --noEmit` (root) — server + hooks + endpoints.
2. `cd apps/billing && npx tsc --noEmit` — SPA.
3. `npx payload generate:types` after adding/renaming collection fields.
4. `cd apps/billing && npx vite build` before a production deploy.
5. Server unit test (if touching sync utilities): `src/utilities/syncSheets.test.ts`.

## 2. Shell & navigation

- [ ] Sidebar sections (Bookkeeping, Masters, Inventory, Reports, Admin) collapse/expand via header click; chevron rotates; state survives reload.
- [ ] Navigating to a page in a collapsed section (⌘K palette) auto-expands it.
- [ ] Icon-only sidebar (collapse button) shows all section icons; accordions ignored.
- [ ] Sidebar labels: **Account Setup** (Masters), Dashboard/Settings pinned.
- [ ] ⌘K palette opens and routes to pages.
- [ ] Illaka switcher changes tenant scope on all list pages.
- [ ] Fiscal year switcher lists years (2081-82 … 2084-85) with Active/Closed icons; switching filters every page.
- [ ] Tour opens once; Guide button re-opens it.

## 3. Account Setup (Chart of Accounts)

- [ ] Masters → Account Setup lists accounts grouped by type (Assets/Liabilities/Equity/Income/Expenses).
- [ ] New account: choosing a **Type** filters the **Group** dropdown to matching groups; no matching groups → "No … groups yet" hint.
- [ ] Changing type after picking a group clears a mismatched group.
- [ ] Saving persists; CSV export matches the visible rows; delete removes the account.
- [ ] Settings → Chart of Accounts quick-add behaves the same (type-filtered group).
- [ ] Default posting accounts (Settings → Default accounts) can be set and reordered (drag/arrows); missing accounts block posting with a clear message.

## 4. Vouchers — lifecycle & numbering (core)

Set FY = 2083-84, type = e.g. Sales Invoice with one item line qty/rate.

- [ ] Next-number preview in the form shows `SI-2083-84-XXXX` (new FY-label format) and matches the number assigned after posting.
- [ ] Save Draft → appears in the list as a draft (no number), editable.
- [ ] **Save & Post** → exactly **one** row (no duplicate); status posted; number assigned.
- [ ] Posted amounts are non-zero and correct (net + VAT = gross; e.g. 500 + 65 = 565 at 13%).
- [ ] Posting a second invoice increments the sequence by 1.
- [ ] Sequence bridge: if the FY already had legacy `SI-2026-00xx` numbers, the first new-format number continues (e.g. `SI-2083-84-0013`).
- [ ] Backdated draft (dated in 2082-83) numbers with the 2082-83 label/sequence when posted.
- [ ] Void a posted invoice → document marked Void; generated credit note numbered `CN-2083-84-…` (FY of today); no duplicate rows.
- [ ] **VAT reconciliation**: void a 13% VAT invoice → Sales Return Register row = −taxable, −VAT; Sales + Sales Return sum to zero.
- [ ] Partial void of a line → credit note shows proportional net/VAT/gross (not zero VAT); voiding all lines flips the doc to Void.
- [ ] Reopen posted doc → editable draft; repost assigns next number.
- [ ] Copy quote → invoice flow works and the invoice posts cleanly.
- [ ] Contra / journal / payment / receipt / petty-cash flows post balanced entries (Trial Balance stays balanced).
- [ ] Amount-0 regression: any voucher saved with a positive entered amount never displays/stores 0.

## 5. Fiscal years (Settings + enforcement)

- [ ] Settings → Fiscal Settings lists years; add year (BS date pickers) auto-labels `2085-86`; select working year radio; close/reopen works.
- [ ] Closed year shows locked badge; header switcher shows lock.
- [ ] **Closed enforcement**: posting/editing a doc dated in a closed year is rejected with the clear message; draft creation for a closed selected year is disabled (amber banner).
- [ ] Viewing a closed year filters Vouchers/Journal/Daybooks/Dashboard/reports to that range; closed rows read-only.
- [ ] Only one active (working) year per tenant.

## 6. Members, recurring billing, expense claims

- [ ] Members: add member (form validation), edit member, change member type reflects in table; delete.
- [ ] Member pay-fee posts a receipt + journal entry exactly once (no duplication); number assigned (receipt per FY label).
- [ ] Recurring billing: schedule list loads without infinite refresh; schedule create/update queues and syncs; generated invoices post with correct amounts.
- [ ] Expense claims: create offline works (no "lost" queued write); approve/reject posts journal atomically.

## 7. Journal & reports

- [ ] Journal entries appear after posting vouchers; totals match the source docs.
- [ ] Trial Balance balances (debit = credit) after each posting test.
- [ ] P&L / Balance Sheet / Aging / Daybooks reflect current FY and switch with the FY selector.
- [ ] Tax Sales / Tax Purchase match voucher tax lines.
- [ ] **VAT Registers** (Reports → VAT Registers): four tabs filter correctly (sales-invoice → Sales; purchase-invoice → Purchase; credit-notes split by referenced doc type into Sales/Purchase Return).
- [ ] VAT-only toggle hides non-VAT rows; TDS-only docs excluded.
- [ ] Return rows render negative/red; footer totals sum correctly.
- [ ] CSV/PDF/Print produce the visible register content (PDF header, dates, totals).

## 8. Offline-first & sync (desktop SQLite + web IndexedDB)

- [ ] Save a draft/posted voucher while **offline** → appears instantly in the list (local store), shows "needs sync".
- [ ] Reconnect → queued item syncs; server number replaces preview; **no duplicate rows** (single doc, updated in place).
- [ ] IndexedDB (web) and SQLite (desktop) show the **same** data after sync.
- [ ] Pull: another device/user creates a party/member/account → appears here after sync (members & fiscal-years pull).
- [ ] Recurring-schedules / expense-claims offline creates survive sync (not rejected by the endpoint allowlist).
- [ ] UpdatedAt displayed in **local time** (not UTC); format matches Settings (12h AM/PM or 24h).
- [ ] Sync indicator: banner/queue counts clear; no infinite "refreshing".
- [ ] Conflict resolution modal handles an edited-since-sync row without data loss.

## 9. Regression checklist (recent fixes)

| # | Regression | Expect |
|---|---|---|
| R1 | Receipt via Save & Post | 1 row (no localId/serverId duplicate) |
| R2 | UPDATED column time | local wall-clock, AM/PM when 12h |
| R3 | Voucher amounts | never 0 when amount entered |
| R4 | Sidebar accordions | state persisted, active section visible |
| R5 | Account group filtering | group list follows chosen type |
| R6 | Void VAT invoice | returns register reverses taxable + VAT |
| R7 | Voucher numbering | FY label in number, per-FY restart, gapless bridge |
| R8 | Expense claims/recurring offline | queued then synced, never silently dropped |
| R9 | Members changes | pushed **and** pulled across devices |

## 10. Sign-off checklist

- [ ] All phases above executed with notes (screenshots for failures).
- [ ] No console errors on: login → dashboard → voucher create/post → void → reports → settings → offline toggle → reconnect.
- [ ] Typechecks clean; any schema change has `payload generate:types` run and a migration written/applied.
- [ ] Known-issue tracker updated (see doc history / commit log for fixed items above).

## 11. Optional automation roadmap (future)

1. Playwright smoke suite: login → create/post voucher → assert single row & number format.
2. Vitest for `vatShared.ts` row builder (mode matching, negative returns, rate detection) — pure functions, zero DOM.
3. Server integration test for `postDocument` numbering (per-FY restart + bridge) against a disposable Postgres.
4. Sync engine test: offline queue → flush → assert idempotency (no dupes).
