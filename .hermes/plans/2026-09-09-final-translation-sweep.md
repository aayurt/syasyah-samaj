# Plan: Final Translation Sweep — Remaining English Strings

Verified by live browser sweep in Nepali mode. All UI chrome on main pages is translated.
Remaining English falls into 6 categories:

## 1. Doc-type label constants (static arrays — biggest cluster)
Static `label:`/`shortLabel:` values rendered in dropdowns, cards, chips:
- `pages/Vouchers.tsx` DOC_TYPES (lines 66-76): 'Journal Entry', 'Payment', 'Receipt', 'Sales Invoice', 'Purchase Invoice', 'Contra Entry', 'Credit Note', 'Debit Note', 'Petty Cash', 'Goods Received (GRN)', 'Delivery Challan' → shown as "Type: X" in filters + type dropdown
- `pages/VoucherForm.tsx` DOC_TYPE_META (lines ~60-90): shortLabel for card grid
- `lib/types.ts` DOC_TYPE_LABELS (lines 22-38): used in SyncBanner, activity feed, views

**Fix:** keep arrays as-is (values must stay English); resolve display through `t('docType.' + value, fallbackLabel)`. Add `docType.*` namespace with all 14 types in en.ts + ne.ts (e.g. docType.salesInvoice: 'बिक्री इन्भोइस').

## 2. Report quick-range chips + P&L/BS labels
- QUICK_RANGES in ProfitLoss.tsx, BalanceSheet.tsx, SalesReport.tsx, PurchaseReport.tsx, CashStatement.tsx, BankStatement.tsx, PartyStatement.tsx, VatRegister.tsx: 'This Month', 'Last Month', 'This Year', 'As of Today', 'This Week', 'All Time', 'Today', 'End'
- ProfitLoss.tsx: 'Total Income', 'Net Profit'/'Net Loss', 'Net Profit/Loss' (lines 58-97) + CSV export rows
- BalanceSheet.tsx: 'Assets', 'Liabilities', 'Equity', 'Total Assets', 'Total Liabilities', 'Total Equity', 'Liabilities + Equity' (lines 75-111) + CSV rows

**Fix:** wrap chips + totals with t() (`reports.thisMonth`, `reports.totalIncome`, `reports.netProfit`, `reports.totalAssets`, `reports.assets`, `reports.liabilities`, `reports.equity`, ...). CSV rows can use same translated labels.

## 3. Daybooks tabs + descriptions
- Daybooks.tsx lines 18-23: 'All Transactions', 'Cash', 'Bank', 'Petty Cash', 'Sales Daybook', 'Purchase Daybook', 'Journal Proper'
- Line 313, 321: description sentences ('Every posted transaction line...', 'The Journal Proper register...')

**Fix:** add `daybooks.allTransactions/cash/bank/pettyCash/salesDaybook/purchaseDaybook/journalProper` + two description keys.

## 4. AuditLog filter options
- Lines 40, 148, 157: 'This Week' (+ other quick ranges), 'All Actions', 'All Entities'; action chips Create/Update/Delete/Post/Void/Transfer come from data — wrap labels

**Fix:** `audit.thisWeek/allActions/allEntities/create/update/delete/post/void/transfer` keys.

## 5. DataManagement headings + descriptions
- Lines 319-347: 'Export Data', 'Download all records for a collection as JSON.', 'Import Data', 'Upload a JSON export file. Duplicates are detected automatically.'
- Collection names list (Parties, Items, Members, Tenants, Accounts) — keep English (data names)

**Fix:** `dataManagement.exportData/importData/exportDesc/importDesc` keys.

## 6. Settings leftover card titles/subtitles
- title="Feature Toggles" (line 1487), "Default Accounts" (1583) — pass through t() (`settings.featureToggles`, `settings.defaultAccounts` already exist in dictionary)
- Line 2095: subtitle="Tutorial & sign out" → new key `settings.tutorialSignout`
- Line 2110: "Show Tutorial" → `hint.showTutorial` exists
- Number Series descriptions on the page (English sentences near line 1860-1880) → `settings.*` keys
- ExpenseClaims line 222 already uses t('expenseClaims.title') but wrong key semantics — harmless; filter chips 'All/Draft/Submitted/Approved/Rejected/Reimbursed/Billable' → `expenseClaims.*` keys

## Files to touch
1. `apps/billing/src/lib/i18n/en.ts` + `ne.ts` — add ~45 new keys (docType.* 14, reports.* ~15, daybooks.* 9, audit.* 9, dataManagement.* 4, expenseClaims.* 7, settings.tutorialSignout)
2. `apps/billing/src/pages/Vouchers.tsx` — resolve type labels via t()
3. `apps/billing/src/pages/VoucherForm.tsx` — DOC_TYPE_META shortLabel via t()
4. `apps/billing/src/lib/types.ts` — DOC_TYPE_LABELS consumers (SyncBanner + activity) resolve via t()
5. Report files (ProfitLoss, BalanceSheet, SalesReport, PurchaseReport, CashStatement, BankStatement, PartyStatement, VatRegister, StockQuantity, TaxSales, TaxPurchase, InventoryValuation) — quick ranges + totals
6. `apps/billing/src/pages/Daybooks.tsx` — tabs + descriptions
7. `apps/billing/src/pages/AuditLog.tsx` — filters
8. `apps/billing/src/pages/DataManagement.tsx` — headings
9. `apps/billing/src/pages/Settings.tsx` — title props + tutorial subtitle
10. `apps/billing/src/pages/ExpenseClaims.tsx` — filter chips

## Not translated (by design)
- Account names (Accounts Payable, Bank Account...) — user data from DB
- Party/item names — user data
- Codes, amounts, dates, emails, phone numbers

## Verification
- `npx tsc --noEmit` clean
- Browser sweep all pages in Nepali mode — no 2+ word English phrases outside data
