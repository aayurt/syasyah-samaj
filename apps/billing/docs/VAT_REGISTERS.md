# VAT Registers — Plan & Spec

> Status: Approved plan — ready to implement.
> Last updated: September 2026.

## Goal

Build the four statutory VAT registers (per Nepal IRD; also the standard
manager.io-style books) into the billing SPA:

1. **Sales Register**
2. **Purchase Register**
3. **Sales Return Register**
4. **Purchase Return Register**

Each register is a dated, line-item list of **posted, VAT-bearing**
transactions with the **taxable amount** and **VAT amount** broken out,
ready to be printed / exported (CSV · PDF · Print) for filing or audit.

---

## 1. Data Mapping

| Register | Source docs (must be `status === 'posted'`) | Sign |
|---|---|---|
| **Sales Register** | `sales-invoice` (+ optionally `receipt-voucher` / `membership-receipt` when they carry VAT tax lines) | Add to sales |
| **Purchase Register** | `purchase-invoice` | Add to purchases |
| **Sales Return Register** | `credit-note` — sales-side: standalone, or `referenceToDocType` **not** in the purchase set | Subtract from sales |
| **Purchase Return Register** | `credit-note` with `referenceToDocType` ∈ {`purchase-invoice`, `purchase-order`, `grn`} | Subtract from purchases |

### Data-semantics notes

- This codebase models **purchase returns as credit notes referencing
  purchase documents** (posting engine's `isPurchase` branch:
  `Dr AP / Cr Purchase Returns` — see `src/collections/Documents/index.ts`).
- `debit-note` here means *supplier extra charge* (`Dr Expense / Cr AP`),
  **not** a return — excluded from the return registers.
- Fully voided documents are excluded (use `effectiveAmount`-style netting).
- Documents whose tax lines are all `withholding` (TDS) are **not** VAT —
  exclude them (or show separately). VAT-bearing natures: `additive`,
  `inclusive`.

## 2. Shared Column Layout

All four registers use the same columns:

| Date (BS) | Register/Slip No | Party (name) | PAN | Narration / Reference | Taxable Amount | VAT Amount | Total (incl. VAT) | Rate % |
|---|---|---|---|---|---|---|---|---|

**Amount source per document row:**

- Taxable = `doc.netTotal` (already excludes inclusive tax)
- VAT = `doc.taxTotal`
- Total = `doc.grossTotal`
- Rate = the doc's `taxRate`; for multi-tax-line docs, show per-doc totals
  with rate blank/`—` (mixed).

**Return rows display negative (red)** amounts so that
`Sales Register + Sales Return Register` and
`Purchase Register + Purchase Return Register` reconcile to net sales /
net purchases.

## 3. UI Design

One shared page with four tabs (recommended over four separate routes —
the columns and filters are identical, only the source mapping changes).

### Filters (top of page)

- Tab switcher: **Sales · Purchase · Sales Return · Purchase Return**
- Nepali date range (`NepaliDateInput`), defaulting to the selected fiscal
  year (`useFiscalYear`) — with quick presets like `SalesReport.tsx`:
  This Month / Last Month / This FY / All Time
- Tenant scope (`useTenantQuery` — illaka users auto-scoped)
- "VAT only" toggle (hide docs with no VAT lines)
- Optional party search

### Stats cards

- **Total Entries**
- **Total Taxable**
- **Total VAT**
- **Grand Total** (taxable + VAT)
- Sales view additionally shows **Net VAT Payable = Output VAT − Input VAT**
  (Sales + Sales Return vs Purchase + Purchase Return), useful at filing time.

### Table

| Date | No. | Party | PAN | Narration | Rate % | Taxable | VAT | Total |
|---|---|---|---|---|---|---|---|---|

Returns render amounts in red / negative. Footer totals row for each
numeric column.

### Actions

- **CSV** (`downloadCsv` from `apps/billing/src/lib/csv`)
- **PDF** (`exportReportPdf` from `apps/billing/src/lib/pdf`)
- **Print** (`window.print()`)

## 4. Implementation Steps

### Step 1 — Shared logic

**`apps/billing/src/pages/reports/vatShared.ts`**

```ts
export type VatRegisterMode =
  | 'sales'
  | 'purchase'
  | 'sales-return'
  | 'purchase-return'

export interface VatRow {
  docId: number
  date: string
  number: string | null
  partyName: string
  partyPan?: string
  narration?: string
  rate: number | null
  taxable: number
  vat: number
  total: number
  isReturn: boolean
}

// Pick the documents that belong to a register mode.
export function docMatchesMode(doc: Document, mode: VatRegisterMode): boolean

// Build register rows from fetched documents + party map.
export function buildRegisterRows(
  docs: Document[],
  mode: VatRegisterMode,
  partyMap: Map<number, Party>,
): VatRow[]

export function modeLabel(mode: VatRegisterMode): string // "Sales Register" …
```

**Doc-type mapping rule** (helper used by `docMatchesMode`):

```
const PURCHASE_REFS = new Set(['purchase-invoice', 'purchase-order', 'grn'])

sales:            docType === 'sales-invoice'
                  (optionally also VAT-bearing receipts)
purchase:         docType === 'purchase-invoice'
sales-return:     docType === 'credit-note' &&
                  !PURCHASE_REFS.has(referenceToDocType ?? '')
purchase-return:  docType === 'credit-note' &&
                  PURCHASE_REFS.has(referenceToDocType ?? '')
```

**All modes additionally require:** `status === 'posted'`, non-voided,
and (when the "VAT only" toggle is on) at least one non-withholding tax
line or `taxTotal > 0`.

### Step 2 — Page component

**`apps/billing/src/pages/reports/VatRegister.tsx`**

- Follow the structure of `TaxSales.tsx` / `TaxPurchase.tsx`
  (header with back button + CSV/PDF/Print, `DataStatus`,
  `ReportSkeleton`, `NepaliDateInput` filters, stats cards, table,
  totals footer).
- Fetch in one pass:
  ```ts
  const [d, p] = await Promise.all([
    list<Document>('documents', q),      // q: date range + tenant + depth 1
    list<Party>('parties', { depth: 0, sort: 'name', ...tenantQuery }),
  ])
  setRows(buildRegisterRows(d.docs, mode, partyMap))
  ```
- Re-run on tab / date-range / fiscal-year / tenant change.

### Step 3 — Wire into the app

| File | Change |
|---|---|
| `apps/billing/src/pages/reports/index.ts` | `export { default as VatRegister } from './VatRegister'` |
| `apps/billing/src/App.tsx` | import + `<Route path="/reports/vat-register" element={<VatRegister />} />` |
| `apps/billing/src/pages/reports/ReportsHub.tsx` | add **"VAT Registers"** card → `/reports/vat-register` (Business Status, next to Tax Sales / Tax Purchase) |

## 5. Files to Create / Modify

| File | Action |
|---|---|
| `apps/billing/src/pages/reports/vatShared.ts` | **NEW** — mode types, doc matching, row builder |
| `apps/billing/src/pages/reports/VatRegister.tsx` | **NEW** — tabbed register page |
| `apps/billing/src/pages/reports/index.ts` | export VatRegister |
| `apps/billing/src/App.tsx` | add `/reports/vat-register` route |
| `apps/billing/src/pages/reports/ReportsHub.tsx` | add VAT Registers card |

No backend changes were needed to *compute* the registers (computed
client-side over the `documents` collection, cache-first via the offline
`api()` layer). One server change was made so the registers actually
reconcile: the `/void` and `/:id/partial-void` endpoints in
`src/collections/Documents/index.ts` now carry the source document's VAT
breakdown onto the void-created credit note (`netTotal` / `taxTotal` /
`grossTotal`, plus `taxRate` / `taxLines`). Previously those credit notes
stored only net/gross with zero tax, so voiding a VAT invoice showed up in
the return registers with ₹0 VAT.

- **Full void** — the credit note mirrors the document's totals exactly
  (`taxTotal` = `doc.taxTotal`), so Sales + Sales Return reconcile to zero.
- **Partial void** — the voided line value is split per the document's tax
  convention: net for additive/no-tax lines (VAT scaled by the voided
  fraction of `netTotal`), gross for inclusive-tax lines (net derived via
  the doc's net/gross ratio). The credit note's gross therefore equals the
  tax-inclusive value reversed against AR/AP, and the doc's `voidedAmount`
  accrues in gross terms so voiding all lines still flips it to `void`.

The credit-note posting leg uses gross only, so these tax fields never
touch the ledger — they are reporting metadata.

## 6. Out of Scope (for now)

- Server-side register endpoint (client-side matches existing reports;
  easy to lift later by reusing `vatShared.ts` on the server).
- TaxSales / TaxPurchase remain separate (tax-line-level detail).
- Auto-filing / IRD e-Tax upload.
- Per-item line expansion (registers are per-document by design).
