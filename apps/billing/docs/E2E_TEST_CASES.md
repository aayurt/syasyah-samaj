# Sequential E2E Test Cases — Afno Billing

> Companion to `SETUP_AND_E2E_PLAN.md`. This is the concrete test-case list for
> the sequential journey **Settings → Account setup → Masters → Vouchers →
> Reports**, designed to run against a freshly seeded DB (the seed's printed
> verification block is the ground truth for engine-computed values).
>
> Conventions:
> - **Dataset** = `billing-seed.mjs` output (FY 2083-84 = 2026-07-16 → 2027-07-15).
> - **Run order matters** — each suite depends on the previous. CI runs them
>   in file order with `workers: 1` (Playwright `test.describe.serial`).
> - IDs: `S<suite>.<n>` — suites S1..S8, offline suite S8.
> - **Copy is final** (post copy-sweep): Sales Invoice / Payment / Receipt /
>   Goods Received (GRN) etc.; buttons `Save draft` / `Save & post`;
>   status chips `All / Draft / Posted / Void`.

---

## S0 — Environment (run once)

| ID | Test case | Steps | Expected |
|---|---|---|---|
| S0.1 | Servers up | start Payload (:3000) + SPA (:5173); open `/` | login page renders (स्यस्यः धुकू branding) |
| S0.2 | Login | email `aayurtshrestha@gmail.com`, password, click **Sign in** | lands on Dashboard; no console errors |
| S0.3 | Baseline | note FY switcher + illaka in header | FY = 2083-84 active; correct tenant |
| S0.4 | Sidebar accordions | click each group header | collapse/expand, chevron rotates, state persists after reload |
| S0.5 | ⌘K palette | open, type a seeded party name (`Annapurna`) | result clickable → routes to Parties |

> S0.5 note: the palette searches **data** (documents/parties/items), not nav
> pages. On the masters-only seed there are no documents yet, so search a seeded
> party (`Annapurna`); once suite 04 has posted vouchers, "Voucher" resolves to
> those documents and routes to Vouchers.

---

## S1 — Settings (company, calendar, fiscal years, defaults)

Precondition: S0. Open **Settings**.

| ID | Test case | Steps | Expected |
|---|---|---|---|
| S1.1 | Calendar save | Section **Calendar**: BS, YYYY-MM-DD, 12h → **Save** | "✓ Saved"; header shows same |
| S1.2 | Company profile save | **Company Profile**: name `Syasyah Samaj`, PAN `123456789`, contact, email, address → **Save** | "✓ Saved"; reload → fields persist |
| S1.3 | Fiscal year visible | **Fiscal Settings** | table lists 2083-84 (2026-07-16 → 2027-07-15) Active, working-year radio ON |
| S1.4 | Add fiscal year | **Add Year** → 2084-85, start 2027-07-16, end 2028-07-15 (auto label) | row appears with label 2084-85, status Active |
| S1.5 | Close + reopen year | close 2084-85 → lock badge; reopen | Closed badge then Active |
| S1.6 | Delete extra year | delete 2084-85 | row gone; 2083-84 still working |
| S1.7 | Default accounts listed | **Default Accounts** | 14 roles each mapped to seeded account (AR→Accounts Receivable …); drag reorder works, **Save** persists |
| S1.8 | Chart of Accounts quick-add | **Chart of Accounts → New Account**: name `E2E Test`, type Expense → group dropdown only shows expense groups | account appears under Expenses; group filter works |
| S1.9 | Account delete | delete `E2E Test` | row gone |

---

## S2 — Account setup (Chart of Accounts page)

Precondition: S1. Route `/accounts` (Masters → Account Setup).

| ID | Test case | Steps | Expected |
|---|---|---|---|
| S2.1 | Seed chart visible | load page | 20 accounts in type sections (Assets 5, Liabilities 3, Equity 1, Income 3, Expenses 8); group shown as a column — empty groups (e.g. Fixed Assets) only appear in the create form's Group dropdown |
| S2.2 | Type → group filter | **New account** → Type Expense | Group lists only Direct/Indirect Expenses |
| S2.3 | Type switch clears group | pick group under Expense, then switch Type to Asset | group selection cleared automatically |
| S2.4 | Create account | Expense / Indirect Expenses / `E2E Rent Test` / code 7199 / opening 0 → Save | appears under Expenses; no cross-type rows |
| S2.5 | CSV export | click CSV | `accounts.csv` rows match visible table |
| S2.6 | Delete created | delete `E2E Rent Test` | gone; totals unchanged from S1 baseline |

---

## S3 — Masters (parties, items)

| ID | Test case | Steps | Expected |
|---|---|---|---|
| S3.1 | Parties seeded | `/parties` | 8 parties (4 customers, 3 vendors, 1 both) with PAN |
| S3.2 | Add party | **New Party**: `E2E Customer`, customer, PAN 399999999 | row appears; filter chips All/Customer/Vendor/Both work |
| S3.3 | Delete party | delete `E2E Customer` | gone |
| S3.4 | Items seeded | `/inventory` | 8 items with stock/price/reorder |
| S3.5 | Add item | `E2E Item`, code E2E-01, sale 500, purchase 300, qty 10 | stock row 10 on hand |

---

## S4 — Vouchers: the sequential month (core)

Precondition: S1–S3. Set FY = 2083-84. Create each doc on **Vouchers → New voucher**
(voucher card list at `/vouchers/new`), fill form, click **Save & post**.
Assert after every post: **exactly one** row, amount correct, number assigned,
sorting by Updated puts it on top, UPDATED shows local time.

**Dataset contract (dates inside FY 2083-84):**

| Step | Card | Party | Key lines | Net | VAT 13% | Gross | Expected number |
|---|---|---|---|---|---|---|---|
| S4.1 | Journal Entry | — | Bank 400,000 Dr / Cash 90,000 Dr / Petty 10,000 Dr / Capital 500,000 Cr | 500,000 | — | 500,000 | `JV-2083-84-0001` |
| S4.2 | Goods Received (GRN) | Kathmandu Wholesale Suppliers | Rice 300×70, Ghee 50×600, Dhup 100×150 | 66,000 | 0 | 66,000 | `GRN-2083-84-0001` |
| S4.3 | Purchase Invoice | Nepal Stationery House | office supplies 1×12,000 | 12,000 | 1,560 | 13,560 | `PI-2083-84-0001` |
| S4.4 | Payment | Nepal Stationery House | settle 13,560 bank | 13,560 | 0 | 13,560 | `PV-2083-84-0001` |
| S4.5 | Sales Invoice | Hotel Annapurna | Khada 50×120, Diyo 30×260, Dhup 40×220 | 22,600 | 2,938 | 25,538 | `SI-2083-84-0001` |
| S4.6 | Sales Invoice | Boudhanath Stupa Trust | Ghee 20×800, Rice 100×95 | 25,500 | 3,315 | 28,815 | `SI-2083-84-0002` |
| S4.7 | Receipt | Hotel Annapurna | settle 25,538 cash | 25,538 | 0 | 25,538 | `RV-2083-84-0001` |
| S4.8 | Delivery Challan | Patan Handicrafts | Thali 25×900 | 22,500 | 0 | 22,500 | `DC-2083-84-0001` |
| S4.9 | Credit Note | Boudhanath Stupa Trust | ref SI-2, returned Ghee 5×800 | 4,000 | 520 | 4,520 | `CN-2083-84-0001` |
| S4.10 | Petty Cash | — | refreshments 2,500 | 2,500 | 0 | 2,500 | `PC-2083-84-0001` |
| S4.11 | Sales Invoice | Thamel Tours & Travels | Candles 100×45, Khada 25×120 | 7,500 | 975 | 8,475 | `SI-2083-84-0003` |
| S4.12 | Journal Entry | — | Rent 35,000 Dr / Bank 35,000 Cr | 35,000 | — | 35,000 | `JV-2083-84-0002` |
| S4.13 | Journal Entry | — | Salaries 60,000 Dr / Bank 60,000 Cr | 60,000 | — | 60,000 | `JV-2083-84-0003` |

**Per-row assertions (every step S4.x):**

| ID | Test case | Steps | Expected |
|---|---|---|---|
| S4.A | No zero amount | after save, read Amount cell | equals gross from table (never 0); e.g. S4.5 shows **25,538.00** |
| S4.B | Single row (no dupe) | count rows with the number | exactly 1 |
| S4.C | Number format + sequence | read Number cell | `PREFIX-2083-84-####`; sequence per doc type: SI …0001→…0002→…0003 |
| S4.D | Sort by updated | reload list | newest on top (Updated local time) |
| S4.E | Status | status chip | **Posted** |

**Cross-cutting:**

| ID | Test case | Steps | Expected |
|---|---|---|---|
| S4.14 | Draft flow | **Save draft** on a new Sales Invoice to Kathmandu Traders (20 Khada, 50 Candles) | row appears **Draft**, no number; form reopens with **Save changes**; **Save & post** → number `SI-2083-84-0004`, single row |
| S4.15 | Backdate to other FY | create Journal Entry dated 2025-08-01 (FY 2082-83 legacy) | posting rejected or number uses legacy FY — per server rules |
| S4.16 | Full void VAT invoice | void S4.11 (reason) | doc flips **Void**; credit note `CN-2083-84-0002` generated; Sales + Sales Return register sum to 0 for that invoice |
| S4.17 | Partial void | S4.5 partially void 10 Khada | credit note net/VAT proportional (not zero VAT); voiding all lines flips doc to Void |

---

## S5 — Journal list (numbers + drill-down)

| ID | Test case | Steps | Expected |
|---|---|---|---|
| S5.1 | Journal rows numbered | `/journal` | every row from a voucher shows clickable **Number** (`JV-2083-84-0001` …); manual entry shows `—` |
| S5.2 | Drill to voucher | click a Number | VoucherViewModal opens with type/number/date/lines/net/tax/total; close works |
| S5.3 | Filters | status chips All/Draft/Posted/Void | lists filter correctly; search by number finds the row |

---

## S6 — Reports: expected outputs (acceptance)

After S4/S5 (assume S4.16/17 **not** run yet — or fold their deltas; the
canonical figures below are for the 13 seeded docs with no voids):

| ID | Test case | Route | Expected value |
|---|---|---|---|
| S6.1 | Trial balance | `/trial-balance` | balanced (debits = credits) |
| S6.2 | Ledger drill-down | click account (e.g. Bank) | ledger rows each show Number; click → voucher modal |
| S6.3 | AR outstanding | `/aging` | 2 parties open; total **32,770** (Boudha 24,295, Thamel 8,475) |
| S6.4 | Cash book | Daybooks → Cash & Bank | closing **115,538** cash-in-hand postings as seeded |
| S6.5 | Bank book | Daybooks | bank closing **291,440** (= 400,000 − 13,560 − 35,000 − 60,000) |
| S6.6 | Sales Register | `/reports/vat-register` → Sales | net **55,600**, VAT **7,228** |
| S6.7 | Sales Return Register | VAT Registers → Sales Return | −4,000 / −520 (negative red) |
| S6.8 | Purchase Register | VAT Registers → Purchase | net 12,000 / VAT 1,560 |
| S6.9 | Net VAT payable | VAT Registers footer | 7,228 − 520 − 1,560 = **5,148** |
| S6.10 | P&L | `/reports/pnl` | income/expense match seed print block |
| S6.11 | Balance sheet | `/reports/balance-sheet` | balanced; assets = liabilities + equity |
| S6.12 | Party statement | `/reports/party-statement` (Boudha) | rows show doc numbers; closing 24,295 |
| S6.13 | CSV/PDF/Print | each report | exported file mirrors visible rows |

---

## S7 — Journal/Transfers/BankRec audit regressions

| ID | Test case | Steps | Expected |
|---|---|---|---|
| S7.1 | LedgerModal (P&L) | P&L → click expense account | modal shows Number column; click → voucher opens |
| S7.2 | LedgerModal (Balance Sheet) | Balance Sheet → click account | same as S7.1 |
| S7.3 | Transfers | `/transfers` create 10,000 Bank→Bank (two illakas) | list shows Ref, both legs; no voucher number needed |
| S7.4 | Bank reconciliation | statement row matched | matched entry links to its voucher number (where model provides it) |

---

## S8 — Offline & sync (desktop/web parity)

| ID | Test case | Steps | Expected |
|---|---|---|---|
| S8.1 | Offline draft | go offline → create Sales Invoice draft | appears instantly, "needs sync" icon |
| S8.2 | Reconnect no dupe | go online, wait for flush | single row; server number replaces preview; no duplicate |
| S8.3 | Web vs desktop parity | same actions in browser (IndexedDB) and desktop (SQLite) | identical rows after sync |
| S8.4 | Pull across devices | device B creates party | appears on device A after sync |
| S8.5 | UpdatedAt local | compare UPDATED cell to wall clock | local time, AM/PM in 12h mode |

---

## Execution rules

1. Run suites in order S0 → S8; any failure stops the chain (serial).
2. Each assert compares **exact formatted values** — use a `money(text)` helper
   to normalize `"25,538.00"` → `25538`.
3. The seed block (`node billing-seed.mjs` end) prints TB/AR/stock/aging/P&L/BS —
   S6 values must equal it; if they disagree, the doc above wins for
   hand-computed figures and the seed wins for engine-computed (COGS/stock).
4. Add a new scenario = add a row to `dataset.json`, not new spec code.

---

## How to run (Playwright)

Prereqs: Postgres reachable (defaults to the repo `.env` `DATABASE_URI`), `billing-seed.mjs`
(root) available. **The run is fully self-contained on dedicated ports** — Playwright boots
Payload on `:3100` (own `.next-e2e` build dir) and the SPA on `:5174` (Vite proxy pointed at
`:3100`) from scratch, and tears them down afterwards. It never touches a running dev server
on `:3000`/`:5173`, but it **does share the same database** as local dev.

1. **Install the browser** (first time only):
   ```bash
   cd apps/billing && npx playwright install chromium
   ```
2. **Run the whole chain** — servers start/stop automatically, and the `00-seed`
   setup project bootstraps + seeds the DB (masters-only) before any test runs:
   ```bash
   cd apps/billing && pnpm test:e2e
   ```
   Run a subset (dependencies still run first): `pnpm test:e2e --project=04-vouchers`
   Dry-list: `pnpm test:e2e --list`

   **Database**: defaults to the repo `.env` `DATABASE_URI` (shared dev DB — the seed
   is idempotent, but for a *full* run the DB must be masters-only, i.e. no vouchers,
   so numbering is deterministic). For an isolated/fresh DB, point at your own Postgres:
   ```bash
   E2E_DATABASE_URI=postgresql://user:pass@host:5432/fresh_db pnpm test:e2e
   ```
   The bootstrap creates the `default` tenant and admin automatically on a fresh DB
   (needs `psql` on PATH for those two one-time SQL steps).

   Overrides (env): `E2E_API_PORT` / `E2E_WEB_PORT` (defaults 3100 / 5174),
   `E2E_DATABASE_URI`, `BASE_URL`, `E2E_EMAIL` / `E2E_PASSWORD`.

   Note: the e2e `next dev` boot adds `.next-e2e` references to `tsconfig.json` /
   `next-env.d.ts` (Next auto-config). Revert with `git checkout -- tsconfig.json next-env.d.ts`
   if you want a perfectly clean tree after a run.

Key files: `e2e/dataset.json` (the 13-voucher month + all expected numbers — add a
scenario by adding a row, not spec code), `e2e/helpers/*` (API client, money parser,
UI actions, voucher driver), `e2e/specs/00…07` in dependency order.
