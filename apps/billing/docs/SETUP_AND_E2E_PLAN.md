# Sequential Setup + E2E Test Plan — Afno Billing

> Goal: a **single, repeatable, sequential journey** — company settings → fiscal
> year → chart of accounts → masters → vouchers → reports — that is (a) a usable
> onboarding flow for the app, and (b) a Playwright test that walks the exact
> same path with a **fixed dataset** and **asserts exact expected outputs** at
> every stage.

---

## 0. Verdict on the current sequential flow (your question)

**The accounting order today is correct, but it is not *enforced* and not
*guided*.** Anyone can navigate to any page in any order; the app only fails at
post time ("missing accounts block posting"), which is exactly the draft-then-
stuck loop you hit. My recommendation is a 3-part hardening, and the Playwright
suite is built to prove each part:

| Gap | Today | Recommended |
|---|---|---|
| Order not enforced | Create voucher before any account exists → posting fails cryptically | **Setup gate**: a Setup Checklist overlay/page; voucher *posting* disabled with a "Finish setup first (2 steps left)" pointer until fiscal year + default accounts exist |
| Order not guided | New user lands on Dashboard with empty everything | **Onboarding card on Dashboard**: ① Company profile → ② Fiscal year → ③ Chart of accounts → ④ Default accounts → ⑤ Masters → ⑥ First voucher; each step links to the right page and ticks off |
| Draft → Post ambiguity | Two actions; drafts can be forgotten, then "stuck at 0 / not in table" | Keep both, but make the **primary button "Save & Post"** with a count badge of unposted drafts on the Vouchers list header; a draft never silently hides from the table (status column shows Draft) |
| No acceptance criteria | Hard to know if a month is "done" | **Month-close checklist** (future): every doc posted, VAT register = output − input, TB balanced, before a year can be closed |

This plan's Phase 1–4 are the *target flow*; Phases 5–7 are the tests that lock it in.

---

## 1. Phase map (what gets built / tested, in order)

```
Phase 0  Environment prep .......... reset DB, seed, start servers, login
Phase 1  Settings ................. company profile, calendar, fiscal year, features
Phase 2  Account setup ............ chart of accounts (groups → accounts → defaults)
Phase 3  Masters .................. parties, items
Phase 4  Vouchers ................. the 13-doc sequential accounting month (post every doc)
Phase 5  Reports & verification ... TB, P&L, BS, VAT registers, cash/bank books vs expected table
Phase 6  Playwright automation .... spec files mirroring Phases 1–5, serial order, fixtures
Phase 7  Final acceptance ......... one-command run, exit 0 = ship
```

Phases 1–5 are **both** the manual QA script **and** the Playwright spec body —
one dataset, one expected-output table, two execution modes.

---

## 2. Phase 0 — Environment prep (once)

| Step | Command / action | Expected |
|---|---|---|
| 0.1 | Server typecheck | `npx tsc --noEmit` clean |
| 0.2 | SPA typecheck | `cd apps/billing && npx tsc --noEmit` clean |
| 0.3 | Reset DB + seed | `node billing-seed.mjs` (fresh or resumable); note the printed verification block — that is the golden output |
| 0.4 | Start servers | Payload on :3000, SPA on :5173 |
| 0.5 | Login | admin credentials (aayurtshrestha@gmail.com / SyashaAdmin2026!) → Dashboard |

> The seed is intentionally the dataset. Every number in this plan is computed
> from the seeded vouchers below, so "test everything" = "verify every number
> the seed prints, plus the UI-only states (drafts, filters, numbering)".

---

## 3. Phase 1 — Settings (Settings page)

Open **Settings** and set each section. This is also the Setup Checklist step ①–②.

| Section | Input | Value |
|---|---|---|
| Calendar | Calendar type / date / time | BS · YYYY-MM-DD · 12h (or whatever prod uses — record it) |
| Company Profile | Name | *test company*, e.g. `Syasyah Samaj` |
| | PAN | `123456789` |
| | Contact / Email / Address | test values |
| Fiscal Settings | Verify seeded year | **2083-84** = 2026-07-16 → 2027-07-15, status Active, working year radio ON |
| | Add a second year | 2084-85 = 2027-07-16 → 2028-07-15 (auto-label check) |
| | Close it, reopen it | lock badge, then unlock |
| Feature Toggles | Bank Rec / Simplified Invoice | record current state |
| Default Accounts | All 14 roles mapped to seeded accounts (see Phase 2) | AR=Accounts Receivable, AP=Accounts Payable, Sales Revenue, Purchases/Expense, VAT (Input/Output), Cash in Hand, Bank Account, Petty Cash, Inventory, COGS, Returns, Accrued Payables |

**Assert:** save each section → "✓ Saved"; reload → values persist; header FY
switcher shows 2083-84 with check, 2084-85 unlocked.

---

## 4. Phase 2 — Account setup (Chart of Accounts)

Navigate **Masters → Account Setup** (route `/accounts`). The seed already
created 7 groups + 20 accounts — the test *verifies* them, then adds one of
each type to exercise the type→group filter.

**Verify seeded chart** (group / type / code):

| Group | Type | Accounts (code) |
|---|---|---|
| Current Assets | asset | Cash in Hand 1010, Petty Cash 1020, Bank 1030, AR 1100, Inventory 1200 |
| Fixed Assets | asset | — |
| Current Liabilities | liability | AP 2100, Accrued Payables 2200, VAT 2300 |
| Capital & Reserves | equity | Capital 4000 |
| Income | income | Sales 5000, Service 5100, Returns 5200 |
| Direct Expenses | expense | Purchases 6100, COGS 6200 |
| Indirect Expenses | expense | Rent 7100, Salaries 7200, Utilities 7300, Office Supplies 7400, Transportation 7500, Misc 7900 |

**Add-test (the filter regression):**
1. New account → Type **Expense** → Group dropdown lists only Direct/Indirect
   Expenses (no Current Assets).
2. Pick Type **Asset** → previously picked expense group clears automatically.
3. Create `Test Expense — Office Rent` under Indirect Expenses, opening balance 0.
4. Delete it again → row disappears; CSV export matches visible rows.

**Assert:** no account shows under a wrong type; group list follows type;
type switch clears mismatched group.

---

## 5. Phase 3 — Masters

| Master | Verify seeded | Add one |
|---|---|---|
| Parties (`/parties`) | 8 seeded (3 vendors, 4 customers, 1 both) with PAN | `Test Customer — E2E`, PAN 399999999, type customer |
| Items (`/inventory`) | 8 seeded with stock/price/reorder | `E2E Test Item`, code E2E-01, sale 500, purchase 300, qty 10 |

---

## 6. Phase 4 — The sequential voucher month (core)

Post each doc **in this exact order** (order matters — credit note references
SI-2, receipt references SI-1). Expected number uses the **new FY-label
format** `PREFIX-2083-84-NNNN` (FY 2083-84).

| # | Doc type | Date | Party | Lines (qty × rate) | Tax | Net | VAT | Gross | Expected number |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Journal Voucher | 07-16 | — | Bank 400,000 Dr · Cash 90,000 Dr · Petty Cash 10,000 Dr · Capital 500,000 Cr | — | 500,000 | — | 500,000 | `JV-2083-84-0001` |
| 2 | GRN | 07-18 | KWS | Rice 300×70 · Ghee 50×600 · Dhup 100×150 | 0% | 66,000 | 0 | 66,000 | `GRN-2083-84-0001` |
| 3 | Purchase Invoice | 07-20 | NSH | Office supplies 1×12,000 | 13% | 12,000 | 1,560 | 13,560 | `PI-2083-84-0001` |
| 4 | Payment Voucher | 07-22 | NSH | settle 13,560 (bank) | 0% | 13,560 | 0 | 13,560 | `PV-2083-84-0001` |
| 5 | Sales Invoice | 07-24 | Hotel | Khada 50×120 · Diyo 30×260 · Dhup 40×220 | 13% | 22,600 | 2,938 | 25,538 | `SI-2083-84-0001` |
| 6 | Sales Invoice | 07-28 | Boudha | Ghee 20×800 · Rice 100×95 | 13% | 25,500 | 3,315 | 28,815 | `SI-2083-84-0002` |
| 7 | Receipt Voucher | 07-30 | Hotel | settle 25,538 (cash) | 0% | 25,538 | 0 | 25,538 | `RV-2083-84-0001` |
| 8 | Delivery Challan | 08-02 | Patan | Thali 25×900 | 0% | 22,500 | 0 | 22,500 | `DC-2083-84-0001` |
| 9 | Credit Note | 08-04 | Boudha | ref SI-2, returned Ghee 5×800 | 13% | 4,000 | 520 | 4,520 | `CN-2083-84-0001` |
| 10 | Petty Cash | 08-06 | — | refreshments 2,500 | 0% | 2,500 | 0 | 2,500 | `PC-2083-84-0001` |
| 11 | Sales Invoice | 08-08 | Thamel | Candles 100×45 · Khada 25×120 | 13% | 7,500 | 975 | 8,475 | `SI-2083-84-0003` |
| 12 | Journal Voucher | 08-10 | — | Rent 35,000 Dr / Bank 35,000 Cr | — | 35,000 | — | 35,000 | `JV-2083-84-0002` |
| 13 | Journal Voucher | 08-12 | — | Salaries 60,000 Dr / Bank 60,000 Cr | — | 60,000 | — | 60,000 | `JV-2083-84-0003` |
| — | 5 drafts | 08-13/14 | KT, Everest, KWS | exercise draft state (never posted) | — | — | — | — | no number |

**Per-voucher assertions (the regressions):**
- Amount shown after save = amount entered (never 0). e.g. #5 gross **25,538** on the row.
- **Save & Post creates exactly one row** — no duplicate (the old bug).
- Row sorts to top by **updatedAt**; UPDATED column shows **local time** in the
  configured 12h/24h format.
- Drafts appear with a Draft badge + sync icon; posting gives them their number.
- Preview number in the form (`/vouchers/new/...`) equals the number after posting.
- Invoice #5 and #6 are sequential (…0001, …0002); #11 is …0003 even though a
  credit note (…0001) sits between them in time — numbering is per doc-type.

---

## 7. Phase 5 — Reports & expected outputs (the acceptance table)

After Phase 4, the seeded month must produce exactly these figures. **This table
is the dataset's contract** — Playwright asserts it against the UI, the seed's
verification block asserts it against the API.

| Report / check | Expected value | Where to see it |
|---|---|---|
| Trial Balance | debits = credits (balanced) | `/trial-balance` |
| Total debit/credit | 500,000 + 66,000 + … — **balanced**, equals API `tb.totals` | API block |
| AR ledger closing | 32,770 = SI1 25,538 + SI2 28,815 + SI3 8,475 − RV 25,538 − CN 4,520 | `/reports/party-statement` (Hotel = 0, Boudha = 24,295) |
| AP ledger closing | 0 = PI 13,560 − PV 13,560 (GRN posts stock, not AP) | party-statement (NSH = 0) |
| Sales Register (net/VAT) | 55,600 / 7,228 = Σ SI1+SI2+SI3 | `/reports/vat-register` → Sales tab |
| Sales Return Register | −4,000 / −520 = CN | VAT Registers → Sales Return |
| Purchase Register | 12,000 / 1,560 | VAT Registers → Purchase |
| Net VAT payable | output 7,228 − return 520 − input 1,560 = **5,148** | VAT Registers footer |
| Cash book closing | 115,538 = 90,000 (opening) + 25,538 (RV) | Daybooks → cash |
| Bank book closing | 291,440 = 400,000 − 13,560 (PV) − 35,000 (rent) − 60,000 (salaries) | Daybooks → bank |
| P&L | income 51,600 (55,600 − 4,000 returns) − expenses 109,500 (purchases 12,000 + petty 2,500 + rent 35,000 + salaries 60,000) → net loss −57,900 *before COGS/stock valuation* — **use the seed's printed P&L as ground truth** | `/reports/pnl` |
| Balance sheet | assets = liabilities + equity (balanced) | `/reports/balance-sheet` |
| Stock | on-hand/avg/value per item match seed block; rice on-hand 200, ghee 130, etc. | Inventory / stock report |
| AR aging | 2 parties open (Boudha 24,295, Thamel 8,475), total 32,770 | `/aging` |
| Voucher numbers | list shows `SI-2083-84-0001…0003`, `JV-2083-84-0001…0003`, etc. | Vouchers list |
| Drafts | 5 rows with Draft status, zero numbers | Vouchers list (status filter) |

> ⚠️ COGS/stock valuation makes exact P&L depend on the averaging engine, so the
> *authoritative* expected values are the ones the seed prints at the end of
> `billing-seed.mjs` (TB, AR, stock, aging, P&L, BS, cash book). This table pins
> the hand-computable values; the seed block pins the engine-computed ones. The
> dataset fixture should snapshot both.

---

## 8. Phase 6 — Playwright automation

Not installed yet → first add it (root or `apps/billing`):
`pnpm --dir apps/billing add -D @playwright/test && npx playwright install chromium`.

### Architecture

```
apps/billing/e2e/
├── playwright.config.ts      # baseURL http://localhost:5173, webServer starts both, retries=1, workers=1 (serial!)
├── fixtures/
│   ├── dataset.json          # golden dataset: chart, masters, voucher matrix, expected outputs (Phase 7 table)
│   └── auth.setup.ts         # login once → storageState for reuse (fast, no re-login per spec)
├── helpers/
│   └── ui.ts                 # typed selectors: getByRole/name + data-tour hooks; money() normalizes "25,538" → 25538
└── specs/
    ├── 01-settings.spec.ts   # Phase 1 (serial)
    ├── 02-accounts.spec.ts   # Phase 2 (serial)
    ├── 03-masters.spec.ts    # Phase 3 (serial)
    ├── 04-vouchers.spec.ts   # Phase 4 — the big one, 13 docs looped from dataset.json
    ├── 05-reports.spec.ts    # Phase 5 — asserts every row of expected-outputs
    └── 06-offline.spec.ts    # bonus: offline draft → reconnect → flush (no dupes)
```

### Sequential-input design (your requirement)

- **`workers: 1` + `test.describe.serial()`** — specs run in file order, each
  step depends on the previous. This is the whole point: the test *is* the flow.
- One dataset (`dataset.json`) drives the loop: `for (const doc of dataset.vouchers) { await createAndPost(doc); expect(amount).toBe(doc.gross); }` — adding a new test doc = adding a row to the JSON, not new test code.
- Selectors: prefer role/name; where the UI lacks stable hooks, add `data-testid`/`data-tour` attributes in the app (cheap, and the Tour already uses `data-tour`).
- Money normalization helper: parse Nepali-formatted numbers (`"25,538"`, `रु` prefix) so asserts compare `25538` not string.
- Seed hook: specs assume a **fresh seeded DB** (Phase 0). A `beforeAll` calls the seed via API or `billing-seed.mjs` when `RESET_DB=1`, else asserts the data exists (resumable).

### Commands

| Command | Action |
|---|---|
| `pnpm --dir apps/billing exec playwright test` | full sequential run, exit 0 = pass |
| `pnpm --dir apps/billing exec playwright test 04-vouchers` | single phase |
| `pnpm --dir apps/billing exec playwright test --trace on` | trace on failure |
| `pnpm --dir apps/billing exec playwright show-report` | HTML report |

---

## 9. Phase 7 — Final acceptance

A green run of the whole suite is the release gate:

- [ ] `01-settings` → `02-accounts` → `03-masters` → `04-vouchers` → `05-reports` all pass in sequence on a fresh seed.
- [ ] Every row of the Phase 7 expected-outputs table asserted, not eyeballed.
- [ ] No console errors captured (Playwright pageerror listener fails the test).
- [ ] Offline spec passes (draft offline → sync → single row, correct number).
- [ ] Typechecks clean; `payload generate:types` run if collections changed.
- [ ] Report generated & archived per release.

---

## 10. Phased delivery (how to build this)

| Milestone | Scope | Exit criterion |
|---|---|---|
| **M1 — Setup gate (product)** | Setup Checklist on Dashboard + posting guard with "finish setup" pointer; drafts badge on Vouchers | New user can complete setup in 6 guided clicks; posting impossible before defaults exist |
| **M2 — Playwright skeleton** | `@playwright/test` + config + auth setup + `01-settings` + `02-accounts` | First 2 specs green on fresh seed |
| **M3 — Dataset + vouchers** | `dataset.json` + `04-vouchers` loop + money helper | 13 docs post with exact gross; no dupes; numbering asserted |
| **M4 — Reports + acceptance** | `05-reports` asserts full expected-outputs table; CI-able command | Full sequential run green; regression matrix (R1–R9 from TEST_PLAN.md) folded in |
| **M5 — Offline + hardening** | `06-offline`; fold into release checklist | Release gate = single command, exit 0 |

---

## 11. Open decisions

1. **Playwright location**: inside `apps/billing` (uses its Vite config; nearest) — recommended, vs a new root `e2e/` workspace. → *recommended: apps/billing/e2e*
2. **Setup gate (M1) scope**: Dashboard checklist card only (light, recommended now) vs a full blocking onboarding wizard (heavier). → *light card first*
3. **Dataset freshness**: `RESET_DB=1` reseeds in `beforeAll` (always-reproducible, recommended) vs assert-existing (faster iterating). → *RESET_DB flag, default on in CI*