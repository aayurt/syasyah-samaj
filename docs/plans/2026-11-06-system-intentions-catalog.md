# Complete System Components Intention & Specification Catalog

This document specifies the exact business intentions, UX rules, data validation rules, and accounting invariants for every module in the Syasyah Samaj billing application.

---

## 1. Core Accounting & Master Setup

### 1.1 Fiscal Year Configuration
- **Purpose:** Manage active accounting intervals, locking, and opening/closing boundaries.
- **Rules & Invariants:**
  - `startDate < endDate`.
  - Date interval must be at least 30 calendar days (standard is 365/366 days, typically BS Shrawan 1 to Ashadh end).
  - No identical start and end values.
  - Overlapping date ranges across fiscal years within the same tenant are strictly rejected.
  - Freeze date constraint: transactions dated $\le$ `freezeDate` are read-only and cannot be posted, edited, or voided.
- **Naming Pattern:** Standardized to `YYYY/YY` (e.g., `2081/82` BS or `2024/25` AD).

### 1.2 Chart of Accounts (CoA) Tabular UI & Hierarchy
- **Purpose:** Provide an extensible 5-category ledger hierarchy (`Asset`, `Liability`, `Equity`, `Revenue`, `Expense`).
- **UI Structure:**
  - Tabular layout with expandable tree nodes (parent group $\rightarrow$ ledger accounts).
  - Columns: Account Code, Account Name, Root Category, Parent Group, Current Balance, Currency, Status, Actions.
  - Search by code and name, filterable by root category.
- **Invariants:**
  - Unique account code per tenant.
  - Deletion blocked if historical journal entries or opening balance exist (soft-archive only).
  - System accounts (Cash, AR, AP, Retained Earnings) cannot be deleted or re-typed.

### 1.3 Default Accounts Mapping
- **Purpose:** Bind fallback GL accounts for automated document posting without manual ledger picking.
- **Mapped Slots:**
  - Cash-in-Hand (`Asset`)
  - Primary Operating Bank (`Asset`)
  - Accounts Receivable / Debtors Control (`Asset`)
  - Accounts Payable / Creditors Control (`Liability`)
  - Sales VAT / Output Tax (`Liability`)
  - Purchase VAT / Input Tax (`Asset`)
  - Retained Earnings / Current Year Surplus (`Equity`)
- **Validation:** Selected accounts must match the strict root category required by the slot.

### 1.4 Opening Balances Management
- **Purpose:** Establish baseline balances when onboarding tenants or starting clean fiscal books.
- **UI Structure:**
  - Tabular entry grid listing all balance sheet accounts (Assets, Liabilities, Equity).
  - Debit and Credit numeric entry columns.
  - Real-time sticky balancing bar: $\sum Debit$, $\sum Credit$, Difference $\Delta$.
- **Invariant:**
  - Save action disabled unless $\Delta == 0.00$.
  - Saves generate an initial `OPENING` journal voucher timestamped at fiscal year start date.

---

## 2. Master Data Management

### 2.1 Parties (Customers & Suppliers)
- **Purpose:** Track external entities for sales, purchases, receipts, and payments.
- **Fields:** Name, Type (`Customer`, `Supplier`, `Both`), PAN/VAT No., Phone, Email, Address, Credit Limit, Opening Balance.
- **Rules:**
  - PAN/VAT format validation (9 digits for Nepal).
  - Party statement links directly to ledger transactions.
  - Cannot delete party with linked vouchers.

### 2.2 Items & Services
- **Purpose:** Inventory catalog and billing service items.
- **Fields:** Code, Name, Type (`Stock Item`, `Service`), Unit of Measure (UOM), Default Sales Price, Default Purchase Cost, Tax Type (VAT 13%, Exempt), Linked Income Account, Linked Expense Account.
- **Rules:**
  - Stock quantity tracked only for `Stock Item`.
  - Negative inventory guard toggle (warn or block if quantity < 0).

### 2.3 Members & Membership Types
- **Purpose:** Community organization member roster, periodic dues, and renewal billing.
- **Fields:** Member ID, Full Name, Nepali Name, Blood Group, Contact, Illaka, Membership Type, Status (`Active`, `Lapsed`, `Honorary`).
- **Rules:**
  - Blood group strictly matches valid types (`A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+`, `O-`).
  - Automated dues generation via Recurring Billing schedules.

---

## 3. Transactional Voucher Workflow

### 3.1 Voucher Form (`VoucherForm.tsx`)
- **Supported Types:** Sales Invoice, Purchase Invoice, Receipt, Payment, Journal Entry, Credit Note, Debit Note, Contra (Bank Transfer).
- **Rules & Invariants:**
  - Auto-generated document numbers strictly scoped to `[Tenant] + [DocType] + [FiscalYear]`.
  - Balanced lines rule: For manual journal entries, $\sum Debit = \sum Credit$ before submit.
  - Tax calculation: Line item discounts calculated before VAT application; automatic roundoff computation.
  - Outbox integration: If offline, payload stored in local IndexedDB outbox; server assigns final sequence on sync.

### 3.2 Posting Engine (`Posting.tsx`)
- **Purpose:** State machine transition from `Draft` $\rightarrow$ `Posted`.
- **Invariants:**
  - Creates immutable `journal_entries` and updates party/account running balances atomically.
  - Posted vouchers lock all accounting fields (dates, amounts, accounts).

### 3.3 Void Cascades & Settlement Protection
- **Rules:**
  - An invoice with allocated receipts or credit notes **cannot** be voided directly (returns 400 with explanation).
  - User must void allocations in reverse chronological order: Receipts $\rightarrow$ Credit Notes $\rightarrow$ Invoice.
  - Voiding creates compensating negative / reversal ledger lines; historical trail is preserved, never hard deleted.

---

## 4. Banking & Cash Management

### 4.1 Bank Reconciliation (`BankReconciliation.tsx`)
- **Purpose:** Reconcile system bank ledger against imported bank statements.
- **Rules:**
  - Match by date window, amount, and reference number.
  - Cleared status updates `clearedAt` timestamp without altering original posted ledger.
  - Difference widget: Statement Closing Balance vs System Cleared Balance.

### 4.2 Cash & Transfers (`Transfers.tsx`, `Daybooks.tsx`)
- **Purpose:** Contra vouchers (Cash $\leftrightarrow$ Bank, Bank $\leftrightarrow$ Bank) and daily petty cash logs.
- **Rules:**
  - Source and destination accounts cannot be identical.
  - Petty cash limits enforced if enabled in settings.

---

## 5. Payroll Management

### 5.1 Employee Roster & Salary Structures (`Payroll.tsx`, `PayrollSettingsPage.tsx`)
- **Purpose:** Define base pay, allowances, provident fund (SSF/CIT), and TDS deductions.
- **Rules:**
  - Nepal TDS slabs calculation support.
  - Pay run approval creates single summary journal entry:
    - Debit: Salary Expense, Allowance Expense
    - Credit: Provident Fund Payable, TDS Payable, Net Salaries Payable.

### 5.2 Payroll Registers (`PayrollRegisters.tsx`)
- **Purpose:** Monthly payslip generation, disbursement tracking, and tax withholding certificates.

---

## 6. Financial Reports & Invariant Audits

### 6.1 Trial Balance (`TrialBalance.tsx`)
- **Rule:** Strict zero-sum balance: $\sum Debit - \sum Credit = 0$. Grouped by Level 1/Level 2 CoA groups.

### 6.2 Profit & Loss Statement (`ProfitLoss.tsx`)
- **Formula:** Net Profit/Loss = Total Revenues - Total Expenses (Operating + Direct + Indirect).

### 6.3 Balance Sheet (`BalanceSheet.tsx`)
- **Formula:** $\text{Total Assets} = \text{Total Liabilities} + \text{Equity} + \text{Current Year Net Profit}$.

### 6.4 Aging & Statements (`Aging.tsx`, `PartyStatement.tsx`)
- **Bucketing:** Current (0-30 days), 31-60, 61-90, 90+ days.
- **Reconciliation:** Running balance matches party control account in GL.

---

## 7. System Governance & In-App Transparency

### 7.1 In-App Objectives & Goals Page (`Objectives.tsx`)
- **Route:** `/objectives`
- **Purpose:** Live in-app transparency display for committee members, accountants, and auditors.
- **Sections:**
  1. **Accounting Invariants:** Double-entry proofs, zero nominal carry-forward, tenant isolation.
  2. **Security & Data Integrity:** Void cascade protections, immutable audit logs, freeze dates.
  3. **Feature Roadmap & Milestones:** Current release capabilities, offline-first status, pending modules.

### 7.2 Audit Log & Data Management (`AuditLog.tsx`, `DataManagement.tsx`)
- **Purpose:** Full forensic trail of user actions, JSON/CSV data backup, and database re-indexing.
- **Rules:**
  - Every create, update, post, void, and export is recorded with user ID, timestamp, and IP.
  - Immutable append-only log.
