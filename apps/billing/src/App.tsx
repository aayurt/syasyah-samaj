import { useEffect, useState } from 'react'
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { AnimatedSidebar } from './components/ui/AnimatedSidebar'
import { Breadcrumbs } from './components/ui/Breadcrumbs'
import {
  ArrowLeftRight,
  Banknote,
  BarChart3,
  BookOpenText,
  Boxes,
  BadgeCheck,
  Building2,
  CalendarClock,
  Database,
  ClipboardList,
  FileCheck2,
  FileText,
  FolderTree,
  ChevronDown,
  HelpCircle,
  History,
  Landmark,
  LayoutDashboard,
  ListChecks,
  NotebookText,
  PanelLeftClose,
  Receipt,
  Search,
  PanelLeftOpen,
  Scale,
  Settings as SettingsIcon,
  Sparkles,
  Users,
  Wallet,
  RefreshCw,
  AlertCircle,
  CircleAlert,
  ArrowRight,
  Clock,
  Heart,
  type LucideIcon,
} from 'lucide-react'
import { authClient, canAccessBilling, useOfflineSession } from './lib/auth'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Accounts from './pages/Accounts'
import SetupOpeningBalances from './pages/SetupOpeningBalances'
import Journal from './pages/Journal'
import TrialBalance from './pages/TrialBalance'
import Vouchers from './pages/Vouchers'
import Posting from './pages/Posting'
import VoucherForm from './pages/VoucherForm'
import Parties from './pages/Parties'
import Aging from './pages/Aging'
import Items from './pages/Items'
import { ReportsHub, SalesReport, PurchaseReport, PartyStatement, LowStockSummary, TaxSales, TaxPurchase, VatRegister, CashStatement, BankStatement, ExpenseCategory, IncomeCategory, StockQuantity, InventoryValuation, BalanceSheet, ProfitLoss, GeneralLedger, CashFlowStatement, Receivables, Payables, TransactionHealth, TaxSummary, TaxReconciliation, TaxableSalesPerCustomer, TaxablePurchasesPerSupplier, FixedAssetSummary, DepreciationSchedule, MembershipFeeCollection, DonationSummary } from './pages/reports'
import Daybooks from './pages/Daybooks'
import BankReconciliation from './pages/BankReconciliation'
import Settings from './pages/Settings'
import RecentActivity from './pages/RecentActivity'
import AuditLog from './pages/AuditLog'
import Transfers from './pages/Transfers'
import Members from './pages/Members'
import MembershipTypes from './pages/MembershipTypes'
import RecurringBilling from './pages/RecurringBilling'
import ExpenseClaims from './pages/ExpenseClaims'
import FixedAssets from './pages/FixedAssets'
import Payroll from './pages/Payroll'
import PayrollRegisters from './pages/PayrollRegisters'
import PayrollSettingsPage from './pages/PayrollSettingsPage'
import PayrollGroups from './pages/PayrollGroups'
import PayrollSettings from './pages/PayrollSettings'
import PayrollBatch from './pages/PayrollBatch'
import PayrollReports from './pages/PayrollReports'
import ConnectingBanner from './components/ConnectingBanner'
import SyncStatus from './components/SyncStatus'
import CommandPalette from './components/CommandPalette'
import FiscalYearSwitcher from './components/FiscalYearSwitcher'
import IllakaSwitcher from './components/IllakaSwitcher'
import LanguageSwitcher from './components/LanguageSwitcher'
import Toaster from './components/Toaster'
import Tour from './components/Tour'
import UpdatePrompt from './components/UpdatePrompt'
import ErrorBoundary from './components/ErrorBoundary'
import { TenantProvider } from './lib/tenant'
import { useBackgroundSync } from './lib/BackgroundSync'
import { CalendarProvider } from './lib/calendar'
import { FiscalYearProvider } from './lib/fiscalYear'
import { TooltipsProvider } from './hooks/useTooltips'
import { LangProvider, useT } from './lib/i18n'
import { api } from './lib/api'
import { useDataEpochWatcher } from './lib/dataOps'
import { useSetupStatus, SETUP_STEPS } from './lib/setup'
import { usePrewarmMasters } from './lib/prewarm'
import type { BillingSettings } from './lib/types'
import DataManagement from './pages/DataManagement'
import SetupWizard from './pages/SetupWizard'
import AIPage from './pages/AI'

type NavItem = { to: string; label: string; labelKey?: string; icon: LucideIcon; end?: boolean; feature?: string; disabled?: boolean }

const navGroups: { title?: string; titleKey?: string; items: NavItem[] }[] = [
  { items: [{ to: '/', label: 'Dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard, end: true }] },
  {
    title: 'Bookkeeping',
    titleKey: 'nav.bookkeeping',
    items: [
      { to: '/vouchers/new/journal-voucher', label: 'All Transactions', labelKey: 'nav.allTransactions', icon: FileText },
      { to: '/transfers', label: 'Transfers', labelKey: 'nav.transfers', icon: ArrowLeftRight },
      { to: '/posting', label: 'Posting', labelKey: 'nav.posting', icon: FileCheck2 },
      { to: '/daybooks', label: 'Daybook', labelKey: 'nav.daybook', icon: NotebookText },
    ],
  },
  {
    title: 'Operations',
    titleKey: 'nav.operations',
    items: [
      { to: '/parties', label: 'Parties', labelKey: 'nav.parties', icon: Users },
      { to: '/members', label: 'Members', labelKey: 'nav.members', icon: Users },
      { to: '/recurring-billing', label: 'Billing', labelKey: 'nav.recurringBilling', icon: CalendarClock },
      { to: '/expense-claims', label: 'Expenses', labelKey: 'nav.expenseClaims', icon: Receipt },
      { to: '/inventory', label: 'Inventory', labelKey: 'nav.inventory', icon: Boxes },
      { to: '/bank-reconciliation', label: 'Bank Management', labelKey: 'nav.bankReconciliation', icon: Landmark, feature: 'bankReconciliationEnabled' },
      { to: '/fixed-assets', label: 'Fixed Assets', labelKey: 'nav.fixedAssets', icon: Building2 },
      { to: '/reports/fixed-asset-summary', label: 'Fixed Asset Summary', labelKey: 'nav.fixedAssetSummary', icon: Building2 },
      { to: '/reports/depreciation-schedule', label: 'Depreciation Schedule', labelKey: 'nav.depreciationSchedule', icon: Clock },
      { to: '/reports/membership-fee-collection', label: 'Membership Fee Collection', labelKey: 'nav.membershipFeeCollection', icon: Users },
      { to: '/reports/donation-summary', label: 'Donation Summary', labelKey: 'nav.donationSummary', icon: Heart },
    ],
  },
  {
    title: 'Masters',
    titleKey: 'nav.masters',
    items: [
      { to: '/accounts', label: 'Accounts', labelKey: 'nav.accounts', icon: FolderTree },
      { to: '/opening-balances', label: 'Opening Balances', labelKey: 'nav.openingBalances', icon: Wallet },
      { to: '/membership-types', label: 'Membership Types', labelKey: 'nav.membershipTypes', icon: Users },
    ],
  },
  {
    title: 'Reports',
    titleKey: 'nav.reports',
    items: [
      { to: '/trial-balance', label: 'Trial Balance', labelKey: 'nav.trialBalance', icon: ListChecks },
      { to: '/reports/pnl', label: 'Profit & Loss', labelKey: 'nav.profitLoss', icon: BarChart3 },
      { to: '/reports/balance-sheet', label: 'Balance Sheet', labelKey: 'nav.balanceSheet', icon: Scale },
      { to: '/reports', label: 'Reports', labelKey: 'nav.reportsHub', icon: ClipboardList, end: true },
    ],
  },
  {
    title: 'Admin',
    titleKey: 'nav.admin',
    items: [
      { to: '/audit', label: 'Audit Log', labelKey: 'nav.auditLog', icon: FileText },
      { to: '/data-management', label: 'Data Management', labelKey: 'nav.dataManagement', icon: Database },
      { to: '/approvals', label: 'Approvals', labelKey: 'nav.approvals', icon: BadgeCheck, disabled: true },
      { to: '/ai', label: 'AI Import', labelKey: 'nav.ai', icon: Sparkles },
    ],
  },
  {
    title: 'Logs',
    titleKey: 'nav.logs',
    items: [{ to: '/activity', label: 'Recent Activity', labelKey: 'nav.recentActivity', icon: History }],
  },
  { items: [{ to: '/settings', label: 'Settings', labelKey: 'nav.settings', icon: SettingsIcon }] }
  // Payroll System removed — payroll is now a standalone module; no header or sidebar tab.
]

/**
 * Payroll system nav — rendered instead of the accounting nav on /payroll
 * routes, mirroring how frappe separates India Payroll from ERPNext: the
 * statutory workspace has its own navigation and a switch back to the
 * accounting books.
 */
const payrollNavGroups: { title?: string; titleKey?: string; items: NavItem[] }[] = [
  { items: [{ to: '/payroll', label: 'Payroll Runs', labelKey: 'nav.payrollRuns', icon: Banknote, end: true }] },
  {
    title: 'Payroll',
    titleKey: 'nav.payroll',
    items: [
      { to: '/payroll', label: 'Payroll Runs', labelKey: 'nav.payrollRuns', icon: Banknote, end: true },
      { to: '/payroll/groups', label: 'Payroll Groups', labelKey: 'nav.payrollGroups', icon: RefreshCw },
      { to: '/payroll/batch', label: 'Payroll Batch', labelKey: 'nav.payrollBatch', icon: Banknote },
      { to: '/payroll/employees', label: 'Employees', labelKey: 'nav.employees', icon: Users },
      { to: '/payroll/registers', label: 'Statutory Registers', labelKey: 'nav.statutoryRegisters', icon: ClipboardList },
      { to: '/payroll/reports', label: 'Payroll Reports', labelKey: 'nav.payrollReports', icon: FileText },
      { to: '/payroll/settings', label: 'Payroll Settings', labelKey: 'nav.payrollSettings', icon: SettingsIcon },
    ],
  },
  { items: [{ to: '/', label: 'Switch to Accounting', labelKey: 'nav.switchToAccounting', icon: ArrowLeftRight, end: true }] },
]

export default function App() {
  return (
    <LangProvider>
      <AppShell />
    </LangProvider>
  )
}

function AppShell() {
  const { session, checking } = useOfflineSession()
  const t = useT()

  if (checking) {
    return (
      <div className="grid h-screen place-items-center text-sm text-slate-500">
        {t('login.loading', 'Loading…')}
      </div>
    )
  }

  if (!session) return <Login />

  if (!canAccessBilling((session.user as { role?: string }).role)) {
    return (
      <div className="grid h-screen place-items-center">
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-800">{t('login.notAuthorized', 'Not authorized')}</p>
          <p className="mt-1 text-sm text-slate-500">
            {t('login.needAdmin', 'You need an admin account to use Billing.')}
          </p>
          <button
            onClick={() => authClient.signOut()}
            className="mt-4 text-sm text-crimson-600 hover:underline"
          >
            {t('login.signOut', 'Sign out')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <TooltipsProvider>
      <TenantProvider>
        <CalendarProvider>
          <FiscalYearProvider>
            <Shell email={session.user.email} />
          </FiscalYearProvider>
        </CalendarProvider>
      </TenantProvider>
    </TooltipsProvider>
  )
}

function Shell({ email }: { email: string }) {
  console.log('[Shell] render')
  useBackgroundSync()
  useDataEpochWatcher()
  // Pre-warm the offline masters cache (members, accounts, fiscal years,
  // settings) right after login so dropdowns/autocomplete are instant even
  // when the device goes offline at a remote event.
  usePrewarmMasters()
  const navigate = useNavigate()
  const t = useT()
  // Setup gate — drives the full-page /setup wizard for fresh tenants.
  const setup = useSetupStatus()
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('sidebar-collapsed') === '1',
  )
  // Mobile sidebar is off-canvas overlay: visible by default on small screens,
  // slides out to reveal full content. On mobile the sidebar always shows icon
  // + text (never collapsed/icon-only) since a label-less icon sidebar is
  // unusable on small screens.
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(true)
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' && window.innerWidth < 768,
  )
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  // Per-section accordion state for the sidebar nav (persisted). Keyed by
  // group title; missing/unknown keys default to open.
  const [closedGroups, setClosedGroups] = useState<Record<string, boolean>>(
    () => {
      try {
        return JSON.parse(localStorage.getItem('sidebar-closed-groups') || '{}')
      } catch {
        return {}
      }
    },
  )
  const toggleGroup = (title: string) => {
    setClosedGroups((prev) => {
      const next = { ...prev, [title]: !prev[title] }
      localStorage.setItem('sidebar-closed-groups', JSON.stringify(next))
      return next
    })
  }
  // Auto-expand the section containing the active page when navigation moves
  // into it (e.g. via the command palette or a report link), so the active
  // item is never hidden behind a closed section.
  const location = useLocation()
  // The Payroll system (india-payroll) is a separate workspace: on
  // /payroll routes the accounting nav is replaced by the payroll nav and
  // the header carries the system switcher.
  const inPayroll = location.pathname.startsWith('/payroll')
  const activeNavGroups = inPayroll ? payrollNavGroups : navGroups
  // Close the mobile sidebar when navigating to a new page.
  useEffect(() => {
    setMobileSidebarOpen(false)
  }, [location.pathname])
  useEffect(() => {
    setClosedGroups((prev) => {
      const next = { ...prev }
      let changed = false
      for (const group of activeNavGroups) {
        if (!group.title) continue
        const inside = group.items.some((i) =>
          i.end
            ? location.pathname === i.to
            : location.pathname === i.to ||
            location.pathname.startsWith(i.to + '/'),
        )
        if (inside && next[group.title]) {
          next[group.title] = false
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [location.pathname]) // eslint-disable-line react-hooks/exhaustive-deps
  const [tourOpen, setTourOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [setupModalOpen, setSetupModalOpen] = useState(false)
  const [features, setFeatures] = useState<Record<string, boolean>>({})
  const [companyName, setCompanyName] = useState<string>('')

  // Auto-start the tutorial once per browser. The flag is only written when
  // the tour is dismissed or finished, so the StrictMode remount can't race it.
  useEffect(() => {
    if (localStorage.getItem('tour-seen') !== '1') setTourOpen(true)
  }, [])

  // Load feature toggles from settings — cache-first via localStorage
  // Re-fetch on route change AND when Settings dispatches a change event
  const refreshFeatures = () => {
    console.log('[App] refreshFeatures called')
    api<BillingSettings>('/globals/billing-settings', { query: { depth: 0 } })
      .then((s) => {
        setFeatures({
          payrollEnabled: s.payrollEnabled !== false,
          bankReconciliationEnabled: !!s.bankReconciliationEnabled,
          demoSeedEnabled: s.demoSeedEnabled !== false,
        })
        setCompanyName(s.companyName || '')
      })
      .catch(() => { })
  }
  useEffect(() => { refreshFeatures() }, [location.pathname])
  useEffect(() => {
    window.addEventListener('billing-settings-changed', refreshFeatures)
    return () => window.removeEventListener('billing-settings-changed', refreshFeatures)
  }, [])

  // Fresh (or just-cleaned) books land on the onboarding wizard instead of an
  // empty dashboard. When setup is KNOWN incomplete, show a modal telling the
  // user exactly which step is missing instead of a silent redirect — a
  // loading or in-use status must never bounce the user away (existing books
  // stay usable; only fresh tenants are compelled).
  useEffect(() => {
    if (
      setup.loading ||
      setup.complete ||
      setup.inUse ||
      location.pathname === '/setup' ||
      location.pathname.startsWith('/payroll')
    ) return
    setSetupModalOpen(true)
  }, [location.pathname, setup.loading, setup.complete, setup.inUse])

  const goToSetup = () => {
    setSetupModalOpen(false)
    navigate('/setup', { replace: true })
  }

  const closeTour = () => {
    localStorage.setItem('tour-seen', '1')
    setTourOpen(false)
  }

  const toggleSidebar = () => {
    setCollapsed((c) => {
      localStorage.setItem('sidebar-collapsed', c ? '0' : '1')
      return !c
    })
  }

  // Cmd+K / Ctrl+K to open command palette
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="flex h-screen bg-slate-100">
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      {/* Sidebar: fixed on desktop, expanded overlay on mobile. */}
      <AnimatedSidebar
        collapsed={collapsed && !isMobile}
        onToggle={toggleSidebar}
        navGroups={activeNavGroups}
        features={features}
        closedGroups={closedGroups}
        onToggleGroup={toggleGroup}
        t={t}
        userEmail={email}
        isMobile={isMobile}
        className={`
          relative z-20
          ${isMobile
            ? '!fixed inset-y-0 left-0 w-[280px] h-screen shadow-2xl' + (mobileSidebarOpen ? ' translate-x-0' : ' translate-x-[-100%]') + ' transition duration-300 ease-in-out'
            : ''
          }
        `}
        open={mobileSidebarOpen}
        onOpenChange={setMobileSidebarOpen}
      />
      {/* Mobile sidebar backdrop */}
      {isMobile && mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-10 bg-black/40 backdrop-blur-sm"
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      <div className="flex flex-1 flex-col overflow-y-hidden">
        <div className="print:hidden">
          <ConnectingBanner />
        </div>
        <header className="print:hidden flex flex-wrap items-center justify-between border-b border-slate-200 bg-white px-3 py-2 md:px-6 md:py-2.5 gap-2">
          <div className="flex items-center gap-3">
            {/* Mobile hamburger — opens the off-canvas sidebar. */}
            <button
              onClick={() => setMobileSidebarOpen((o) => !o)}
              aria-label={mobileSidebarOpen ? t('sidebar.collapse', 'Collapse sidebar') : t('sidebar.expand', 'Expand sidebar')}
              className="md:hidden flex items-center gap-1.5 rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            >
              {mobileSidebarOpen ? <PanelLeftClose size={18} className="text-slate-900" /> : <PanelLeftOpen size={18} className="text-slate-900" />}
            </button>
            <Breadcrumbs />
            {companyName && (
              <span className="hidden md:block flex-1 max-w-[260px] truncate text-sm font-semibold text-slate-900 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200/60 ml-4">
                {companyName}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 md:gap-3">
            <IllakaSwitcher />
            <FiscalYearSwitcher />
            <LanguageSwitcher />
            <span data-tour="sync">
              <SyncStatus />
            </span>
            <button
              onClick={() => setPaletteOpen(true)}
              title={`${t('header.search', 'Search & shortcuts')} (⌘K)`}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100 transition-colors shadow-2xs"
            >
              <Search size={13} className="text-slate-400" />
              <kbd className="hidden rounded border border-slate-200 bg-white px-1 py-0.2 text-[9px] font-mono text-slate-400 lg:inline">⌘K</kbd>
            </button>
          </div>
        </header>
        {/* Full-width responsive content container. Pages expand to fill; on mobile
           the sidebar overlays so content remains usable and full-width. */}
        <main className="flex-1 overflow-auto overscroll-y-contain w-full print:overflow-visible p-4">
          <Routes>
            <Route
              path="/vouchers"
              element={
                <ErrorBoundary>
                  <Vouchers />
                </ErrorBoundary>
              }
            />
            <Route path="/" element={<Dashboard />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/opening-balances" element={<ErrorBoundary><SetupOpeningBalances /></ErrorBoundary>} />
            <Route path="/transaction-entry" element={<Navigate to="/vouchers/new/journal-voucher" replace />} />
            <Route path="/vouchers" element={<Vouchers />} />
            <Route path="/vouchers/new/:docType?" element={<VoucherForm mode="create" />} />
            <Route path="/vouchers/edit/:id" element={<ErrorBoundary><VoucherForm mode="edit" /></ErrorBoundary>} />
            <Route path="/parties" element={<Parties />} />
            <Route path="/journal" element={<Journal />} />
            <Route path="/trial-balance" element={<ErrorBoundary><TrialBalance /></ErrorBoundary>} />
            <Route path="/aging" element={<ErrorBoundary><Aging /></ErrorBoundary>} />
            <Route path="/inventory" element={<Items />} />
            <Route path="/reports" element={<ReportsHub />} />
            <Route path="/reports/sales" element={<ErrorBoundary><SalesReport /></ErrorBoundary>} />
            <Route path="/reports/purchase" element={<ErrorBoundary><PurchaseReport /></ErrorBoundary>} />
            <Route path="/reports/party-statement" element={<ErrorBoundary><PartyStatement /></ErrorBoundary>} />
            <Route path="/reports/low-stock" element={<LowStockSummary />} />
            <Route path="/reports/tax-sales" element={<ErrorBoundary><TaxSales /></ErrorBoundary>} />
            <Route path="/reports/tax-purchase" element={<ErrorBoundary><TaxPurchase /></ErrorBoundary>} />
            <Route path="/reports/vat-register" element={<ErrorBoundary><VatRegister /></ErrorBoundary>} />
            <Route path="/reports/cash-statement" element={<ErrorBoundary><CashStatement /></ErrorBoundary>} />
            <Route path="/reports/bank-statement" element={<ErrorBoundary><BankStatement /></ErrorBoundary>} />
            <Route path="/reports/expense-category" element={<ErrorBoundary><ExpenseCategory /></ErrorBoundary>} />
            <Route path="/reports/income-category" element={<ErrorBoundary><IncomeCategory /></ErrorBoundary>} />
            <Route path="/reports/stock-quantity" element={<ErrorBoundary><StockQuantity /></ErrorBoundary>} />
            <Route path="/reports/inventory-valuation" element={<ErrorBoundary><InventoryValuation /></ErrorBoundary>} />
            <Route path="/reports/balance-sheet" element={<ErrorBoundary><BalanceSheet /></ErrorBoundary>} />
            <Route path="/reports/pnl" element={<ErrorBoundary><ProfitLoss /></ErrorBoundary>} />
            <Route path="/reports/general-ledger" element={<ErrorBoundary><GeneralLedger /></ErrorBoundary>} />
            <Route path="/reports/cash-flow" element={<ErrorBoundary><CashFlowStatement /></ErrorBoundary>} />
            <Route path="/reports/receivables" element={<ErrorBoundary><Receivables /></ErrorBoundary>} />
            <Route path="/reports/payables" element={<ErrorBoundary><Payables /></ErrorBoundary>} />
            <Route path="/reports/transaction-health" element={<ErrorBoundary><TransactionHealth /></ErrorBoundary>} />
            <Route path="/reports/tax-summary" element={<ErrorBoundary><TaxSummary /></ErrorBoundary>} />
            <Route path="/reports/tax-reconciliation" element={<ErrorBoundary><TaxReconciliation /></ErrorBoundary>} />
            <Route path="/reports/taxable-sales-customer" element={<ErrorBoundary><TaxableSalesPerCustomer /></ErrorBoundary>} />
            <Route path="/reports/taxable-purchases-supplier" element={<ErrorBoundary><TaxablePurchasesPerSupplier /></ErrorBoundary>} />
            <Route path="/reports/fixed-asset-summary" element={<ErrorBoundary><FixedAssetSummary /></ErrorBoundary>} />
            <Route path="/reports/depreciation-schedule" element={<ErrorBoundary><DepreciationSchedule /></ErrorBoundary>} />
            <Route path="/reports/membership-fee-collection" element={<ErrorBoundary><MembershipFeeCollection /></ErrorBoundary>} />
            <Route path="/reports/donation-summary" element={<ErrorBoundary><DonationSummary /></ErrorBoundary>} />
            <Route path="/audit" element={<ErrorBoundary><AuditLog /></ErrorBoundary>} />
            <Route path="/activity" element={<RecentActivity />} />
            <Route path="/transfers" element={<Transfers />} />
            <Route path="/posting" element={<Posting />} />
            {features.bankReconciliationEnabled && <Route path="/bank-reconciliation" element={<ErrorBoundary><BankReconciliation /></ErrorBoundary>} />}
            <Route path="/daybooks" element={<ErrorBoundary><Daybooks /></ErrorBoundary>} />
            <Route path="/fixed-assets" element={<FixedAssets />} />
            <Route path="/members" element={<Members />} />
            <Route path="/membership-types" element={<MembershipTypes />} />
            <Route path="/recurring-billing" element={<RecurringBilling />} />
            <Route path="/expense-claims" element={<ExpenseClaims />} />
            <Route path="/payroll" element={<Payroll />} />
            <Route path="/payroll/employees" element={<Payroll initialTab="employees" />} />
            <Route path="/payroll/groups" element={<PayrollGroups />} />
            <Route path="/payroll/batch" element={<PayrollBatch />} />
            <Route path="/payroll/settings" element={<PayrollSettings />} />
            <Route path="/payroll/reports" element={<PayrollReports />} />
            <Route path="/payroll/registers" element={<PayrollRegisters />} />
            <Route path="/payroll/settings" element={<PayrollSettingsPage />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/settings/:section" element={<Settings />} />
            <Route path="/setup" element={<SetupWizard />} />
            <Route path="/ai" element={<AIPage />} />
            <Route path="/data-management" element={<DataManagement />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
      {tourOpen && (
        <div className="print:hidden">
          <Tour open={tourOpen} onClose={closeTour} />
        </div>
      )}
      <div className="print:hidden">
        <UpdatePrompt />
      </div>
      <Toaster />
      {setupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6">
            <div className="flex items-start gap-3">
              <AlertCircle size={28} className="text-amber-600 shrink-0" />
              <div className="flex-1">
                <h2 className="text-lg font-bold text-slate-900">
                  Setup incomplete
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Your books need one more step before you can post vouchers
                  and run reports:
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {SETUP_STEPS
                .filter((s) => {
                  const v = setup[s.key]
                  return v === false
                })
                .map((s) => (
                  <div
                    key={s.key}
                    className="flex items-center gap-3 rounded-lg border border-amber-100 bg-amber-50 p-3"
                  >
                    <CircleAlert size={16} className="text-amber-500 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-800">
                        {s.label}
                      </p>
                      <p className="text-xs text-amber-600">
                        Go to {s.to}
                      </p>
                    </div>
                  </div>
                ))}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setSetupModalOpen(false)}
                className="flex items-center gap-2 rounded bg-white px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 shadow-sm hover:bg-slate-50"
              >
                Not now
              </button>
              <button
                onClick={goToSetup}
                className="flex items-center gap-2 rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Go to setup <ArrowRight size={15} className="ml-1" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
