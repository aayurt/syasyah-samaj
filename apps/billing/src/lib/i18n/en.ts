/**
 * English dictionary for the billing SPA — shell + common strings only.
 * Page-level translation is M5.
 *
 * Structure: nested objects grouped by namespace (nav, common, status, …).
 * Keys are accessed as dict.nav.dashboard, dict.common.save, etc.
 */

export const en = {
  // ── Shell / nav ──
  nav: {
    dashboard: 'Dashboard',
    bookkeeping: 'Bookkeeping',
    transactionEntry: 'Transaction Entry',
    journal: 'Journal',
    transfers: 'Transfers',
    posting: 'Posting',
    daybook: 'Daybook',
    operations: 'Operations',
    parties: 'Parties',
    members: 'Members',
    recurringBilling: 'Billing',
    expenseClaims: 'Expenses',
    inventory: 'Inventory',
    bankReconciliation: 'Bank Management',
    fixedAssets: 'Fixed Assets',
    masters: 'Masters',
    accounts: 'Accounts',
    openingBalances: 'Opening Balances',
    membershipTypes: 'Membership Types',
    reports: 'Reports',
    trialBalance: 'Trial Balance',
    profitLoss: 'Profit & Loss',
    balanceSheet: 'Balance Sheet',
    reportsHub: 'Reports',
    admin: 'Admin',
    auditLog: 'Audit Log',
    dataManagement: 'Data Management',
    approvals: 'Approvals',
    logs: 'Logs',
    recentActivity: 'Recent Activity',
    settings: 'Settings',
    help: 'Help',
    guide: 'Guide',
  },

  // ── Header / chrome ──
  header: {
    email: 'Signed in as',
    search: 'Search & shortcuts',
    sync: 'Sync',
  },
  sidebar: {
    orgName: 'स्यस्यः धुकू',
    collapse: 'Collapse sidebar',
    expand: 'Expand sidebar',
  },

  // ── Common actions ──
  common: {
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    add: 'Add',
    search: 'Search',
    close: 'Close',
    confirm: 'Confirm',
    refresh: 'Refresh',
    print: 'Print',
    export: 'Export',
    back: 'Back',
    next: 'Next',
    done: 'Done',
    view: 'View',
    filter: 'Filter',
    clear: 'Clear',
    selectAll: 'Select all',
    deselectAll: 'Deselect all',
  },

  // ── Status chips ──
  status: {
    draft: 'Draft',
    posted: 'Posted',
    void: 'Void',
    paid: 'Paid',
    unpaid: 'Unpaid',
    partial: 'Partially Paid',
    outstanding: 'Outstanding',
    active: 'Active',
    closed: 'Closed',
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
  },

  // ── Toast kinds ──
  toast: {
    success: 'Success',
    error: 'Error',
    warning: 'Warning',
    info: 'Info',
  },

  // ── Calendar / date ──
  cal: {
    calendar: 'Calendar',
    type: 'Calendar type',
    dateFormat: 'Date Format',
    timeFormat: 'Time Format',
    ad: 'AD',
    bs: 'BS',
    h12: '12-hour',
    h24: '24-hour',
    preview: 'Preview',
  },

  // ── Empty states ──
  empty: {
    noData: 'No data yet',
    noFiscalYears: 'No fiscal years defined. Click Add Year to create the first period.',
    noSeries: 'No number series defined yet. Click Add Series to create one.',
    noAccounts: 'No accounts yet. Add your first account above.',
    noTransactions: 'No transactions yet.',
    loading: 'Loading…',
  },

  // ── Buttons inside modals ──
  modal: {
    create: 'Create',
    update: 'Update',
    saveChanges: 'Save Changes',
    createYear: 'Create Year',
    addSeries: 'Add Series',
    editSeries: 'Edit Series',
    addAccount: 'New Account',
    duplicate: 'Duplicate',
  },

  // ── Confirmation ──
  confirm: {
    deleteSeries: 'Delete series',
    deleteAccount: 'Delete this account?',
    resetSeries: 'Reset {key} to {value}? The next transaction will use {next}.',
    closeYear: 'Close Fiscal Year',
    openYear: 'Open Fiscal Year',
    setWorking: 'Set as Working Year',
    closeYearLabel: 'Close Year',
    openYearLabel: 'Open Year',
    setWorkingLabel: 'Set as Working Year',
  },

  // ── Messages ──
  msg: {
    saved: '✓ Saved',
    unsaved: 'Unsaved changes',
    saving: 'Saving…',
    loading: 'Loading…',
    missingDocType: 'Missing doc type',
    missingDocTypeDetail: 'Select a document type for the series.',
    seriesCreated: 'Series created',
    seriesUpdated: 'Series updated',
    seriesDeleted: 'Series deleted',
    cannotDeleteSeries: 'Cannot delete',
    cannotDeleteSeriesDetail: 'Documents already posted using this series.',
    failedToCreate: 'Failed to create',
    failedToUpdate: 'Failed to update',
    failedToDelete: 'Failed to delete',
    failedToSave: 'Failed to save',
    failedToLoad: 'Failed to load',
    setWorkingYear: 'Working year set',
    setWorkingYearDetail: '{label} is now the active fiscal year.',
    yearClosed: 'Fiscal year closed',
    yearClosedDetail: '{label} — entries are now read-only.',
    yearOpened: 'Fiscal year opened',
    yearOpenedDetail: '{label} — entries are editable again.',
    missingDates: 'Missing dates',
    missingDatesDetail: 'Both start and end date are required.',
    cannotSetWorking: 'Cannot set working year',
    cannotSetWorkingDetail: '{label} is closed. Only an open fiscal year can be the working year — reopen it first.',
  },

  // ── Settings card titles ──
  settings: {
    calendar: 'Calendar',
    companyProfile: 'Company Profile',
    fiscalSettings: 'Fiscal Settings',
    featureToggles: 'Feature Toggles',
    defaultAccounts: 'Default Accounts',
    chartOfAccounts: 'Chart of Accounts',
    numberSeries: 'Number Series',
    language: 'Language / भाषा',
    account: 'Account',
  },

  // ── Language card ──
  lang: {
    title: 'Language / भाषा',
    subtitle: 'Choose the interface language',
    english: 'English',
    nepali: 'नेपाली',
    current: 'Current',
  },

  // ── Section subtitles / hints ──
  hint: {
    company: 'Set name, PAN, contact — shown on invoices',
    dragReorder: 'Drag to reorder',
    dragReorderDetail: 'These defaults are used when posting transactions. Missing accounts block posting until configured. Drag rows to reorder posting roles.',
    fiscalYears: 'Active years are editable · Closed years are read-only · The working year drives transaction numbering.',
    selectFy: 'Selecting a fiscal year in the header filters the transactions, journal and reports to that period. Entries dated inside a closed year are rejected on the server.',
    series: 'Series determine document numbers like {example} → {result}. FY-scoped series reset each fiscal year. Series with posted documents cannot be deleted.',
    seriesExample: 'Sales Invoice',
    seriesResult: 'SI-2083-84-0001',
    bankRec: 'Enabled — visible in sidebar',
    bankRecOff: 'Disabled — hidden from sidebar',
    simplifiedInvOn: 'Shows VAT-inclusive for totals under Rs.',
    simplifiedInvOff: 'Always show full tax breakdown',
    demoSeedOn: 'Enabled — Setup wizard & Data Management can add demo data',
    demoSeedOff: 'Disabled — demo data seeding is rejected',
    fyStatusActive: 'Active',
    fyStatusClosed: 'Closed',
    setWorking: 'Set as working year',
    showTutorial: 'Show Tutorial',
    signOut: 'Sign Out',
  },
} as const

export type EnNamespace = keyof typeof en
export type EnKey<N extends EnNamespace> = keyof typeof en[N]
