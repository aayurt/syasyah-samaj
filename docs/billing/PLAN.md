# Accounting & Inventory Module — Plan & Design

**Status:** Draft v1 · **Context:** syasyah-samaj (Payload 3.75 + Next 15 + Postgres + multi-tenant plugin, better-auth)
**Goal:** Billable-style *Complete Accounting & Inventory Management*, delivered as a clean, separate React UI backed by Payload/Postgres — with a Tauri desktop/offline wrapper as a later phase. Tenant/ilaka scoping is **optional** (see §8).

---

## 1. Vision & non-goals

**We build:** double-entry bookkeeping with source documents (vouchers), daybooks, general ledger, trial balance, P&L / balance sheet, AR/AP aging, inventory (items, GRN/challan, stock ledger, COGS), invoices with PDF export. Keyboard-first, professional UI in the spirit of Billable.

**We don't build in v1:** payroll, tax filing, multi-currency, fixed-asset depreciation, bank-statement auto-import (BRS can come later), barcode scanning.

**Guiding principle (from the bookkeeping taxonomy):** one source of truth — *accounts + journal + typed source documents*. Everything else (daybooks, ledgers, reports) is a *derived view over the journal*, not stored data.

---

## 2. Architecture

```
React SPA (Vite + TS + Tailwind, standalone)  ──►  Payload REST  ──►  Postgres (source of truth)
        │                                              ▲
        └── (Phase 2) Tauri 2 shell: local SQLite cache + outbox sync
```

- **UI lives in `apps/billing/`** inside this repo (own `package.json`, no workspace changes needed). Same app serves browser and desktop.
- **Auth:** reuse the existing better-auth setup (auto-injected endpoints); SPA login with session cookie; module gated on `admin` / `super-admin` roles.
- **Tenant (optional):** records carry a nullable `tenant` relationship (ilaka) as metadata only — not registered with `multiTenantPlugin`, not enforced. The module is fully usable with a single set of books.

---

## 3. Domain model — Payload collections

All collections carry an **optional nullable `tenant` relationship** (ilaka) — metadata only in v1, no plugin registration, no enforced scoping.

| Collection | Key fields | Notes |
|---|---|---|
| `accountGroups` | `name`, `code`, `type` (asset / liability / equity / income / expense), `parent` (self-relation, hierarchy) | Chart-of-accounts tree |
| `accounts` | `code`, `name`, `group` (→ accountGroups), `type`, `class` (cash / bank / other), `openingBalance`, `active`, `allowManualPosting` | GL accounts; cash/bank class powers cash book & BRS |
| `parties` | `type` (customer / vendor / both), `name`, `email`, `phone`, `taxId`, `address`, `openingBalance` | Needed for AR/AP aging |
| `items` | `code`, `name`, `unit`, `conversionUnit` + `conversionRate`, `valuationMethod` (fifo / avco), `reorderLevel`, `openingStock`, `salePrice`, `purchasePrice` | Inventory SKUs |
| `documents` | `docType` (enum, §4), `direction` (inbound/outbound/internal), `number` (auto per type+year, optionally per tenant), `date`, `party`, `lines[]` (description, qty, rate, tax, amount), `totals` (gross/tax/net), `status` (draft / posted / void), `referenceTo` (credit/debit notes), `paymentMethod`, `bankAccount`, `journalEntry` (link to posting) | The voucher taxonomy — one collection, typed |
| `journalEntries` | `date`, `narration`, `referenceDoc`, `lines[]` (account, debit, credit), `status` (draft / posted / void), `postedAt` | Double-entry core; validation: Σdebit = Σcredit, one side per line, amount > 0 |
| `stockMovements` | `item`, `doc`, `date`, `qtyIn`, `qtyOut`, `unitCost`, `location` | Stock ledger source |

**Deliberate simplifications:** bank accounts are `accounts` with `class = bank` (no separate collection); payment/receipt vouchers are `documents`, not a separate `payments` collection — every cash movement is a document that posts to cash/bank.

---

## 4. The posting engine (the heart)

Each `docType` has a **posting rule** derived from the taxonomy:

| docType | Posting (debit → credit) |
|---|---|
| `sales-invoice` | Accounts Receivable → Sales Revenue, Output Tax |
| `purchase-invoice` | Expense / Inventory → Accounts Payable |
| `payment-voucher` | Accounts Payable / Expense → Cash or Bank |
| `receipt-voucher` | Cash or Bank → Accounts Receivable / Income |
| `credit-note` | Sales Returns / Discount → Accounts Receivable |
| `debit-note` | Accounts Payable → Purchase Returns / Discount |
| `petty-cash-voucher` | Minor Expense → Petty Cash |
| `grn` | Inventory / Unbilled Purchases → Accrued AP |
| `delivery-challan` | COGS (pending invoice settlement) → Inventory |
| `journal-voucher` | free-form balanced entry (depreciation, accruals, corrections) |

**Flow:** document saved as `draft` → user **Posts** → engine creates one (or more) **immutable journal entry/entries**, sets `document.journalEntry`, status → `posted` → `postedAt`. **Void** creates a full reversal entry + audit note; posted entries are never edited.

**Inventory side-effect:** GRN / sales invoices with items create `stockMovements` and post COGS / Inventory valuation at the same time as the journal entry (atomic within the endpoint).

**Validation rules:** Σdebit = Σcredit; amounts > 0; account active; if a tenant is set, journal lines reference accounts of the same book; no mutation of posted entries.

---

## 5. Derived views & reports (server endpoints)

All computed on request from `journalEntries` / `documents` / `stockMovements` — nothing stored:

- **Daybooks:** cash book, petty cash, sales daybook, purchase daybook, journal proper (filters over the journal)
- **General ledger:** per-account entries + running balance
- **Trial balance:** account sums (debit/credit equality check)
- **Profit & Loss / Balance Sheet:** trial balance bucketed by account type
- **AR / AP aging:** open documents by party, buckets 0–30 / 31–60 / 61–90 / 90+
- **Stock ledger + valuation:** aggregated `stockMovements`
- **Bank reconciliation (later):** cash book vs uploaded statement
- **Export:** CSV everywhere; PDF invoices/reports via `jspdf` in the client

Endpoints: `GET /api/reports/trial-balance`, `/ledger?account=`, `/daybook?type=`, `/aging?side=ar`, `/stock-ledger?item=` — all optionally filtered by tenant + date-ranged.

---

## 6. API surface

- Standard Payload REST CRUD for `accounts`, `parties`, `items`, drafts.
- Custom endpoints (same pattern as the existing `/sync-sheets` collection endpoint):
  - `POST /api/documents/:id/post` and `.../void` (the engine)
  - `GET /api/documents/number/next?type=` (per docType + fiscal year)
  - `GET /api/reports/*` (the derived views)
- All endpoints check `isAdmin` first (mirror `Members` sync-sheets handler). Tenant roles only come into play if per-ilaka scoping is enabled later.

---

## 7. UI design (clean separate SPA)

Billable-inspired: professional, dense, keyboard-first.

**Shell**
- Left sidebar: Dashboard · Daybooks · Vouchers · Ledger · Reports · Inventory · Settings
- Top bar: optional ilaka filter (hidden when no tenant is set), period selector, global search (F1), user menu
- Status pills (draft/posted/void), monospace numerals for money, compact tables, accessible focus states

**Screens**
1. **Dashboard** — KPI cards (cash/bank balance, receivables, payables, net profit), recent journal entries, alerts (unposted drafts, stock below reorder level)
2. **Vouchers** — list filtered by docType + quick "New Voucher" type picker; entry form = line-item grid with live totals, tax auto-calc, party autocomplete; **Post** action runs the engine
3. **Daybooks / Journal** — the five daybook views + journal entry browser
4. **Ledger & Reports** — account picker → GL view; trial balance; P&L; balance sheet; AR/AP aging
5. **Inventory** — items list, stock ledger per item, movement log
6. **Settings** — chart of accounts manager, numbering sequences, fiscal year

**Keyboard (Billable-style):** F1 help · F2 new voucher · F3 search · F5 save draft · F6 post · F8 print/export · Esc cancel — with visible focus indicators throughout.

---

## 8. Access & optional tenancy

- **Tenant is optional in v1.** The 7 collections carry a nullable `tenant` relationship (ilaka) as metadata only — no `multiTenantPlugin` registration, no enforced scoping. The module works with a single set of books out of the box.
- **Access:** the module gates on `isAdmin` / `super-admin`, reusing the existing `isAdmin` / `isSuperAdmin` helpers. If per-ilaka books are wanted later, promote `tenant` to the plugin-managed field and re-enable tenant-role checks — the schema already carries the field, so nothing breaks.
- **Numbering sequences** keyed by `docType + fiscal year` (optionally per tenant later).
- **Audit:** `createdBy`/`updatedBy` on documents; posted entries immutable; void writes a reversal + audit entry.

---

## 9. Offline desktop (Phase 2 — Tauri)

- Wrap the same SPA in **Tauri 2** (lighter than Capacitor for desktop; Capacitor later if mobile is wanted).
- Local **SQLite mirror** (Tauri `plugin-sql`) for reads; **outbox queue** for writes made offline.
- Sync engine: pull with `updatedAt` cursor, push queued mutations, `last-write-wins` + warning banner on conflict.
- Constraint: offline-created documents start `draft`; posting is queued and applied in order when online.
- Tenant filter (if used) is a query parameter, not a local boundary.

---

## 10. Roadmap

| Milestone | Scope | Exit criteria |
|---|---|---|
| **M0** | `apps/billing/` SPA scaffold + Payload collections + better-auth login | login → empty dashboard |
| **M1** | Chart of accounts admin + `journalEntries` CRUD with double-entry validation + posting engine (journal-voucher) + trial balance | post a balanced entry; trial balance matches |
| **M2** | `documents` taxonomy + posting rules for all voucher types + numbering + void/reversal | sales invoice → AR + revenue; payment voucher → bank |
| **M3** | Parties, invoice layout, PDF export, AR/AP aging | invoice printable; aging matches open docs |
| **M4** | Inventory: items, GRN/challan, stock movements, stock ledger, COGS | stock in/out → valuation + COGS postings |
| **M5** | P&L, balance sheet, BRS, freeze periods, backup/export | full report set; data freeze enforced |
| **M6** | Tauri desktop wrapper + offline cache + outbox sync | desktop app works offline and syncs |

**Ordering note:** M1–M2 are the core and should land before any UI polish beyond the shell. Inventory (M4) is optional — only build it if physical stock is actually tracked.

---

## 11. Decisions & risks

| Decision | Choice | Why |
|---|---|---|
| Single- vs double-entry | Double-entry | Matches the taxonomy and Billable; correct by construction |
| Storage vs derivation | Store journal+docs; derive reports | Keeps data model small and consistent |
| Bank accounts | `accounts` rows with `class=bank` | One less collection; cash book = filter |
| Payments | `documents` (vouchers) | Payments ARE documents per the taxonomy |
| Currency | NPR only (v1) | Community scope; multi-currency is a big multiplier |
| Ilaka tenancy | Optional nullable `tenant` field (v1); no plugin enforcement | Keeps v1 simple; schema already supports promoting to enforced scoping later |
| Posting immutability | Posted entries never edited; void = reversal | Integrity of books; audit trail |

**Risks (highest first):**
1. **Void/reversal correctness** — a bug here corrupts the books; design as reversal-pairs, test heavily.
2. **Inventory valuation / COGS** — FIFO vs weighted-average affects P&L; pick AVCO for simplicity unless FIFO is required.
3. **Offline conflict resolution** (Phase 2) — outbox ordering; document drafts-first constraint mitigates.
4. **Scope creep** — the Billable README is a spec, not a checklist; M1–M3 alone deliver a genuinely useful tool.

---

*Derived from the Billable feature set (README) and the bookkeeping document classification taxonomy. UI style referenced from Billable; no code is copied (ELv2).*
