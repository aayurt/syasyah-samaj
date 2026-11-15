# Syasyah Samaj vs Manager.io — accounting feature comparison

**Source of truth for Manager.io:** its own guide navigation at <https://www.manager.io/guides> (50+ modules), read 2026-11-15. The guide pages themselves are placeholder stubs, so the sidebar module list is the authoritative feature inventory; the homepage feature set was used as the cross-check.

**Compared against:** `syasyah-samaj` at commit `8336ebd3` — both the Payload backend (`src/collections/`) and the billing SPA (`apps/billing/src/`). Every row below was checked against the source, not assumed.

**How to read the tables:** ✓ = implemented and reachable in the product · — = not implemented. "Backend only" means the server-side collection/field exists but the SPA exposes no way to use it.

---

## 1. Module-by-module comparison

| Module | Manager.io | Syasyah Samaj | Notes |
|---|---|---|---|
| Summary dashboard | ✓ | ✓ | Dashboard + Trial Balance / P&L / Balance Sheet |
| Bank and cash accounts | ✓ | ✓ | Account types `cash` / `bank` |
| Receipts | ✓ | ✓ | `receipt-voucher` |
| Payments | ✓ | ✓ | `payment-voucher` |
| Inter-account transfers | ✓ | ✓ | `contra` + `Transfers.tsx` |
| Bank reconciliations | ✓ | ✓ | `BankReconciliation.tsx`, `bank-statements` collection |
| Expense claims | ✓ | ✓ | `ExpenseClaims.tsx` |
| Customers / Suppliers | ✓ | ✓ | `Parties.tsx` (customer / vendor / both) |
| Sales quotes | ✓ | ✓ | `sales-quote` doc type |
| Sales orders | ✓ | — | **Backend only** — `sales-order` in `src/collections/Documents/index.ts:18`, absent from the SPA |
| Sales invoices | ✓ | ✓ | `sales-invoice` |
| Credit notes | ✓ | ✓ | `credit-note` |
| Late payment fees | ✓ | — | No fee calculation or posting |
| Billable time | ✓ | — | No time-entry collection |
| Withholding tax receipts | ✓ | ✓ | Tax nature `withholding` (`Documents/index.ts:2908`) |
| Delivery notes | ✓ | ✓ | `delivery-challan` |
| Purchase quotes | ✓ | — | No `purchase-quote` doc type |
| Purchase orders | ✓ | — | **Backend only** — `purchase-order` in `src/collections/Documents/index.ts:20`, absent from the SPA |
| Purchase invoices | ✓ | ✓ | `purchase-invoice` |
| Debit notes | ✓ | ✓ | `debit-note` |
| Goods receipts | ✓ | ✓ | `grn` |
| Projects / cost centres | ✓ | — | No project dimension on any collection |
| Inventory items | ✓ | ✓ | `Items.tsx`, stock ledger, valuation report |
| Inventory transfers | ✓ | — | No transfer doc type |
| Inventory write-offs | ✓ | — | No write-off doc type |
| Production orders | ✓ | — | No BOM / work-order support |
| Employees | ✓ | ✓ | `Employees` collection, payroll module |
| Payslips | ✓ | ✓ | `Payroll.tsx`, payslip printing |
| Investments | ✓ | — | No investment collection |
| Fixed assets | ✓ | ✓ | Backend + **SPA page added 2026-11-15** (see §3) |
| Depreciation entries | ✓ | ✓ | Server engine posts one journal entry per month |
| Intangible assets | ✓ | — | No intangible-asset collection |
| Amortization entries | ✓ | — | Not implemented |
| Capital accounts | ✓ | — | No capital-account concept |
| Special accounts | ✓ | — | No special-account concept |
| Folders | ✓ | — | No document grouping |
| Journal entries | ✓ | ✓ | `Journal.tsx`, `journal-voucher` |
| Reports | ✓ | ✓ | 17 reports in `apps/billing/src/pages/reports/` |
| Settings | ✓ | ✓ | `Settings.tsx`, per-illaka scopes |
| Tax / VAT registers | ✓ | ✓ | `TaxSales`, `TaxPurchase`, `VatRegister` |
| Aging (AR / AP) | ✓ | ✓ | `Aging.tsx` |
| Party statements | ✓ | ✓ | `PartyStatement.tsx` |
| Payroll + statutory registers | — | ✓ | Nepali/Indian payroll, TDS projection — syasyah ahead |
| Offline-first outbox sync | — | ✓ | IndexedDB / SQLite outbox — syasyah ahead |
| Nepali calendar + Devanagari digits | — | ✓ | BS/AD calendar, `nepaliDigits` — syasyah ahead |
| Multi-illaka consolidation | — | ✓ | Tenant switcher, consolidated view — syasyah ahead |
| Comparatives (prior period) | ✓ | — | Single-period reports only |
| Cash flow statement | ✓ | — | `CashStatement.tsx` is a cash-book, not a cash-flow statement |
| Drill-down report → ledger | ✓ | ✓ | Balance Sheet + P&L click an account → opens the ledger |
| Billable expenses → invoice | ✓ | ✓ | `ExpenseClaims.tsx:145` creates an invoice from billable claims |
| Email invoices / statements | ✓ | — | Print / PDF / CSV only |
| Customer portal | ✓ | — | Not implemented |
| Approvals (general voucher queue) | ✓ | — | Only payroll runs + expense claims have approval states |

---

## 2. Gaps that are actually missing

Ordered by what a Nepali community/NGO accountant would hit first.

| # | Gap | Why it matters | Evidence |
|---|---|---|---|
| 1 | **Sales Order UI** | Backend doc type exists; the SPA cannot create one. Quote → Order → Invoice is broken at the first step, and this is the "sequential flow" the user asked about. | `src/collections/Documents/index.ts:18` vs `apps/billing/src/pages/Vouchers.tsx:63-75` (`DOC_TYPES`) |
| 2 | **Purchase Order UI** | Same for procure-to-pay: PO → GRN → Purchase Invoice has no PO step in the UI. | `src/collections/Documents/index.ts:20` vs `Vouchers.tsx:63-75` |
| 3 | **General approvals queue** | The nav item `/approvals` is `disabled: true` with no page and no route. Only payroll runs and expense claims have approval states. A treasurer cannot approve a voucher before posting. | `apps/billing/src/App.tsx:147`; `src/collections/PayrollRuns.ts:53` |
| 4 | **Comparative reporting** | No prior-period / last-year comparison on any report — the single most requested accountant feature. | no `comparative` / `priorPeriod` handling in `apps/billing/src/pages/reports/` |
| 5 | **Cash flow statement** | `CashStatement.tsx` is a cash book (receipts and payments). A proper cash-flow statement (operating / investing / financing) does not exist. | `apps/billing/src/pages/reports/CashStatement.tsx` |
| 6 | **Email invoices and statements** | Documents can only be printed or exported. `resend` is already a dependency, so the plumbing cost is low. | no `resend` / `sendEmail` usage anywhere in `apps/billing/src/` |
| 7 | **Projects / cost centres** | No way to see which project or hall a cost belongs to — essential for a multi-hall organisation. | no `project` field on any collection |
| 8 | **Late payment fees** | Overdue invoices are tracked in Aging but no fee is calculated or posted. | no `lateFee` handling in `apps/billing/src/` |
| 9 | **Billable time** | No time entries to bill. | no time-entry collection |
| 10 | **Investments, intangible assets, amortisation** | Three related asset classes missing; only straight-line fixed assets exist. | `src/collections/` has `FixedAssets` only |
| 11 | **Inventory transfers / write-offs** | Stock can be received (GRN) and issued, but not moved between locations or written off. | no transfer/write-off doc type |
| 12 | **Folders / document grouping** | No way to group related documents for an auditor. | — |
| 13 | **Purchase quotes** | Only sales quotes exist; the purchasing side starts at PO. | `DOC_TYPES` in `Documents/index.ts:17-32` |
| 14 | **Customer portal** | Customers cannot view or pay their own invoices. | — |

---

## 3. What was fixed in this pass (2026-11-15)

### Fixed Assets SPA page — the biggest single gap

The backend was complete and paid for: `src/collections/FixedAssets/index.ts` implements the collection, a straight-line depreciation engine that posts one journal entry per month, `GET /fixed-assets/register`, and `POST /fixed-assets/:id/depreciate`. The collection was registered in `src/payload.config.ts`.

**But the SPA had no page for it and the nav item was `disabled: true`** — the feature was unreachable.

Now:
- `apps/billing/src/pages/FixedAssets.tsx` — asset register table, totals cards (cost / accumulated depreciation / net book value), create / edit / delete, a **Depreciate** action that posts the server-side depreciation, CSV export, search and sortable columns.
- `apps/billing/src/App.tsx` — route `/fixed-assets` added, nav item enabled.
- `apps/billing/src/lib/i18n/en.ts` + `ne.ts` — a `fixedAssets` namespace (22 keys, full en/ne parity).
- `apps/billing/src/pages/FixedAssets.test.tsx` — 10 tests covering the register load, the depreciation POST, the create payload, the empty state, the error state, and the `monthlyDepreciation` helper.

### Fresh-database schema setup (`pnpm db:setup`)

The repo's migration chain **cannot bootstrap an empty database**: migration #14 (`20260819_p2_tally_vouchers_tax`) inserts into `tax_types`, but that table is only created by the later migration #21 (`20261011_045410___name`). Running `payload migrate` on a fresh database fails with `relation "tax_types" does not exist`.

`payload generate:db-schema` is not a schema-creation step either — it only writes `src/payload-generated-schema.ts`, a TypeScript file that does not pass `tsc`.

The schema the app actually runs against comes from Payload's **dev-mode schema push** (`@payloadcms/db-postgres`'s connect hook pushes when `NODE_ENV !== 'production'` and `PAYLOAD_MIGRATING !== 'true'`). `scripts/db-setup.ts` performs that push deterministically and verifies the tables exist before exiting.

Verified: a brand-new database goes from 0 tables to **179 tables** (including `tax_types`), and the root production build then prerenders **22 routes with no SQLSTATE errors**.

The CI `root-build` job now runs `pnpm db:setup` instead of `payload generate:db-schema`.

---

## 4. Recommended new features — priority order

| Priority | Feature | Value | Effort | Why this order |
|---|---|---|---|---|
| 1 | **Sales Order + Purchase Order SPA pages** | Unlocks the two order flows whose backend already exists | **Low** — the doc types and fields are written; this is UI + wiring | Highest value per unit of work in the whole backlog |
| 2 | **General approvals queue** | Lets a treasurer approve before posting — the governance gap the disabled nav item hints at | Medium — a voucher status + approval endpoint + queue page | Every accounting team asks for this first |
| 3 | **Comparative reporting** (this FY vs last FY, this month vs last month) | Turns static reports into a decision tool | Low-Medium — a period-offset parameter plus comparison columns | Small change, immediately visible value |
| 4 | **Email invoices and statements** | Customers get the bill without asking | Low — `resend` is already installed and the email adapter is already configured | Cheapest user-visible win |
| 5 | **Cash flow statement** | Required for auditors and for the annual report | Medium — operating / investing / financing classification over the journal | Fills a standard financial-statement hole |
| 6 | **Drill-down from every report figure** | Balance Sheet and P&L already do this; extend to Aging, Party Statement, Tax reports | Low — the ledger modal already exists | Finish the pattern that is half-built |
| 7 | **Projects / cost centres** | Per-hall and per-project profitability | Medium — a dimension on documents plus report filters | Enables budget work later |
| 8 | **Budget vs actual** | The natural next step once projects exist | Medium-High — budget collection plus variance report | The most requested long-term feature |
| 9 | **Late payment fees** | Automates a rule committees often set by hand | Low-Medium — a settings rule plus a posting on the aging report | Small, contained |
| 10 | **Customer portal** | Customers self-serve | High — auth, scoping, payment | Later; needs product decisions |

### Suggested sequencing

1. Now: Sales Order + Purchase Order pages (unlock existing backend).
2. Next: approvals queue + comparative reporting.
3. Then: email invoices + drill-down everywhere + cash flow statement.
4. Later: projects, budgets, customer portal.

---

## 5. What is explicitly *not* a gap

Several common "missing" items are actually present — worth stating so they are not re-litigated:

- **Billable expenses** — implemented, including creating an invoice from unbilled billable claims (`ExpenseClaims.tsx:145`).
- **Drill-down reports** — Balance Sheet and P&L rows open the account ledger.
- **Withholding tax (TDS)** — tax nature `withholding` is supported and the payroll module projects it.
- **VAT register** — `VatRegister.tsx` with sales and purchase modes.
- **Multi-business consolidation** — the tenant switcher's "All (consolidated)" mode.
- **Fixed assets and depreciation** — now fully reachable (see §3).
- **Credit and debit notes** — both in the SPA and in the VAT purchase/sales reports.
- **Expense claims and payroll approval states** — both have draft → submitted → approved workflows, even though a *general* voucher approval queue is missing.
