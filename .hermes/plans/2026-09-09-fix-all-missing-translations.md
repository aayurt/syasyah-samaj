# Plan: Fix All Remaining Missing Translations

## Goal
Wire `useT()` into every remaining hardcoded English string across the billing SPA. Focus on the areas the user flagged: Settings page, descriptions, Trial Balance, and all other incomplete pages/components.

---

## Audit Results

### Settings.tsx — ~47 untranslated strings (HIGHEST PRIORITY)
- Title: "Settings"
- Calendar card: "Calendar type", "Date Format", "Time Format"
- Company Profile card: "Company Name", "PAN Number", "Contact Number", "Email", "Logo URL", "Address"
- Fiscal Years section: "Fiscal Years" title, "No fiscal years defined. Click Add Year to create the first period.", table headers ("Working", "Label", "Start", "End", "Status", "Actions"), "Label (e.g. 2083-84)", "Start date", "End date", "Entries dated inside a closed year are rejected on the server."
- Feature toggles: "Bank Reconciliation", "Simplified Invoice (VAT Inclusive)", "Threshold amount (Rs.)", "Demo seed"
- Default Accounts: section title, drag hint, account role labels
- Chart of Accounts: "Edit Account" / "New Account", table headers, "AVCO", "Bank", "Cash" badges
- Number Series: "No number series defined yet. Click Add Series to create one.", table headers ("Name", "Doc Type", "Prefix", "FY", "Last #", "Next #", "Actions")
- Language card: "Data input stays English — only labels and messages translate."
- General: "Unsaved changes", "Save" button

### TrialBalance.tsx — ~12 untranslated
- Title: "Trial Balance"
- Table headers: "Account", "Debit", "Credit", "Balance", "Totals"
- Ledger modal headers: "Number", "Date", "Narration", "Debit", "Credit", "Running"

### ReportsHub.tsx — ~25 untranslated
- Title: "Browse Various Reports"
- Placeholder: "Search reports…"
- Category tabs: "All Reports", "Transactions", "Parties", "Inventory", "Income Expense", "Business Status"
- All 18 report card titles + descriptions (Sales, Purchase, Day Book, Profit And Loss, Party Statement, All Party Report, Low Stock Summary, Stock Quantity Report, Inventory Valuation, Income Expense Report, Expense Category, Income Category, Balance Sheet, Cash In Hand Statement, Bank Statement, Tax Sales, Tax Purchase, VAT Registers)
- Empty state: "No reports match"

### Accounts.tsx — ~5 untranslated
- Title: "Chart of Accounts"
- Account class options: "Other", "Cash", "Bank"

### Dashboard.tsx — ~5 untranslated
- Table headers: "Date", "Narration", "Debit", "Credit", "Status"

### VoucherForm.tsx — ~10 untranslated
- "No parties found"
- "Invoice No"
- Table headers: "Name", "Qty", "Rate", "Discount", "Amount"
- "Sub Total"
- "Additive taxes"

### Components — ~40 untranslated across 10 files
- **PrintVoucher.tsx** (14) — invoice print layout labels
- **OutstandingInvoices.tsx** (8) — outstanding invoice list labels
- **LedgerModal.tsx** (6) — ledger modal headers
- **VoucherViewModal.tsx** (4) — voucher view modal labels
- **ConflictResolutionModal.tsx** (3) — conflict resolution labels
- **ImportPreviewModal.tsx** (1)
- **MemberViewModal.tsx** (1)
- **SetupChecklist.tsx** (1)
- **AccountSelect.tsx** (1)
- **SearchSelect.tsx** (1)

### MembershipTypes.tsx — needs audit
- Likely has form labels, column headers, empty state

---

## Execution Plan

### Phase 1: Settings page (biggest impact)
1. Read `pages/Settings.tsx` fully
2. Add new keys to `en.ts` + `ne.ts` under `settings.*` namespace:
   - `settings.title`: 'Settings' / 'सेटिङहरू'
   - `settings.calendarType`: 'Calendar type' / 'क्यालेन्डर प्रकार'
   - `settings.dateFormat`: 'Date Format' / 'मिति ढाँचा'
   - `settings.timeFormat`: 'Time Format' / 'समय ढाँचा'
   - `settings.companyName`: 'Company Name' / 'कम्पनी नाम'
   - `settings.panNumber`: 'PAN Number' / 'PAN नम्बर'
   - `settings.contactNumber`: 'Contact Number' / 'सम्पर्क नम्बर'
   - `settings.email`: 'Email' / 'इमेल'
   - `settings.logoUrl`: 'Logo URL' / 'लोगो URL'
   - `settings.address`: 'Address' / 'ठेगाना'
   - `settings.fiscalYears`: 'Fiscal Years' / 'वित्तिय वर्ष'
   - `settings.noFiscalYears`: 'No fiscal years defined...' / 'अहिलेसम्म कुनै...'
   - `settings.working`: 'Working' / 'कार्य'
   - `settings.label`: 'Label' / 'लेबल'
   - `settings.start`: 'Start' / 'शुरु'
   - `settings.end`: 'End' / 'अन्त'
   - `settings.actions`: 'Actions' / 'कार्यहरू'
   - `settings.startDate`: 'Start date' / 'शुरु मिति'
   - `settings.endDate`: 'End date' / 'अन्त मिति'
   - `settings.labelExample`: 'Label (e.g. 2083-84)' / 'लेबल (जस्तै २०८३-८४)'
   - `settings.closedYearNote`: 'Entries dated inside a closed year...' / 'बन्द वर्ष भित्रको...'
   - `settings.bankReconciliation`: 'Bank Reconciliation' / 'ब्याङ्क व्यवस्थापन'
   - `settings.simplifiedInvoice`: 'Simplified Invoice (VAT Inclusive)' / 'सरलीकृत इन्भोइस (VAT सहित)'
   - `settings.thresholdAmount`: 'Threshold amount (Rs.)' / 'सीमा रकम (रु.)'
   - `settings.demoSeed`: 'Demo seed' / 'डेमो बीजन'
   - `settings.editAccount`: 'Edit Account' / 'खाता सम्पादन'
   - `settings.newAccount`: 'New Account' / 'नयाँ खाता'
   - `settings.unsavedChanges`: 'Unsaved changes' / 'अस्वीकृत परिवर्तनहरू'
   - `settings.dataInputEnglish`: 'Data input stays English...' / 'डाटा इनपुट इंग्रेजीमा रहन्छ...'
   - `settings.noSeries`: 'No number series defined yet...' / 'अहिलेसम्म कुनै...'
   - `settings.tableName`: 'Name' / 'नाम'
   - `settings.tableDocType`: 'Doc Type' / 'कागजात प्रकार'
   - `settings.tablePrefix`: 'Prefix' / 'उपसर्ग'
   - `settings.tableLastNum`: 'Last #' / 'अन्तिम #'
   - `settings.tableNextNum`: 'Next #' / 'अर्को #'
3. Wire `useT()` into all Settings.tsx hardcoded strings

### Phase 2: Trial Balance + Reports Hub
1. **TrialBalance.tsx** — translate title + all table headers
2. **ReportsHub.tsx** — translate title, placeholder, categories, all 18 card titles+descriptions, empty state. Add keys under `reports.*` namespace.

### Phase 3: Remaining pages
1. **Accounts.tsx** — title + account class options
2. **Dashboard.tsx** — table headers
3. **VoucherForm.tsx** — form labels, table headers, empty states
4. **MembershipTypes.tsx** — audit + translate

### Phase 4: Components
1. **PrintVoucher.tsx** — invoice print labels (14 strings)
2. **OutstandingInvoices.tsx** — outstanding list labels (8 strings)
3. **LedgerModal.tsx** — ledger headers (6 strings)
4. **VoucherViewModal.tsx** — view modal labels (4 strings)
5. **ConflictResolutionModal.tsx** — conflict labels (3 strings)
6. **ImportPreviewModal.tsx**, **MemberViewModal.tsx**, **SetupChecklist.tsx**, **AccountSelect.tsx**, **SearchSelect.tsx** — 1 string each

### Phase 5: Dictionary expansion
- Add all new keys to `en.ts` + `ne.ts` as needed
- Estimated ~150 new keys total

---

## Verification
- `npx tsc --noEmit` passes
- Toggle language → Settings page fully in Nepali
- Trial Balance, Reports Hub, all pages flip to Nepali
- No hardcoded English visible in Nepali mode (except amounts, codes, emails, phone numbers)
