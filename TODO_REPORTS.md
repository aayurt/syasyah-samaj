# Reports Module - Implementation Status

## Stage 1: Core Financial Reports ✅ COMPLETE
- [x] **Shared ReportLayout** (`ReportLayout.tsx`) - header, filters, export, loading/error/empty states
- [x] **Trial Balance** - existing, working
- [x] **Profit & Loss / Income & Expenditure** - existing, working  
- [x] **Balance Sheet** - existing, working
- [x] **General Ledger** (`GeneralLedger.tsx`) - account selector, date range, running balance, drill-down
- [x] **Cash Flow Statement** (`CashFlowStatement.tsx`) - Operating/Investing/Financing, reconciliation panel

## Stage 2: Receivables, Payables, Equity, Transaction Health ✅ COMPLETE
- [x] **Receivables** (`Receivables.tsx`) - aging buckets (Current, 1-30, 31-60, 61-90, 90+), customer filter
- [x] **Payables** (`Payables.tsx`) - aging buckets, vendor filter
- [x] **Transaction Health** (`TransactionHealth.tsx`) - 9 diagnostic checks with drill-down links
- [ ] Statement of Changes in Equity/Funds - not yet (needs fund accounting model)

## Stage 3: Tax & Inventory Reports 📋 PLANNED
- [x] Tax Summary (`TaxSummary.tsx`)
- [x] Tax Reconciliation (`TaxReconciliation.tsx`)
- [x] Taxable Sales per Customer (`TaxableSalesPerCustomer.tsx`)
- [x] Taxable Purchases per Supplier (`TaxablePurchasesPerSupplier.tsx`)
- [x] VAT Sales Register / VAT Purchase Register (existing TaxSales.tsx, TaxPurchase.tsx)
- [ ] Tax Codes / Tax Audit
- [ ] Tax Transactions
- [ ] Inventory Items / Inventory Value Summary (existing InventoryValuation.tsx)
- [ ] Inventory Quantity Summary (existing StockQuantity.tsx)
- [ ] Inventory Profit Margin
- [ ] Inventory Costing Calculation Worksheet
- [ ] Stock Movement (existing StockLedger via Items page)
- [ ] Stock Adjustment

## Stage 4: Fixed/Intangible Assets 📋 PLANNED
- [ ] Fixed Asset Register (existing FixedAssets.tsx)
- [ ] Fixed Asset Summary
- [ ] Depreciation Calculation Worksheet
- [ ] Depreciation Schedule
- [ ] Asset Disposal
- [ ] Intangible Asset Register/Summary/Amortisation

## Stage 5: Membership/Nonprofit 📋 PLANNED
- [ ] Membership Register/Summary
- [ ] Membership Fee Collection
- [ ] Member Outstanding/Contribution
- [ ] Donation Report / Fund Collection
- [ ] Member Receipt History

## Technical Debt / Polish
- [ ] Fix flaky `OrderDocTypes.test.tsx:141` (re-query button after click)
- [ ] Add unit tests for `aging.ts` calculation engine
- [ ] Add unit tests for `transactionCalc.ts` (8 tests exist, passing)
- [ ] Code-split large bundle (`index-*.js` ~3MB)
- [ ] Verify drill-down links work for all reports
- [ ] Test responsive layout on mobile viewport

## Deployment
- [ ] Build passes: `npm run build` ✅
- [ ] TypeScript clean: `npx tsc --noEmit` ✅
- [ ] Unit tests: 66/67 pass (1 pre-existing flaky) ✅
- [ ] Deploy to VPS when SSH available (rsync dist + pm2 reload)
