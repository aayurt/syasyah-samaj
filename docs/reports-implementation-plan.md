# Reports Implementation Plan — 5 Remaining Features

## Context

The billing SPA has a reports hub (`/reports`) with category tabs and card grid.
Six reports are built (Sales, Purchase, Party Statement, Low Stock, Tax Sales, Tax Purchase).
Five more reports need building. All data lives in Payload collections on the Syasha DB.

---

## 1. Enhanced Sales/Purchase Reports — Payment Tracking

**Goal:** Show "Received Amount" and "Balance Amount" per invoice so users can see outstanding at a glance.

### Data Model
- `documents` has `docType` (sales-invoice, receipt-voucher, purchase-invoice, payment-voucher), `party`, `grossTotal`, `status`
- A receipt-voucher settles one or more sales-invoices for the same party
- A payment-voucher settles one or more purchase-invoices for the same party
- Currently no explicit `settledAgainst` linkage — we match by party + date range

### Approach
**Client-side aggregation** (no new backend endpoint needed):

1. Fetch all posted documents in the date range (sales-invoices + receipt-vouchers for Sales; purchase-invoices + payment-vouchers for Purchase)
2. For each invoice, sum receipt-vouchers for the same party that occur on or after the invoice date
3. Compute `received = min(invoice.grossTotal, sum_of_receipts_for_party_after_invoice_date)`
4. Compute `balance = grossTotal - received`

### New Columns in SalesReport / PurchaseReport
| Column | Description |
|--------|-------------|
| **Received Amount** | Sum of matching receipt/payment vouchers for that party |
| **Balance Amount** | `grossTotal - received` |

### KPI Cards Update
Add: **Received** (sum of all received), **Unpaid** (sum of all balances)

### Files to Modify
- `apps/billing/src/pages/reports/SalesReport.tsx` — add payment matching logic + columns
- `apps/billing/src/pages/reports/PurchaseReport.tsx` — mirror for purchases

---

## 2. Cash In Hand Statement

**Goal:** All transactions touching cash accounts (`class === 'cash'`), with running balance.

### Data Model
- `gl_accounts` has `class` field: `cash`, `bank`, `other`
- `journal_entries` has `account` (relationship to gl_accounts), `debit`, `credit`, `date`
- `documents` links to journal entries via `referenceDoc`

### Approach
**New SPA page** using the existing daybook endpoint filtered to cash accounts:

1. Fetch all `gl-accounts` where `class === 'cash'`
2. Fetch journal entries filtered to those account IDs (using `where[account][in]`)
3. For each entry: date, narration, doc number, debit, credit
4. Compute running balance: `+debit -credit`

### UI
- Date range filter + quick presets
- KPI: Opening Balance, Total Receipts, Total Payments, Closing Balance
- Table: Date | Voucher | Narration | Debit | Credit | Running Balance
- CSV + PDF export

### Files to Create
- `apps/billing/src/pages/reports/CashStatement.tsx`

### Route
- `/reports/cash-statement` in App.tsx

---

## 3. Bank Statement

**Goal:** All transactions touching bank accounts (`class === 'bank'`), with running balance.

### Data Model
Same as Cash In Hand but filtered to `class === 'bank'`.

### Approach
Identical to Cash In Hand Statement but queries `gl-accounts` where `class === 'bank'`.

### UI
Same layout as Cash Statement.

### Files to Create
- `apps/billing/src/pages/reports/BankStatement.tsx`

### Route
- `/reports/bank-statement` in App.tsx

---

## 4. Stock Quantity Report

**Goal:** Opening stock + movements in = closing stock per item, with reorder level status.

### Data Model
- `items` has `openingStock` (number), `reorderLevel` (number), `salePrice`, `purchasePrice`
- `stock_movements` has `item` (relationship), `docType`, `qtyIn`, `qtyOut`, `date`, `document`

### Approach
1. Fetch all items
2. Fetch stock-levels endpoint (`/items/stock-levels`) which already computes current qty per item
3. For each item, fetch its stock movements in the date range
4. Compute: `opening → +GRN qtyIn → -sales/challan qtyOut = closing`

### UI
- Date range filter
- Table: Code | Name | Unit | Opening | Purchased (GRN) | Sold (Sales/Challan) | Closing | Reorder Level | Status
- Status column: ✅ OK / ⚠️ Low / 🔴 Below Reorder
- CSV + PDF export

### Files to Create
- `apps/billing/src/pages/reports/StockQuantity.tsx`

### Route
- `/reports/stock-quantity` in App.tsx

---

## 5. Income/Expense by Category

**Goal:** P&L grouped by account groups (not individual accounts), so users see category-level breakdown.

### Data Model
- `gl_accounts` has `type` (income/expense) and `group` (relationship to `account_groups`)
- `account_groups` has `name`, `code`
- Current P&L endpoint returns flat list of accounts with amounts

### Approach
**Client-side grouping** (no new backend endpoint):

1. Fetch accounts + groups
2. Fetch P&L data from existing endpoint
3. Group accounts by their `group` field
4. Render as collapsible sections: each group shows its accounts + subtotal

### UI
- Date range filter + quick presets
- Two-tab layout: Income Categories | Expense Categories
- For each category (group): expandable section with account breakdown
- KPI: Total Income, Total Expenses, Net Profit/Loss
- CSV + PDF export

### Files to Create
- `apps/billing/src/pages/reports/ExpenseCategory.tsx`
- `apps/billing/src/pages/reports/IncomeCategory.tsx`

### Routes
- `/reports/expense-category` in App.tsx
- `/reports/income-category` in App.tsx

---

## Execution Order

| Step | Report | Effort | Dependencies |
|------|--------|--------|--------------|
| 1 | Enhanced Sales/Purchase (payment tracking) | Medium | None — modify existing pages |
| 2 | Cash In Hand Statement | Small | None — new page, simple filter |
| 3 | Bank Statement | Small | Copy from Cash Statement, change filter |
| 4 | Income/Expense by Category | Medium | Uses existing P&L endpoint + account groups |
| 5 | Stock Quantity Report | Medium | Uses existing stock-movements collection |

**Total:** 5 new/modified pages, ~3-4 hours of implementation.

---

## Wire-Up (all steps)

After all reports are built:
1. Update `ReportsHub.tsx` — remove broken card links (Sales Return, Purchase Return, All Transactions, Item Details, Item List, Discount) and keep only working links
2. Add new routes to `App.tsx` for Cash Statement, Bank Statement, Expense Category, Income Category, Stock Quantity
3. Add barrel exports to `reports/index.ts`
4. Typecheck + lint + commit + push
