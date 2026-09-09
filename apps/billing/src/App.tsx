import { useEffect, useState } from 'react'
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowLeftRight,
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
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { authClient, isAdminUser, useOfflineSession } from './lib/auth'
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
import { ReportsHub, SalesReport, PurchaseReport, PartyStatement, LowStockSummary, TaxSales, TaxPurchase, VatRegister, CashStatement, BankStatement, ExpenseCategory, IncomeCategory, StockQuantity, InventoryValuation, BalanceSheet, ProfitLoss } from './pages/reports'
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
import SyncBanner from './components/SyncBanner'
import ConnectingBanner from './components/ConnectingBanner'
import SyncStatus from './components/SyncStatus'
import CommandPalette from './components/CommandPalette'
import IllakaSwitcher from './components/IllakaSwitcher'
import FiscalYearSwitcher from './components/FiscalYearSwitcher'
import Toaster from './components/Toaster'
import Tour from './components/Tour'
import UpdatePrompt from './components/UpdatePrompt'
import ErrorBoundary from './components/ErrorBoundary'
import { TenantProvider } from './lib/tenant'
import { useBackgroundSync } from './lib/BackgroundSync'
import { CalendarProvider } from './lib/calendar'
import { FiscalYearProvider } from './lib/fiscalYear'
import { api } from './lib/api'
import { useDataEpochWatcher } from './lib/dataOps'
import { useSetupStatus } from './lib/setup'
import type { BillingSettings } from './lib/types'
import DataManagement from './pages/DataManagement'
import SetupWizard from './pages/SetupWizard'

type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean; feature?: string; disabled?: boolean }

const navGroups: { title?: string; items: NavItem[] }[] = [
  { items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true }] },
  {
    title: 'Bookkeeping',
    items: [
      { to: '/transaction-entry', label: 'Transaction Entry', icon: FileText },
      { to: '/journal', label: 'Journal', icon: BookOpenText },
      { to: '/transfers', label: 'Transfers', icon: ArrowLeftRight },
      { to: '/posting', label: 'Posting', icon: FileCheck2 },
      { to: '/daybooks', label: 'Daybook', icon: NotebookText },
    ],
  },
  {
    title: 'Operations',
    items: [
      { to: '/parties', label: 'Parties', icon: Users },
      { to: '/members', label: 'Members', icon: Users },
      { to: '/recurring-billing', label: 'Billing', icon: CalendarClock },
      { to: '/expense-claims', label: 'Expenses', icon: Receipt },
      { to: '/inventory', label: 'Inventory', icon: Boxes },
      { to: '/bank-reconciliation', label: 'Bank Management', icon: Landmark, feature: 'bankReconciliationEnabled' },
      { to: '/fixed-assets', label: 'Fixed Assets', icon: Building2, disabled: true },
    ],
  },
{
    title: 'Masters',
    items: [
      { to: '/accounts', label: 'Accounts', icon: FolderTree },
      { to: '/opening-balances', label: 'Opening Balances', icon: Wallet },
      { to: '/membership-types', label: 'Membership Types', icon: Users },
    ],
  },
  {
    title: 'Reports',
    items: [
      { to: '/trial-balance', label: 'Trial Balance', icon: ListChecks },
      { to: '/reports/pnl', label: 'Profit & Loss', icon: BarChart3 },
      { to: '/reports/balance-sheet', label: 'Balance Sheet', icon: Scale },
      { to: '/reports', label: 'Reports', icon: ClipboardList },
    ],
  },
  {
    title: 'Admin',
    items: [
      { to: '/audit', label: 'Audit Log', icon: FileText },
      { to: '/data-management', label: 'Data Management', icon: Database },
      { to: '/approvals', label: 'Approvals', icon: BadgeCheck, disabled: true },
    ],
  },
  {
    title: 'Logs',
    items: [{ to: '/activity', label: 'Recent Activity', icon: History }],
  },
  { items: [{ to: '/settings', label: 'Settings', icon: SettingsIcon }] },
]

export default function App() {
  const { session, checking } = useOfflineSession()

  if (checking) {
    return (
      <div className="grid h-screen place-items-center text-sm text-slate-500">
        Loading…
      </div>
    )
  }

  if (!session) return <Login />

  if (!isAdminUser((session.user as { role?: string }).role)) {
    // Also allow illaka-scoped roles (they have billing access)
    const role = (session.user as { role?: string }).role || ''
    const illakaRoles = ['illaka-chair', 'illaka-treasurer', 'illaka-secretary', 'illaka-accountant', 'illaka-member-officer', 'viewer']
    if (!illakaRoles.includes(role)) {
    return (
      <div className="grid h-screen place-items-center">
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-800">Not authorized</p>
          <p className="mt-1 text-sm text-slate-500">
            You need an admin account to use Billing.
          </p>
          <button
            onClick={() => authClient.signOut()}
            className="mt-4 text-sm text-crimson-600 hover:underline"
          >
            Sign out
          </button>
        </div>
      </div>
    )
    }
  }

  return (
    <TenantProvider>
      <CalendarProvider>
        <FiscalYearProvider>
          <Shell email={session.user.email} />
        </FiscalYearProvider>
      </CalendarProvider>
    </TenantProvider>
  )
}

function Shell({ email }: { email: string }) {
  useBackgroundSync()
  useDataEpochWatcher()
  const navigate = useNavigate()
  // Setup gate — drives the full-page /setup wizard for fresh tenants.
  const setup = useSetupStatus()
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('sidebar-collapsed') === '1',
  )
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
  useEffect(() => {
    setClosedGroups((prev) => {
      const next = { ...prev }
      let changed = false
      for (const group of navGroups) {
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
  }, [location.pathname])
  const [tourOpen, setTourOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [features, setFeatures] = useState<Record<string, boolean>>({})

  // Auto-start the tutorial once per browser. The flag is only written when
  // the tour is dismissed or finished, so the StrictMode remount can't race it.
  useEffect(() => {
    if (localStorage.getItem('tour-seen') !== '1') setTourOpen(true)
  }, [])

  // Load feature toggles from settings — cache-first via localStorage
  // Re-fetch on route change AND when Settings dispatches a change event
  const refreshFeatures = () => {
    api<BillingSettings>('/globals/billing-settings', { query: { depth: 0 } })
      .then((s) => setFeatures({
        bankReconciliationEnabled: !!s.bankReconciliationEnabled,
        demoSeedEnabled: s.demoSeedEnabled !== false,
      }))
      .catch(() => {})
  }
  useEffect(() => { refreshFeatures() }, [location.pathname])
  useEffect(() => {
    window.addEventListener('billing-settings-changed', refreshFeatures)
    return () => window.removeEventListener('billing-settings-changed', refreshFeatures)
  }, [])

  // Fresh (or just-cleaned) books land on the onboarding wizard instead of an
  // empty dashboard. Redirect only when setup is KNOWN incomplete — a loading
  // or in-use status must never bounce the user away.
  useEffect(() => {
    if (
      location.pathname === '/' &&
      !setup.loading &&
      !setup.complete &&
      !setup.inUse
    ) {
      navigate('/setup', { replace: true })
    }
  }, [location.pathname, setup.loading, setup.complete, setup.inUse, navigate])

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
      <aside
        className={`print:hidden flex flex-col bg-slate-900 text-slate-300 transition-[width] duration-200 ${
          collapsed ? 'w-16' : 'w-56'
        }`}
      >
        <div
          className={`flex items-center py-4 ${
            collapsed ? 'justify-center' : 'justify-between px-5'
          }`}
        >
          {!collapsed && (
            <div className="truncate text-lg font-semibold tracking-tight text-white">
              स्यस्यः धुकू
            </div>
          )}
          <button
            onClick={toggleSidebar}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>
        <nav className="flex-1 space-y-4 overflow-y-auto px-2 pb-4">
          {navGroups.map((group) => {
            const items = group.items.filter((item) => {
              if (item.feature && !features[item.feature]) return false
              return true
            })
            if (items.length === 0) return null
            // Titled groups are accordions; title-less groups (Dashboard,
            // Settings) are always shown. In icon-only sidebar mode every
            // section is forced open and headers are hidden.
            const isGroup = !!group.title
            const open =
              collapsed || !isGroup || !closedGroups[group.title as string]
            return (
            <div key={group.items[0].to}>
              {isGroup && !collapsed && (
                <button
                  onClick={() => toggleGroup(group.title as string)}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between gap-1 rounded px-3 pb-1 pt-1 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-300"
                >
                  <span className="truncate">{group.title}</span>
                  <ChevronDown
                    size={12}
                    className={`shrink-0 transition-transform duration-200 ${
                      open ? '' : '-rotate-90'
                    }`}
                  />
                </button>
              )}
              {open && (
                <div
                  className={collapsed ? 'flex flex-col items-center gap-1' : 'space-y-1'}
                >
                  {items.map(({ to, label, icon: Icon, end, disabled }) =>
                  disabled ? (
                    <span
                      key={to}
                      title={collapsed ? `${label} (coming soon)` : 'Coming soon'}
                      className={`flex items-center gap-2 rounded px-3 py-2 text-sm text-slate-600 ${
                        collapsed ? 'justify-center' : ''
                      } cursor-not-allowed select-none opacity-60`}
                    >
                      <Icon size={16} />
                      {!collapsed && (
                        <>
                          <span className="flex-1 truncate">{label}</span>
                          <span className="rounded bg-slate-800 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide text-slate-400">
                            Soon
                          </span>
                        </>
                      )}
                    </span>
                  ) : (
                    <NavLink
                      key={to}
                      to={to}
                      end={end}
                      title={collapsed ? label : undefined}
                      className={({ isActive }) =>
                        `flex items-center gap-2 rounded px-3 py-2 text-sm transition-colors ${
                          collapsed ? 'justify-center' : ''
                        } ${
                          isActive
                            ? 'bg-crimson-600 text-white'
                            : 'hover:bg-crimson-700/70 hover:text-white'
                        }`
                      }
                    >
                      <Icon size={16} />
                      {!collapsed && label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          )})
          }
          <div>
            {!collapsed && (
              <div className="px-3 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Help
              </div>
            )}
            <div
              className={collapsed ? 'flex flex-col items-center gap-1' : 'space-y-1'}
            >
              <button
                onClick={() => setTourOpen(true)}
                title={collapsed ? 'Guide' : undefined}
                className={`flex items-center gap-2 rounded px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-crimson-700/70 hover:text-white ${
                  collapsed ? 'justify-center' : ''
                }`}
              >
                <HelpCircle size={16} />
                {!collapsed && 'Guide'}
              </button>
            </div>
          </div>
        </nav>
      </aside>
      <div className="flex flex-1 flex-col overflow-y-hidden">
        <div className="print:hidden">
          <ConnectingBanner />
          <SyncBanner />
        </div>
        <header className="print:hidden flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
          <div className="text-sm text-slate-500">{email}</div>
          <div className="flex items-center gap-3">
            <IllakaSwitcher />
            <FiscalYearSwitcher />
            <span data-tour="sync">
              <SyncStatus />
            </span>
            <button
              onClick={() => setPaletteOpen(true)}
              title="Search & shortcuts (⌘K)"
              className="flex shrink-0 items-center gap-1.5 rounded border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              <Search size={14} />
              <kbd className="hidden rounded border border-slate-200 bg-slate-50 px-1 py-0.5 text-[10px] text-slate-400 lg:inline">⌘K</kbd>
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6 print:overflow-visible">
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
            <Route path="/opening-balances" element={<SetupOpeningBalances />} />
            <Route path="/transaction-entry" element={<Vouchers />} />
            <Route path="/vouchers" element={<Vouchers />} />
            <Route path="/vouchers/new" element={<VoucherForm mode="create" />} />
            <Route path="/vouchers/new/:docType" element={<VoucherForm mode="create" />} />
            <Route path="/vouchers/edit/:id" element={<VoucherForm mode="edit" />} />
            <Route path="/parties" element={<Parties />} />
            <Route path="/journal" element={<Journal />} />
            <Route path="/trial-balance" element={<TrialBalance />} />
            <Route path="/aging" element={<Aging />} />
            <Route path="/inventory" element={<Items />} />
            <Route path="/reports" element={<ReportsHub />} />
            <Route path="/reports/sales" element={<SalesReport />} />
            <Route path="/reports/purchase" element={<PurchaseReport />} />
            <Route path="/reports/party-statement" element={<PartyStatement />} />
            <Route path="/reports/low-stock" element={<LowStockSummary />} />
            <Route path="/reports/tax-sales" element={<TaxSales />} />
            <Route path="/reports/tax-purchase" element={<TaxPurchase />} />
            <Route path="/reports/vat-register" element={<VatRegister />} />
            <Route path="/reports/cash-statement" element={<CashStatement />} />
            <Route path="/reports/bank-statement" element={<BankStatement />} />
            <Route path="/reports/expense-category" element={<ExpenseCategory />} />
            <Route path="/reports/income-category" element={<IncomeCategory />} />
            <Route path="/reports/stock-quantity" element={<StockQuantity />} />
            <Route path="/reports/inventory-valuation" element={<InventoryValuation />} />
            <Route path="/reports/balance-sheet" element={<BalanceSheet />} />
            <Route path="/reports/pnl" element={<ProfitLoss />} />
            <Route path="/audit" element={<AuditLog />} />
            <Route path="/activity" element={<RecentActivity />} />
            <Route path="/transfers" element={<Transfers />} />
            <Route path="/posting" element={<Posting />} />
            {features.bankReconciliationEnabled && <Route path="/bank-reconciliation" element={<BankReconciliation />} />}
            <Route path="/daybooks" element={<Daybooks />} />
            <Route path="/members" element={<Members />} />
            <Route path="/membership-types" element={<MembershipTypes />} />
            <Route path="/recurring-billing" element={<RecurringBilling />} />
            <Route path="/expense-claims" element={<ExpenseClaims />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/setup" element={<SetupWizard />} />
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
    </div>
  )
}
