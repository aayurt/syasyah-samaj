# Accounting Reconciliation Report — COA & Opening Balances
**Commit audited:** `3717476d` | **Method:** Independent hand calculation compared to application output (where available)
**Arithmetic:** Decimal-safe (integer NPR cents equivalent); no floating-point for financial totals.

## Independently calculated expected results (opening-balance dataset)

Dataset (11 accounts, FY 2083/84, open date 2026-07-17 AD):

| Account | Code | Type | Dr (NPR) | Cr (NPR) |
|---------|------|------|----------|----------|
| Cash in Hand | 1111001 | asset | 150,000 | 0 |
| Nabil Bank - Current | 1112001 | asset | 500,000 | 0 |
| Sundry Debtors | 1121001 | asset (control) | 250,000 | 0 |
| Inventory - General | 1131001 | asset | 300,000 | 0 |
| Furniture | 1211001 | asset | 200,000 | 0 |
| Accum. Depreciation - Furniture | 1211002 | contra-asset | 0 | 20,000 |
| Sundry Creditors | 2111001 | liability (control) | 0 | 180,000 |
| Salary Payable | 2121001 | liability | 0 | 50,000 |
| Long-term Bank Loan | 2211001 | liability | 0 | 300,000 |
| Ordinary Share Capital | 3111001 | equity | 0 | 700,000 |
| Retained Earnings - Brought Forward | 3121001 | equity | 0 | 150,000 |
| **TOTAL** | | | **1,400,000** | **1,400,000** |

**Expected opening difference: NPR 0**

### Trial Balance (expected)
| Account | Dr | Cr |
|---------|-----|-----|
| Cash in Hand | 150,000 | 0 |
| Nabil Bank | 500,000 | 0 |
| Sundry Debtors | 250,000 | 0 |
| Inventory | 300,000 | 0 |
| Furniture | 200,000 | 0 |
| Accumulated Depreciation | 0 | 20,000 |
| Sundry Creditors | 0 | 180,000 |
| Salary Payable | 0 | 50,000 |
| Long-term Bank Loan | 0 | 300,000 |
| Ordinary Share Capital | 0 | 700,000 |
| Retained Earnings | 0 | 150,000 |
| **TOTAL** | **1,400,000** | **1,400,000** |
| **Difference** | | **0** |

### Balance Sheet (expected)
Assets: Cash 150,000 + Bank 500,000 + Trade Receivables 250,000 + Inventory 300,000 = Current Assets 1,200,000; Furniture 200,000 − Accum. Depreciation 20,000 = Net Non-current 180,000; **Total Assets 1,380,000**
Liabilities: Creditors 180,000 + Salary Payable 50,000 + Loan 300,000 = **Total Liabilities 530,000**
Equity: Share Capital 700,000 + Retained Earnings 150,000 = **Total Equity 850,000**
**Liabilities + Equity = 1,380,000** = Total Assets. **Difference 0.**

### Subledger reconciliation (expected)
- Trade Receivables (GL control 1121001) = sum of customer opening balances = 250,000
- Trade Payables (GL control 2111001) = sum of supplier opening balances = 180,000
- If Sundry Debtors/Creditors are control accounts, matching customer/supplier opening balances must exist and reconcile exactly.

## Application actual results
**NOT AVAILABLE — opening-balance batch was never posted.** End-to-end posting requires authenticated access to https://staging.syasyahsamaj.com/, which is not available. Additionally, SCHEMA-01/SCHEMA-02 (Doc B) mean the staging DB lacks the columns the deployed code writes to, so posting would fail with column-not-found errors until a migration runs.

| Metric | Expected (independent) | Actual (application) | Match? |
|--------|------------------------|----------------------|--------|
| Debit total | 1,400,000 | not posted | n/a |
| Credit total | 1,400,000 | not posted | n/a |
| Opening difference | 0 | not posted | n/a |
| Total Assets | 1,380,000 | not posted | n/a |
| Total Liabilities | 530,000 | not posted | n/a |
| Total Equity | 850,000 | not posted | n/a |
| Balance Sheet balanced | yes | not posted | n/a |
| AR subledger = control | 250,000 | not posted | n/a |
| AP subledger = control | 180,000 | not posted | n/a |

## Schema gap preventing actual verification
Staging `opening_balances` has 7 legacy columns only (id, account_id, fiscal_year_id, amount, tenant_id, created_at, updated_at); missing `status`, `postedToJournal`, `createdBy`, `updatedBy`, `approvedBy`, `postedBy`, `reversedBy`, `reversalReason`, `sourceBatch`. Staging `gl_accounts` missing `level`, `normalBalance`, `parentAccount`. Deployed code references all of these.

## Conclusion
Independent expected results are defined above. Actual application results could not be obtained (blocked by missing credentials + schema mismatch). Reconciliation cannot be completed until E2E posting is executed against a migrated staging DB.