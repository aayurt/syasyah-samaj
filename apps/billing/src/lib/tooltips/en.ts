/**
 * Tooltip Content Dictionary - English
 * 
 * Keys match the format: tooltip.<section>.<field>
 * Used with TooltipWrapper key="section.field"
 */
export const tooltipsEn: Record<string, string> = {
  // General
  'general.save': 'Save changes (Ctrl+S)',
  'general.cancel': 'Cancel and discard changes',
  'general.delete': 'Delete this item permanently',
  'general.edit': 'Edit this item',
  'general.search': 'Search... (Ctrl+K)',
  'general.filter': 'Filter results',
  'general.export': 'Export data to Excel/CSV',
  'general.import': 'Import data from Excel/CSV',
  'general.refresh': 'Refresh data from server',
  'general.sync': 'Sync offline changes',

  // Tenant Selector
  'tenant.selector': 'Switch between Central (consolidated) and individual Illakas',
  'tenant.all': 'View consolidated data across all Illakas',
  'tenant.illaka': 'View data for this specific Illaka only',
  'tenant.locked': 'Your account is locked to this Illaka',

  // Accounts / Chart of Accounts
  'accounts.code': 'Unique account code (4-6 digits). Used for sorting and hierarchy. Must be unique.',
  'accounts.name': 'Account name as it appears in reports, vouchers, and statements.',
  'accounts.type': 'Account type determines balance sheet vs P&L placement and normal balance side (Debit/Credit).',
  'accounts.class': 'Account class for special handling: Cash, Bank, Receivable, Payable, or Other.',
  'accounts.group': 'Optional parent group for hierarchical reporting. Must match account type.',
  'accounts.openingBalance': 'Opening balance for the selected fiscal year. Positive = Debit, Negative = Credit.',
  'accounts.hierarchy': 'Accounts are organized in a hierarchy: Group → Subgroup → Account. Indentation shows depth.',
  'accounts.import': 'Import accounts from Excel. Supports hierarchy via indented names or parent codes.',
  'accounts.export': 'Export chart of accounts to Excel with formatting and hierarchy preserved.',

  // Account Groups
  'groups.code': 'Unique group code (2-4 digits). Used for hierarchy and sorting.',
  'groups.name': 'Group name for reporting (e.g., Current Assets, Fixed Assets).',
  'groups.type': 'Group type must match the account types it will contain.',
  'groups.parent': 'Parent group for multi-level hierarchy.',

  // Members
  'members.memberId': 'Unique member ID. Auto-generated if left blank.',
  'members.fullName': 'Full name of the member as per official documents.',
  'members.phone': 'Primary phone number (10 digits, starts with 98/97/96).',
  'members.email': 'Email address for notifications and receipts.',
  'members.address': 'Residential address including ward number.',
  'members.ward': 'Ward number within the municipality.',
  'members.bloodGroup': 'Blood group for emergency contact and health camps.',
  'members.membershipType': 'Type of membership determines fee and duration.',
  'members.appliedDate': 'Date when membership application was submitted.',
  'members.photo': 'Optional passport-size photo for ID card.',
  'members.familyDetails': 'Family member details for family memberships.',
  'members.openingBalance': 'Opening balance carried from previous system/year.',

  // Parties (Vendors/Customers)
  'parties.name': 'Party name (company or individual).',
  'parties.type': 'Customer = sells to you, Vendor = buys from you, Both = both.',
  'parties.phone': 'Primary contact phone number.',
  'parties.email': 'Email for invoices and communications.',
  'parties.address': 'Billing/shipping address.',
  'parties.gstNumber': 'GSTIN (15 chars) for GST compliance. Format: 22AAAAA0000A1Z5',
  'parties.panNumber': 'PAN (10 chars) for TDS compliance. Format: AAAAA0000A',
  'parties.contactPerson': 'Primary contact person name.',
  'parties.openingBalance': 'Opening balance (payable/receivable) from previous period.',

  // Items
  'items.code': 'Unique item code. Auto-generated if left blank.',
  'items.name': 'Item/service name as it appears on invoices.',
  'items.description': 'Detailed description for reference.',
  'items.unit': 'Unit of measurement (PCS, KG, MTR, LTR, BOX, PKT).',
  'items.rate': 'Standard selling rate per unit.',
  'items.taxType': 'Taxable = 13% VAT, Exempt = no VAT, Zero-rated = 0% VAT.',
  'items.taxRate': 'Tax percentage (usually 13% for VAT).',
  'items.hsnCode': 'HSN/SAC code for GST returns (8 digits).',

  // Vouchers
  'vouchers.type': 'Voucher type determines accounting entry pattern and numbering series.',
  'vouchers.date': 'Transaction date (BS/AD). Must be within active fiscal year.',
  'vouchers.narration': 'Description of the transaction for audit trail.',
  'vouchers.amount': 'Transaction amount. Debit/Credit determined by voucher type.',
  'vouchers.party': 'Party involved (for sales/purchase/receipt/payment).',
  'vouchers.account': 'Account to debit/credit (for journal/contra).',
  'vouchers.lines': 'Each line = one debit or credit entry. Total Debits must equal Total Credits.',
  'vouchers.post': 'Post to ledger. Posted vouchers cannot be edited (must void and re-enter).',
  'vouchers.void': 'Void cancels the voucher but keeps audit trail.',

  // Journal Entries
  'journal.entryNo': 'Auto-generated journal entry number.',
  'journal.date': 'Entry date within active fiscal year.',
  'journal.narration': 'Reason for the journal entry.',
  'journal.account': 'GL account to debit or credit.',
  'journal.debit': 'Debit amount. Leave blank or 0 for credit entries.',
  'journal.credit': 'Credit amount. Leave blank or 0 for debit entries.',
  'journal.balance': 'Running balance. Must be zero when entry is complete.',

  // Opening Balances
  'opening.fiscalYear': 'Select fiscal year for opening balances.',
  'opening.account': 'Balance sheet account (Asset/Liability/Equity only).',
  'opening.debit': 'Opening debit balance for the account.',
  'opening.credit': 'Opening credit balance for the account.',
  'opening.validate': 'Total Debits must equal Total Credits for balanced opening.',

  // Reports
  'reports.trialBalance': 'Lists all accounts with debit/credit balances. Must net to zero.',
  'reports.profitLoss': 'Income vs Expenses for the period. Shows net profit/loss.',
  'reports.balanceSheet': 'Assets = Liabilities + Equity as of date.',
  'reports.partyStatement': 'All transactions with a specific party. Shows running balance.',
  'reports.dateRange': 'Report date range. Defaults to current fiscal year.',
  'reports.tenant': 'Filter report by tenant (Illaka) or view consolidated.',

  // Fiscal Years
  'fiscalYear.name': 'Fiscal year name (e.g., 2081-82).',
  'fiscalYear.startDate': 'Start date in both BS and AD.',
  'fiscalYear.endDate': 'End date in both BS and AD.',
  'fiscalYear.active': 'Only one fiscal year can be active at a time.',
  'fiscalYear.closed': 'Closed years cannot have new entries.',

  // Settings
  'settings.companyName': 'Organization name for documents and reports.',
  'settings.companyAddress': 'Full address for letterhead.',
  'settings.companyPhone': 'Contact phone for documents.',
  'settings.companyEmail': 'Contact email for documents.',
  'settings.companyPan': 'PAN for tax documents.',
  'settings.vatNumber': 'VAT registration number.',
  'settings.currency': 'Base currency for all transactions.',
  'settings.decimalPlaces': 'Decimal places for amounts (2 for NPR).',
  'settings.nepaliDigits': 'Display numbers in Devanagari (०-९) instead of Arabic (0-9).',
  'settings.fiscalYearStart': 'Month when fiscal year starts (4 = Shrawan).',
  'settings.tooltips': 'Show helpful tooltips on hover/focus. Default: ON.',
  'settings.language': 'Interface language. Data remains unchanged.',

  // Import/Export
  'import.file': 'Select Excel (.xlsx) or CSV file to import.',
  'import.collection': 'Choose which data type to import.',
  'import.mapping': 'Map file columns to system fields. Required fields marked with *.',
  'import.conflicts': 'How to handle duplicate records: Skip, Update, or Append.',
  'import.preview': 'Review validation results before importing. Green=OK, Yellow=Warning, Red=Error.',
  'import.execute': 'Import validated records. Progress shown per record.',
  'export.format': 'Choose export format: Excel (styled), CSV (plain), JSON (structured).',
  'export.dateRange': 'Limit export to specific date range.',
  'export.bsDates': 'Include Bikram Sambat dates alongside Gregorian.',
  'export.nepaliDigits': 'Format numbers with Devanagari digits in export.',
  'export.template': 'Download blank template with example rows and instructions.',

  // Offline/Sync
  'offline.status': 'Current sync status: Online, Offline, Syncing.',
  'offline.pending': 'Number of changes waiting to sync.',
  'offline.lastSync': 'Time of last successful sync.',
  'offline.conflict': 'Conflict detected - choose local or server version.',
  'offline.retry': 'Retry failed sync items.',

  // Membership
  'membership.type': 'Membership type name (Life, Annual, Patron, etc.).',
  'membership.fee': 'Membership fee amount.',
  'membership.duration': 'Duration in months (0 = lifetime).',
  'membership.renewal': 'Renewal date based on applied date + duration.',

  // Payroll
  'payroll.employee': 'Employee linked to payroll.',
  'payroll.basic': 'Basic salary component.',
  'payroll.hra': 'House Rent Allowance.',
  'payroll.da': 'Dearness Allowance.',
  'payroll.pf': 'Provident Fund deduction (10% of basic).',
  'payroll.tds': 'Tax Deducted at Source per slab.',
  'payroll.insurance': 'Insurance premium deduction.',
  'payroll.netPay': 'Gross salary minus all deductions.',

  // Bank Reconciliation
  'bank.statement': 'Upload bank statement (Excel/CSV/PDF).',
  'bank.matching': 'Auto-match by amount, date, and reference.',
  'bank.manualMatch': 'Manually match/unmatch transactions.',
  'bank.reconciled': 'Reconciled transactions show green check.',

  // Accounting Terms
  'terms.debit': 'Debit - increases assets/expenses, decreases liabilities/equity/income.',
  'terms.credit': 'Credit - decreases assets/expenses, increases liabilities/equity/income.',
  'terms.voucher': 'Voucher - official record of a transaction.',
  'terms.account': 'Account - category for financial transactions.',
  'terms.journal': 'Journal - chronological record of daily transactions.',
  'terms.ledger': 'Ledger - collection of account transactions.',
  'terms.trialBalance': 'Trial Balance - list of all account balances.',
  'terms.profitLoss': 'Profit & Loss - income vs expenses for period.',
  'terms.balanceSheet': 'Balance Sheet - financial position at a date.',
}

// Default export for dynamic import
export default tooltipsEn