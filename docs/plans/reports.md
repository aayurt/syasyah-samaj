# Implementation Prompt: Simple Accounting Reports Module

## Role

Act as a senior full-stack engineer and accounting-systems architect.
Implement the Reports module in the existing accounting application.
First inspect the current codebase, conventions, database schema, chart
of accounts, transaction lifecycle, posting engine, and UI components.
Extend existing patterns rather than introducing a new architecture.

## Primary objective

Build a simple, clean, reliable Reports experience for a Nepal-based
accounting application that supports both for-profit and nonprofit
organisations.

The UI should be easy for non-accountants to understand: - Clear report
categories and predictable navigation. - Compact, readable tables with
sensible column widths. - A small set of useful filters, not a wall of
controls. - Consistent report headers, totals, empty states, and export
actions. - No unnecessary cards, gradients, decorative charts, or
complex dashboards. - Responsive layout and accessible controls.

Use the existing design system and component library. Do not add a new
UI library unless absolutely necessary.

## 1. Report navigation

Organise reports into these categories. Use a simple list, grouped
navigation, or collapsible sections consistent with the existing
application.

### Financial reports

-   Balance Sheet / Statement of Financial Position
-   Profit and Loss / Income and Expenditure
-   Cash Flow Statement
-   Trial Balance
-   General Ledger Transactions
-   Account Ledger
-   Statement of Changes in Equity / Funds
-   Receivables
-   Payables
-   Cash and Bank Summary

### Tax reports

-   Tax Codes
-   Tax Audit
-   Tax Summary
-   Tax Totals
-   Tax Reconciliation
-   Tax Transactions
-   Taxable Sales per Customer
-   Taxable Purchases per Supplier
-   VAT Sales Register
-   VAT Purchase Register

### Inventory reports

-   Inventory Items
-   Inventory Value Summary
-   Inventory Quantity Summary
-   Inventory Profit Margin
-   Inventory Costing Calculation Worksheet
-   Stock Movement
-   Stock Adjustment

### Fixed asset reports

-   Fixed Asset Register
-   Fixed Asset Summary
-   Depreciation Calculation Worksheet
-   Depreciation Schedule
-   Asset Disposal

### Intangible asset reports

-   Intangible Asset Register
-   Intangible Asset Summary
-   Amortisation Calculation Worksheet
-   Amortisation Schedule
-   Intangible Asset Disposal

### Membership and nonprofit reports

-   Membership Register
-   Membership Summary
-   Membership Fee Collection
-   Member Outstanding
-   Member Contribution
-   Donation Report
-   Fund Collection
-   Member Receipt History

Do not create duplicate reports that show the same information under
different names. Reuse a report with an appropriate
organisation-specific title where the underlying calculation is the
same.

## 2. Simple reports landing page

The Reports page should: - Show the report categories and report names
clearly. - Allow a user to open a report in one click. - Include a
search field to find a report by name. - Avoid showing every report as a
large dashboard card. - Optionally show recently used reports only if
the application already supports this pattern.

Do not make the landing page a complex analytics dashboard.

## 3. Shared report layout

Create one reusable report page/layout used by all reports.

Each report should have: 1. Report title. 2. Short description only
where useful. 3. Common filter row. 4. Generate/Apply action only if the
current app requires it; otherwise update naturally. 5. Report table or
statement. 6. Totals/subtotals where applicable. 7. Export/print
actions, if supported by the application.

### Common filters

Keep filters minimal and context-sensitive: - Date range or financial
year. - Status, where relevant. - Account, member, customer, supplier,
item, or fund, where relevant. - Branch/project/cost centre, only if
supported by the existing data model.

Do not display irrelevant filters on every report. Use sensible
defaults, such as the current financial year, and make the selected
period visible.

### Table behaviour

-   Right-align monetary values.
-   Use consistent currency formatting (NPR).
-   Show debit and credit in separate columns where appropriate.
-   Display totals and subtotals clearly.
-   Use consistent date formatting.
-   Support sorting and pagination for detailed transaction reports.
-   Provide useful empty states.
-   Avoid excessive borders and visual noise.
-   Do not truncate important account names or references without a way
    to inspect them.

## 4. Accounting logic: non-negotiable rules

All financial statements must be based on posted accounting entries, not
independently calculated from invoice totals or UI state.

### General Ledger as the financial source of truth

-   Posted journal lines are the source for financial statements.
-   Draft, pending, rejected, and deleted transactions must not affect
    posted financial reports.
-   Reversed transactions must be handled through the application's
    established reversal model.
-   Never silently exclude a posted entry because it has an incomplete
    optional description or attachment.
-   Use the accounting date/posting date consistently and document which
    date drives each report.
-   Respect the selected organisation, financial year, currency, and
    access permissions.
-   Use the existing account classifications and chart of accounts
    mappings.

### Double-entry integrity

-   Each posted journal must balance: total debits equal total credits.
-   Do not repair or hide unbalanced entries inside a report.
-   Report integrity errors separately and provide a route to inspect
    the source transaction.
-   Use decimal-safe monetary arithmetic; do not use floating-point
    arithmetic for financial calculations.
-   Apply consistent rounding rules.

### Financial statement calculations

**Trial Balance** - Group posted ledger balances by account. - Show
opening balance, period debits, period credits, and closing balance
where supported. - Debit and credit totals must reconcile.

**Balance Sheet / Statement of Financial Position** - Assets =
Liabilities + Equity/Funds. - Include balances as at the selected
reporting date. - Carry forward retained earnings/accumulated funds
according to the existing accounting model. - Do not treat
current-period income as an ordinary liability. - If the accounting
equation does not balance, show a clear warning and the variance; do not
fabricate a balancing figure.

**Profit and Loss / Income and Expenditure** - Include income and
expenses for the selected period. - For nonprofits, use Income and
Expenditure terminology where appropriate. - Calculate the
surplus/deficit for the period. - Keep donations, grants, membership
fees, and restricted funds classified according to the organisation's
configured accounts and fund accounting policy. Do not automatically
classify all receipts as sales revenue.

**Cash Flow** - Use actual cash and bank movements. - Classify flows as
operating, investing, or financing using account mappings or the
application's configured rules. - Avoid treating transfers between the
organisation's own cash/bank accounts as external cash flows. -
Reconcile opening cash + net movement = closing cash.

**General Ledger / Account Ledger** - Show transaction date, reference,
description, counterparty where relevant, debit, credit, and running
balance. - Opening balance + debits - credits (or the account's
normal-balance presentation) must reconcile to the closing balance. -
Allow drill-down to the originating transaction.

**Receivables and Payables** - Derive outstanding balances from posted
invoices/bills and their allocated receipts/payments/credit notes. - Do
not calculate outstanding balances from invoice status alone. - Support
ageing buckets, for example current, 1--30, 31--60, 61--90, and over 90
days. - Avoid counting a payment or credit allocation more than once.

**Statement of Changes in Equity / Funds** - Show opening balances,
current-period surplus/deficit, contributions/transfers, distributions
or other movements, and closing balances. - For nonprofits, support
accumulated funds and restricted/unrestricted fund classifications if
these exist in the data model. - Do not invent fund restrictions or
movements.

## 5. Tax, inventory, and asset reports

### Tax reports

-   Derive tax figures from posted transactions and tax-line records.
-   Separate taxable, zero-rated, exempt, and non-taxable amounts where
    configured.
-   Reconcile tax report totals to the relevant tax control ledger
    accounts.
-   Do not hardcode Nepal VAT rates; use effective-dated tax code
    configuration.
-   Show transaction references so users can trace reported values to
    source records.

### Inventory reports

-   Use the application's inventory costing method consistently (for
    example FIFO or weighted average, according to existing
    configuration).
-   Inventory value must reconcile with the inventory control account.
-   Quantity reports must account for posted stock movements, returns,
    and adjustments.
-   Do not treat draft stock movements as actual stock.
-   Show negative stock or costing exceptions as issues rather than
    hiding them.

### Fixed assets

-   Maintain an asset register with acquisition date, cost, useful life,
    residual value, method, accumulated depreciation, and carrying
    amount.
-   Depreciation calculations must use the configured method and policy.
-   Depreciation worksheet should preview calculations before posting.
-   Posting depreciation must create balanced journal entries through
    the existing posting engine.
-   Prevent duplicate depreciation posting for the same asset and
    period.
-   Asset disposals must account for cost, accumulated depreciation,
    proceeds, and gain/loss.

### Intangible assets

-   Follow the same register and lifecycle pattern as fixed assets.
-   Use amortisation rather than depreciation.
-   Apply configured useful life, residual value, and amortisation
    method.
-   Prevent duplicate amortisation posting.
-   Keep intangible asset balances separate from tangible fixed assets.

### Membership and nonprofit reports

-   Membership reports should use membership records and posted
    receipts, not assume every member is a customer.
-   Membership fee outstanding should reflect the organisation's actual
    fee rules and allocated receipts.
-   Donations, grants, membership fees, and other contributions should
    remain separately reportable.
-   Fund reports must respect restricted/unrestricted classifications
    only where those are recorded and supported.
-   Do not create sales invoices for member receipts unless the existing
    business rules explicitly require them.

## 6. Overall transaction health / audit report

Add a straightforward **Transaction Health** report. This is a
diagnostic report, not a replacement for the financial statements.

Show counts and links to inspect: - Draft or pending transactions
(clearly distinguish these from posted transactions). - Posted journals
that fail debit/credit validation. - Missing or invalid account
mappings. - Posted transactions with missing required tax codes. -
Duplicate transaction references, where uniqueness rules permit
detection. - Overdue receivables and payables. - Negative inventory
balances or costing exceptions. - Assets missing required
depreciation/amortisation settings. - Transactions posted to inactive
accounts, if permitted by legacy data.

Important: - Define each check precisely. - Do not label a transaction
"missing post" unless the system can identify an expected posting that
did not occur. - Do not report a draft transaction as an accounting
error merely because it is not posted. - Do not flag optional fields as
missing. - Each issue must link to the relevant transaction, account,
item, or asset. - Show issue count, severity, and a concise
explanation. - Avoid speculative "fraud" or "suspicious" labels.

## 7. Report filters and drill-down

Use shared filter logic, but only show filters relevant to the selected
report.

Every detailed report should support drill-down where possible: - Ledger
line → source transaction. - Receivable/payable row → invoice/bill and
allocations. - Inventory movement → stock transaction. - Asset row →
asset record and depreciation history. - Membership receipt → member and
receipt record. - Tax row → source transaction and tax details.

Keep filter state when navigating back from a drill-down where
practical.

## 8. Exports and printing

Reuse existing export infrastructure. Support CSV and PDF only if
already available or straightforward to implement using existing project
dependencies.

-   Export the currently filtered result, not the entire dataset
    accidentally.
-   Include organisation name, report title, reporting period, generated
    date, and currency.
-   Include totals and column headings.
-   Ensure PDF print layouts are readable and do not cut off monetary
    columns.
-   Do not add a new export dependency without checking the project
    first.

## 9. Technical implementation approach

Before coding: 1. Inspect the repository and identify the existing
frontend/backend architecture. 2. Find the chart of accounts and
journal/ledger schema. 3. Trace how receipts, payments, sales,
purchases, inventory, assets, and membership receipts are posted. 4.
Identify existing report APIs, query utilities, table components,
filters, and export utilities. 5. Identify organisation and
financial-year scoping rules. 6. Write a short implementation plan based
on the actual codebase.

During implementation: - Reuse existing components and service
patterns. - Create shared report layout, filter, table, summary, and
export components where appropriate. - Keep report-specific calculations
in tested backend/domain services rather than duplicating logic in
frontend components. - Use database aggregation for large datasets where
appropriate. - Apply organisation scoping and permission checks
server-side. - Prevent N+1 queries. - Use pagination for large
transaction reports. - Avoid unnecessary abstractions and premature
generalisation. - Do not change existing posting behaviour unless
required and explicitly justified. - Do not fabricate sample data in
production reports.

## 10. Testing and acceptance criteria

Add tests for the accounting calculations and report behaviour.

At minimum verify:

1.  Draft transactions do not affect financial statements.
2.  Posted balanced journals affect the correct accounts.
3.  Unbalanced journals are rejected by the posting workflow and
    surfaced by integrity checks if legacy data exists.
4.  Trial Balance debits equal credits.
5.  Balance Sheet satisfies Assets = Liabilities + Equity/Funds, subject
    to correctly represented opening and current-period balances.
6.  Cash Flow opening balance + movement = closing balance.
7.  General Ledger running balances reconcile.
8.  Partial payments reduce receivables/payables correctly.
9.  Credit notes and reversals are not double-counted.
10. Tax summaries reconcile with tax control accounts.
11. Inventory quantities and values reconcile with posted movements and
    the inventory control account.
12. Depreciation/amortisation cannot be posted twice for the same
    period.
13. Organisation and financial-year filters prevent cross-organisation
    data leakage.
14. Empty datasets and large datasets render correctly.
15. Exported results match the active filters and displayed totals.

## 11. UI quality checklist

-   [ ] Clean, simple, consistent layout.
-   [ ] No oversized dashboard cards for every report.
-   [ ] Report categories are easy to scan.
-   [ ] Filters are compact and relevant.
-   [ ] Tables are readable and aligned.
-   [ ] Monetary values use consistent NPR formatting.
-   [ ] Totals and subtotals are clear.
-   [ ] Empty, loading, and error states are handled.
-   [ ] Drill-down links work.
-   [ ] Responsive layout works on smaller screens.
-   [ ] Keyboard navigation and accessible labels are supported.

## 12. Scope discipline

Implement in small, reviewable stages. Prioritise:

**Stage 1:** Shared report layout, Trial Balance, General Ledger,
Balance Sheet, Profit and Loss/Income and Expenditure, Cash Flow.

**Stage 2:** Receivables, Payables, Statement of Changes in
Equity/Funds, Transaction Health.

**Stage 3:** Tax and inventory reports.

**Stage 4:** Fixed assets and intangible assets.

**Stage 5:** Membership and nonprofit reports.

Do not mark a report complete if it only has a UI shell or placeholder
numbers. Each completed report must use real data, correct accounting
logic, appropriate filters, and tests.

## Final instruction

First inspect the existing application and report back with: - Relevant
existing modules and data models. - Reusable UI components and
services. - Accounting logic gaps or risks. - A concise implementation
plan.

Then implement the reports in the stages above. Preserve the existing
application's conventions. Prefer the simplest correct solution over a
large redesign.
