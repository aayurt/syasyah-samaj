# Syasyah Samaj — Complete Sequential Accounting E2E Workflow

**Document type:** Functional specification + accounting acceptance criteria + E2E testing plan  
**Fiscal year:** 2083/84  
**Test period:** July–August 2026  
**Environment:** Staging only  
**Execution:** Sequential, deterministic, single-worker E2E

---

# 0. Objective and execution rules

The purpose of this workflow is to verify the complete accounting lifecycle, from organisation setup through financial reporting.

The required sequence is:

1. Organisation and system prerequisites
2. Company settings and fiscal year
3. Chart of Accounts
4. Parties and inventory masters
5. Opening Balances
6. Sequential voucher transactions
7. Ledger reconciliation
8. Financial reports
9. Period closing and reopening
10. Data integrity and regression tests

**Mandatory rules**

- Never skip a prerequisite.
- Never silently accept missing account mappings.
- Never post an unbalanced voucher.
- Never create duplicate records during retries.
- Never assign voucher numbers to drafts.
- Never allow posting into a closed fiscal year.
- Never silently create missing Chart of Accounts headings.
- Every posted transaction must have traceable accounting entries.
- Every report must reconcile against its underlying ledgers.

If a prerequisite fails, stop the dependent phase, report the missing configuration and resume only after correction.

---

# 1. Phase 0 — System prerequisites

## 1.1 Required data

| # | Prerequisite | Collection / location | Missing behaviour |
|---|---|---|---|
| P1 | Tenant / organisation | `tenants` | Stop: organisation required |
| P2 | Billing settings | `/globals/billing-settings` | Stop: configuration incomplete |
| P3 | Active fiscal year | `fiscal_years` + billing settings | Stop: fiscal year required |
| P4 | Account groups | `account_groups` | Stop: Chart of Accounts required |
| P5 | GL accounts | `gl_accounts` | Stop: accounts required |
| P6 | Default posting accounts | Billing Settings → Default Accounts | Stop: unmapped accounts |
| P7 | Parties | `parties` | Stop dependent documents |
| P8 | Items | `items` | Stop dependent line items |
| P9 | Tax types | `tax_types` | Stop tax-dependent documents |
| P10 | User permissions | Users / Roles | Stop: posting permission required |
| P11 | Accounting configuration | Billing settings | Stop: incomplete accounting configuration |

## 1.2 Preflight validation

Before starting the accounting workflow, verify:

- Tenant exists and is active.
- All records belong to the correct tenant.
- Billing settings can be retrieved.
- Active fiscal year exists.
- Fiscal year is open.
- Account groups and accounts exist.
- Required default accounts are mapped.
- Party and item masters are accessible.
- Tax types are configured.
- The logged-in user has appropriate permissions.

**Acceptance criteria:** The application must display the exact missing prerequisite rather than showing empty lists or allowing an invalid voucher to be created.

---

# 2. Phase 1 — Company Settings and Fiscal Year

**UI:** Settings → Company Profile / Calendar / Fiscal Settings

## Steps

1. Configure company name.
2. Configure PAN and contact details.
3. Configure email and address.
4. Select calendar type: BS or AD.
5. Configure date and time formats.
6. Create fiscal year `2083-84`.
7. Set its start date to 2026-07-17.
8. Set its end date to 2027-07-16.
9. Mark it as the active working year.
10. Verify all accounting screens use the active year.

## Tests

| ID | Test | Expected result |
|---|---|---|
| T1 | Open voucher page without FY | Setup guard displayed |
| T2 | Create fiscal year | Correct dates saved |
| T3 | Activate FY | Active year updated |
| T4 | Switch fiscal year | Reports and lists change scope |
| T5 | Close FY | Posting blocked |
| T6 | Reopen FY | Posting permitted according to permissions |

## Additional requirements

- Prevent overlapping fiscal years.
- Validate start date is before end date.
- Voucher date must fall within the selected FY.
- Fiscal year labels must be consistent across forms, reports and numbering.
- Preserve historical transactions when switching years.

---

# 3. Phase 2 — Chart of Accounts

**UI:** Masters → Account Setup (`/accounts`)

This phase must complete before Opening Balances.

## 3.1 Required account groups

Verify the seven seeded groups:

1. Current Assets
2. Fixed Assets
3. Current Liabilities
4. Capital & Reserves
5. Income
6. Direct Expenses
7. Indirect Expenses

Verify the expected 20 seeded accounts, including account codes, account types, parent groups and active status.

The count is a staging-fixture assertion, not a universal accounting limitation.

## 3.2 Account hierarchy requirements

The Chart of Accounts must maintain a consistent hierarchy:

- Account type
- Account heading / group
- Account subheading, where applicable
- Ledger account

All headings and subheadings must be correctly aligned.

An account must not belong to an incompatible group.

## 3.3 Functional tests

| ID | Test | Expected result |
|---|---|---|
| T7 | Open Account Setup | Groups and accounts load |
| T8 | Create account | Correct group association |
| T9 | Change account type | Incompatible group cleared |
| T10 | Select account type | Only compatible groups displayed |
| T11 | Export CSV | Matches visible rows |
| T12 | Delete account | Row removed, subject to usage restrictions |
| T13 | Delete account in use | Deletion blocked |
| T14 | Empty Chart of Accounts | Setup modal/workflow displayed |

## 3.4 Empty-state behaviour

If there are no account groups or accounts:

1. Do not show a blank or unusable account selector.
2. Display an explanatory setup modal.
3. Require the user to create the necessary headings/groups first.
4. Allow account creation under the appropriate heading.
5. Return the user to the original workflow after successful setup.

Do not create arbitrary default headings silently.

## 3.5 Default posting accounts

Settings → Default Accounts

Verify all 14 required posting roles are mapped.

The test must use the canonical list of roles defined by the application, not an independently invented list.

Validate:

- Required roles are populated.
- Selected accounts exist.
- Selected accounts belong to the correct tenant.
- Account types are compatible with their posting roles.
- Inactive or deleted accounts cannot be selected.

**Failure behaviour:** Show the missing role and block posting.

---

# 4. Phase 3 — Masters: Parties and Inventory

**UI:** Masters → Parties (`/parties`)  
**UI:** Masters → Inventory (`/inventory`)

## 4.1 Parties

Verify eight seeded parties:

- 3 vendors
- 4 customers
- 1 customer and vendor

Verify PAN, tax ID, contact information and party status.

Create one additional party of each type:

- Customer
- Vendor
- Both

### Tests

| ID | Test | Expected result |
|---|---|---|
| T15 | Create customer | Saved successfully |
| T16 | Create vendor | Saved successfully |
| T17 | Create both-type party | Both roles available |
| T18 | Duplicate PAN | Validation error / 409 |
| T19 | Inactive party | Cannot be used in new documents |
| T20 | Party ledger | Correct transaction history |

## 4.2 Inventory

Verify eight seeded items.

Validate:

- Item name and code
- Stock-tracking status
- Unit of measurement
- Opening quantity
- Purchase price
- Sales price
- Reorder level
- Tax configuration
- Inventory account mapping

Create one additional inventory item with opening stock, purchase price and sales price.

### Tests

| ID | Test | Expected result |
|---|---|---|
| T21 | Create item | Item saved |
| T22 | Opening stock | Correct stock quantity |
| T23 | Purchase price | Correct value |
| T24 | Sales price | Correct value |
| T25 | Duplicate item code | Validation error |
| T26 | Stock-tracked item | Inventory movement enabled |

---

# 5. Phase 4 — Opening Balances

**UI:** Accounting → Opening Balances

This is a mandatory phase between master setup and normal voucher transactions.

Opening Balances must not be treated as an ordinary Journal Voucher unless the application explicitly supports and reconciles the corresponding subledgers.

## 5.1 Prerequisites

- Tenant exists.
- Active fiscal year exists.
- Chart of Accounts is configured.
- Required headings and subheadings exist.
- GL accounts are available.
- Parties exist for party-wise AR/AP balances.
- Items exist for inventory opening balances.
- Default account mappings are complete.

## 5.2 Required workflow

1. Select the active fiscal year.
2. Select the opening balance effective date.
3. Load available Chart of Accounts.
4. Display account headings and subheadings.
5. Select the appropriate ledger account.
6. Enter debit or credit opening balance.
7. For receivables, select the customer and enter the outstanding amount.
8. For payables, select the vendor and enter the outstanding amount.
9. For inventory, select the item and enter opening quantity and valuation.
10. Validate all entries.
11. Display the opening balance summary.
12. Confirm and save.
13. Verify the resulting GL and subledger balances.

## 5.3 Critical dependency behaviour

**Scenario OB1 — Chart of Accounts is empty**

- Display an account setup modal.
- Explain that Chart of Accounts must be configured first.
- Allow the user to navigate to Account Setup.
- Do not save any opening balance.

**Scenario OB2 — Required heading is missing**

- Display a clear error identifying the missing heading.
- Cancel the opening balance operation.
- Do not silently skip the line.
- Do not create an arbitrary account.
- Do not partially save the opening balances.

**Scenario OB3 — Missing subheading**

- Display the missing subheading.
- Require the user to correct the Chart of Accounts.
- Cancel the dependent operation.

**Scenario OB4 — Unbalanced opening balances**

- Display total debits and credits.
- Block confirmation if they do not match.
- Explain the difference.

## 5.4 Accounting validations

| Validation | Expected result |
|---|---|
| GL opening debits | Equal GL opening credits |
| Customer opening balances | Match AR control account |
| Vendor opening balances | Match AP control account |
| Inventory opening value | Matches inventory GL control account |
| Missing account | Save blocked |
| Missing party | Party opening entry blocked |
| Duplicate opening entry | Prevented or explicitly updated |
| Fiscal year mismatch | Save blocked |
| Existing posted opening balances | Editing restricted and audited |

### Important

Party-wise opening balances must populate customer/vendor ledgers and aging reports.

Do not use a generic Journal Voucher to create an AR/AP control account balance without its corresponding party-wise allocations.

Inventory opening balances must also reconcile with the inventory valuation ledger.

## 5.5 Opening balance E2E tests

Create a dedicated `opening-balances.spec.ts`.

Test:

- Empty Chart of Accounts.
- Missing account heading.
- Missing subheading.
- Missing customer/vendor.
- Missing inventory item.
- Unbalanced debit/credit.
- Successful opening balance.
- Party-wise reconciliation.
- Inventory reconciliation.
- Duplicate submission.
- Editing a posted opening balance.

Use an isolated fixture for these tests. Reset it before the main 13-document transaction sequence so opening balances are not accidentally counted twice.

---

# 6. Phase 5 — Sequential Voucher Transactions

**UI:** Vouchers → New (`/vouchers/new/:docType`)

All 13 documents must be posted in the exact sequence below.

**Fiscal year:** 2083/84

The first voucher date is corrected to 17 July 2026 so that all 13 documents belong to FY 2083/84.

## 6.1 Transaction sequence

| # | Document | Date | Party | Lines / Description | Tax | Net | VAT | Gross | Expected number |
|---|---|---|---|---|---:|---:|---:|---:|---|
| 1 | Journal Voucher | 2026-07-17 | — | Bank 400,000 Dr; Cash 90,000 Dr; Petty Cash 10,000 Dr; Capital 500,000 Cr | — | 500,000 | — | 500,000 | JV-2083-84-0001 |
| 2 | GRN | 2026-07-18 | Kathmandu Wholesale Suppliers | Rice 300×70; Ghee 50×600; Dhup 100×150 | 0% | 66,000 | 0 | 66,000 | GRN-2083-84-0001 |
| 3 | Purchase Invoice | 2026-07-20 | Nepal Stationery House | Office supplies 1×12,000 | 13% | 12,000 | 1,560 | 13,560 | PI-2083-84-0001 |
| 4 | Payment Voucher | 2026-07-22 | Nepal Stationery House | Settle 13,560 via bank | 0% | 13,560 | 0 | 13,560 | PV-2083-84-0001 |
| 5 | Sales Invoice | 2026-07-24 | Hotel Annapurna | Khada 50×120; Diyo 30×260; Dhup 40×220 | 13% | 22,600 | 2,938 | 25,538 | SI-2083-84-0001 |
| 6 | Sales Invoice | 2026-07-28 | Boudhanath Stupa Trust | Ghee 20×800; Rice 100×95 | 13% | 25,500 | 3,315 | 28,815 | SI-2083-84-0002 |
| 7 | Receipt Voucher | 2026-07-30 | Hotel Annapurna | Settle 25,538 via cash | 0% | 25,538 | 0 | 25,538 | RV-2083-84-0001 |
| 8 | Delivery Challan | 2026-08-02 | Patan Handicrafts | Thali 25×900 | 0% | 22,500 | 0 | 22,500 | DC-2083-84-0001 |
| 9 | Credit Note | 2026-08-04 | Boudhanath Stupa Trust | Reference SI-0002; returned Ghee 5×800 | 13% | 4,000 | 520 | 4,520 | CN-2083-84-0001 |
| 10 | Petty Cash Voucher | 2026-08-06 | — | Refreshments 2,500 | 0% | 2,500 | 0 | 2,500 | PC-2083-84-0001 |
| 11 | Sales Invoice | 2026-08-08 | Thamel Tours & Travels | Candles 100×45; Khada 25×120 | 13% | 7,500 | 975 | 8,475 | SI-2083-84-0003 |
| 12 | Journal Voucher | 2026-08-10 | — | Rent 35,000 Dr / Bank 35,000 Cr | — | 35,000 | — | 35,000 | JV-2083-84-0002 |
| 13 | Journal Voucher | 2026-08-12 | — | Salaries 60,000 Dr / Bank 60,000 Cr | — | 60,000 | — | 60,000 | JV-2083-84-0003 |

### Draft documents

Create five additional drafts dated 13–14 August 2026.

- Save drafts.
- Do not post them.
- Do not assign permanent voucher numbers.
- Ensure they appear with Draft status.

The draft fixtures should use valid master data but remain outside the posted ledger.

## 6.2 Accounting posting expectations

Posting a document must create the appropriate accounting and subledger effects.

| Document | Required effect |
|---|---|
| Journal Voucher | Balanced GL entries |
| GRN | Stock receipt and configured GRNI/accounting treatment |
| Purchase Invoice | Supplier liability, purchase/expense or inventory, input VAT |
| Payment Voucher | Bank credit and supplier liability debit |
| Sales Invoice | Customer receivable, sales income and output VAT |
| Receipt Voucher | Cash debit and customer receivable credit |
| Delivery Challan | Stock movement according to configured delivery policy |
| Credit Note | Reverse sales/VAT and apply return stock/COGS treatment |
| Petty Cash Voucher | Petty cash credit and expense debit |

### GRN and inventory policy

The application must explicitly define whether GRN is:

- A stock-only receipt pending purchase invoice; or
- An accounting event that creates inventory and a GRNI liability.

For a perpetual inventory implementation using GRNI, the expected entry for this fixture is:

- Debit Inventory: 66,000
- Credit GRNI: 66,000

The later purchase invoice must clear the corresponding GRNI amount when it references that GRN.

The current stationery purchase invoice is a separate transaction and must not accidentally clear the wholesale GRN.

### Delivery Challan policy

Define whether delivery challans reserve stock, reduce available stock or create an actual stock issue.

A delivery challan must not create sales revenue or customer receivables unless the application explicitly treats it as an invoiced transaction.

### Inventory and sales

Sales invoices must reduce stock for stock-tracked items and calculate COGS using the configured inventory valuation method.

Credit notes must restore returned quantities and reverse the associated cost where applicable.

Do not calculate COGS using the sales selling price.

## 6.3 Per-voucher assertions

For every voucher:

1. Form values are retained after saving.
2. Net, VAT and gross calculations are correct.
3. Correct party is displayed.
4. Correct account mappings are used.
5. Posting creates exactly one transaction.
6. Posting creates the expected accounting entries.
7. Voucher number is unique.
8. Voucher number uses the active FY.
9. Voucher appears in the correct list.
10. List sorting reflects the latest update.
11. Local date/time formatting is correct.
12. Drafts do not enter posted ledgers.

### Numbering rules

Numbering must be:

- Per document type.
- Per fiscal year.
- Independent of other document types.
- Generated authoritatively by the server.
- Protected against concurrent requests.

The preview number must match the assigned number in the sequential single-user E2E fixture.

If concurrent posting is supported, number allocation must be atomic. A stale preview must never cause duplicate or incorrect posting.

### Required voucher tests

| ID | Gap | Test |
|---|---|---|
| T27 | Duplicate posting | Retry Save & Post; exactly one posted voucher |
| T28 | Zero amount display | Enter positive amount; verify list value |
| T29 | Number mismatch | Preview equals assigned number |
| T30 | Concurrent posting | Unique sequential numbers |
| T31 | Wrong FY | Posting rejected |
| T32 | Closed FY | Posting rejected |
| T33 | Unbalanced JV | Posting blocked |
| T34 | Missing default account | Posting blocked |
| T35 | Insufficient stock | Follow configured negative-stock policy |
| T36 | Credit note reference | Cannot reference invalid or unrelated invoice |
| T37 | Excessive return | Cannot exceed eligible returned quantity |

Add:

- `data-testid="voucher-amount"`
- `data-testid="voucher-number-preview"`

Draft badge must have a visually distinct appearance from Posted.

---

# 7. Phase 6 — Ledger Reconciliation

Before checking financial statements, reconcile the underlying ledgers.

This phase is essential because a report can display plausible totals while its underlying ledger entries are wrong.

## 7.1 Accounts Receivable

Expected calculation:

SI-0001: 25,538  
SI-0002: 28,815  
SI-0003: 8,475  
Less RV-0001: 25,538  
Less CN-0001: 4,520

**Expected AR closing: 32,770**

Verify:

- Hotel Annapurna: 0
- Boudhanath Stupa Trust: 24,295
- Thamel Tours & Travels: 8,475
- Total: 32,770

## 7.2 Accounts Payable

Purchase Invoice: 13,560  
Payment Voucher: 13,560

**Expected AP closing: 0**

Verify:

- Nepal Stationery House: 0
- AP control account: 0

GRNI must be reconciled separately if the GRN policy creates a GRNI liability.

## 7.3 Cash and Bank

| Account | Opening | Movement | Expected closing |
|---|---:|---:|---:|
| Cash | 90,000 | +25,538 | 115,538 |
| Petty Cash | 10,000 | -2,500 | 7,500 |
| Bank | 400,000 | -13,560 -35,000 -60,000 | 291,440 |

The petty cash voucher is assumed to be paid from the Petty Cash account, not the main Cash account.

## 7.4 Inventory reconciliation

Verify:

- Opening stock quantity and value.
- GRN received quantity.
- Sales invoice issued quantities.
- Delivery challan quantities.
- Credit note returned quantities.
- Closing stock quantities.
- Inventory valuation.
- Inventory GL control account.

Inventory quantity and valuation must reconcile to the stock ledger under the configured valuation method.

## 7.5 General ledger reconciliation

For each control account:

- AR GL = Customer ledger total.
- AP GL = Vendor ledger total.
- Inventory GL = Inventory valuation total, subject to the defined GRNI policy.
- Cash GL = Cash book.
- Bank GL = Bank book.
- VAT control accounts = VAT register balances.

**Acceptance:** No unexplained difference is allowed.

---

# 8. Phase 7 — Reports and Expected Outputs

**UI:** Reports

Required reports:

- Trial Balance
- Profit & Loss
- Balance Sheet
- Sales Register
- Purchase Register
- Sales Return Register
- VAT Registers
- Cash Book
- Bank Book
- General Ledger
- Party Ledger
- Accounts Receivable Aging
- Accounts Payable Aging
- Stock Ledger
- Inventory Valuation
- Daybooks

## 8.1 Expected report assertions

| Report / check | Expected value |
|---|---:|
| Trial Balance | Debits = Credits |
| AR closing | 32,770 |
| AP closing | 0 |
| Sales Register net | 55,600 |
| Sales Register VAT | 7,228 |
| Sales Return net | -4,000 |
| Sales Return VAT | -520 |
| Purchase Register net | 12,000 |
| Purchase Register VAT | 1,560 |
| Net VAT payable | **5,148** |
| Cash closing | 115,538 |
| Petty Cash closing | 7,500 |
| Bank closing | 291,440 |
| Net sales after returns | 51,600 |
| Expenses before COGS | 109,500 |
| Net P&L before COGS | -57,900 |
| Posted vouchers | 13 |
| Draft vouchers | 5 |

## 8.2 VAT calculation

Output VAT:

- SI-0001: 2,938
- SI-0002: 3,315
- SI-0003: 975

Total output VAT: 7,228

Less sales return VAT: 520

Less input VAT: 1,560

**Net VAT payable = 5,148**

VAT registers must show the correct document types and negative return amounts.

TDS must have its own configured tax treatment and register tests. No TDS amount should be assumed in this fixture because no TDS-bearing transaction has been included.

## 8.3 Profit & Loss calculation

Net sales after returns:

55,600 - 4,000 = 51,600

Operating expenses:

- Office supplies: 12,000
- Refreshments: 2,500
- Rent: 35,000
- Salaries: 60,000

Total: 109,500

Net result before COGS:

51,600 - 109,500 = **-57,900**

This is an intermediate expected result, not the final P&L where perpetual inventory and COGS are posted.

The final P&L must include the actual cost of inventory sold and any other configured stock-related accounting adjustments.

## 8.4 Balance Sheet

Assertions:

- Total assets = Total liabilities + Equity.
- Customer control account agrees with AR.
- Supplier control account agrees with AP.
- Inventory agrees with stock valuation.
- GRNI agrees with unbilled receipts, where applicable.
- VAT control accounts agree with VAT registers.
- Bank, cash and petty cash agree with their respective books.

Do not hardcode a final Balance Sheet amount until the inventory valuation and GRNI treatment are fully defined.

## 8.5 Report export tests

| ID | Test | Expected result |
|---|---|---|
| T38 | Trial Balance export | Matches visible rows |
| T39 | P&L export | Matches report values |
| T40 | Balance Sheet export | Balanced |
| T41 | VAT tabs | Correct document filtering |
| T42 | Credit note rows | Negative values |
| T43 | CSV export | Matches visible data |
| T44 | PDF export | Matches visible data |
| T45 | Print | Correct report layout |
| T46 | FY switching | Report values change appropriately |

---

# 9. Phase 8 — Period Closing and Reopening

**UI:** Settings → Fiscal Settings

This phase verifies that the accounting system protects historical financial data.

## Tests

1. Close the current fiscal year or accounting period according to supported functionality.
2. Attempt to create a new voucher in the closed period.
3. Attempt to edit an existing posted voucher.
4. Attempt to delete an existing posted voucher.
5. Attempt to post a saved draft.
6. Verify all attempts follow the configured restrictions.
7. Reopen the period using an authorised user.
8. Verify permitted transactions can be posted again.
9. Verify previously posted records remain unchanged.

### Additional requirements

- Closing must be permission-controlled.
- Closed periods must not accept backdated postings.
- Reopening must create an audit event.
- Reopening must not reset voucher numbering.
- Historical reports must remain reproducible.

---

# 10. Phase 9 — Accounting Integrity and Regression

These tests should run independently of the happy-path sequence.

## 10.1 Transaction integrity

- Double-click Save & Post.
- Simulate slow network.
- Retry failed network requests.
- Refresh during submission.
- Open the same voucher in two sessions.
- Submit simultaneous postings.
- Verify idempotency.
- Verify transaction rollback on posting failure.

## 10.2 Data integrity

- Tenant isolation.
- Fiscal year isolation.
- Unique voucher numbering.
- Unique party PAN validation.
- Unique item codes.
- GL debit/credit equality.
- Subledger/control account reconciliation.
- Referential integrity.
- Soft delete and audit trail.
- No orphaned accounting entries.

## 10.3 Offline functionality

Test:

1. Create offline draft.
2. Restore network.
3. Synchronise draft.
4. Resolve conflicts.
5. Retry failed synchronisation.
6. Verify only one server-side record exists.
7. Verify numbering is assigned according to server-side posting rules.

## 10.4 Audit trail

Every posted transaction must preserve:

- Created by.
- Created timestamp.
- Updated by.
- Updated timestamp.
- Posted by.
- Posted timestamp.
- Voucher number.
- Posting status.
- Reversal reference, where applicable.

Posted transactions must not be silently deleted or overwritten.

Corrections should use an approved reversal or adjustment workflow.

---

# 11. Phase 10 — Test Execution and Automation

## 11.1 Vitest

Required unit tests:

| Test file | Coverage |
|---|---|
| `account-group-select.test.ts` | Account type → group filtering |
| `party-validation.test.ts` | PAN uniqueness |
| `opening-balances.test.ts` | Account hierarchy and balance validation |
| `opening-balance-reconciliation.test.ts` | GL and subledger consistency |
| `voucher-numbering.test.ts` | Per-document and per-FY numbering |
| `voucher-posting.test.ts` | Posting calculations and idempotency |
| `vat-register.test.ts` | VAT document filtering |
| `credit-note.test.ts` | Negative returns and reversal |
| `inventory-ledger.test.ts` | Stock movement and valuation |
| `trial-balance.test.ts` | Debit/credit reconciliation |

## 11.2 Playwright

Execute sequentially with one worker.

| Spec | Purpose |
|---|---|
| `00-shell.spec.ts` | Login and environment preparation |
| `01-settings.spec.ts` | Company settings and fiscal year |
| `02-accounts.spec.ts` | Chart of Accounts |
| `03-masters.spec.ts` | Parties and inventory |
| `04-opening-balances.spec.ts` | Opening balance workflow |
| `05-vouchers.spec.ts` | All 13 voucher transactions |
| `06-journal.spec.ts` | Journal-specific tests |
| `07-reconciliation.spec.ts` | AR, AP, cash, bank and stock |
| `08-reports.spec.ts` | Financial reports and exports |
| `09-period-close.spec.ts` | Period closing and reopening |
| `10-offline.spec.ts` | Offline draft and sync |
| `setup-guard.spec.ts` | Missing prerequisite behaviour |
| `default-accounts.spec.ts` | Missing default account warnings |
| `opening-balance-guards.spec.ts` | Missing headings and invalid balances |

## 11.3 Test execution rules

- Use deterministic seed data.
- Run sequential E2E with `--workers=1`.
- Do not allow dependent tests to run when prerequisites fail.
- Capture screenshots on failure.
- Capture browser console errors.
- Capture failed API requests.
- Save Playwright traces.
- Verify database state after posting.
- Verify the final reports against expected values.

---

# 12. Staging Reset and Execution

**Environment:** Staging only.

## 12.1 Reset staging

```bash
DATABASE_URI=postgresql://nepse:nepse_dev@82.165.181.153:5432/syasha_staging \
./scripts/staging-cleanup.sh
```

The cleanup script must:

- Verify the target database is staging.
- Reject production database connections.
- Require explicit confirmation or a staging-only safety flag.
- Avoid deleting global configuration that must persist.
- Remove dependent records in the correct order.
- Verify the database is clean afterward.

## 12.2 Seed data

```bash
SKIP_VOUCHERS=1 node billing-seed.mjs
```

The seed script must be idempotent and create:

- Tenant.
- Billing settings.
- Fiscal year.
- Account groups.
- GL accounts.
- Default account mappings.
- Parties.
- Items.
- Tax types.

Opening balance fixtures should be managed separately so they can be tested and reset independently.

## 12.3 Typecheck

```bash
npx tsc --noEmit

cd apps/billing
npx tsc --noEmit
```

## 12.4 Run unit tests

```bash
pnpm exec vitest run
```

## 12.5 Run sequential Playwright

```bash
cd apps/billing

pnpm exec playwright test --workers=1
```

---

# 13. Final Acceptance Criteria

The accounting workflow is considered complete only when all the following conditions are satisfied.

| # | Acceptance criteria | Status |
|---|---|---|
| 1 | Tenant and settings correctly configured | Required |
| 2 | Fiscal year correctly configured | Required |
| 3 | Chart of Accounts hierarchy valid | Required |
| 4 | Default accounts mapped | Required |
| 5 | Parties and items configured | Required |
| 6 | Opening balances validated and reconciled | Required |
| 7 | All 13 vouchers posted in sequence | Required |
| 8 | Exactly five drafts remain unposted | Required |
| 9 | No duplicate vouchers | Required |
| 10 | Voucher numbering correct | Required |
| 11 | AR and AP reconciled | Required |
| 12 | Cash and bank reconciled | Required |
| 13 | Inventory reconciled | Required |
| 14 | VAT registers reconciled | Required |
| 15 | Trial Balance balanced | Required |
| 16 | Balance Sheet balanced | Required |
| 17 | P&L includes applicable COGS | Required |
| 18 | Exports match visible reports | Required |
| 19 | Period closing restrictions work | Required |
| 20 | Audit trail is complete | Required |
| 21 | Offline synchronisation has no duplicates | Required |
| 22 | No unresolved critical E2E failures | Required |

**Definition of Done:** A complete accounting month can be configured, processed, posted, reconciled and reported without manual database intervention, silent failures, duplicate transactions or unexplained accounting differences.
