import { useEffect, useState } from 'react'
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  BookOpenText,
  Boxes,
  Clock3,
  CreditCard,
  FileText,
  FolderTree,
  HelpCircle,
  LayoutDashboard,
  NotebookText,
  PanelLeftClose,
  Search,
  PanelLeftOpen,
  Scale,
  Settings as SettingsIcon,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { authClient, isAdminUser, useOfflineSession } from './lib/auth'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Accounts from './pages/Accounts'
import Journal from './pages/Journal'
import TrialBalance from './pages/TrialBalance'
import Vouchers from './pages/Vouchers'
import VoucherForm from './pages/VoucherForm'
import Parties from './pages/Parties'
import Aging from './pages/Aging'
import Items from './pages/Items'
import { ReportsHub, SalesReport, PurchaseReport, PartyStatement, LowStockSummary, TaxSales, TaxPurchase, CashStatement, BankStatement, ExpenseCategory, IncomeCategory, StockQuantity, BalanceSheet, ProfitLoss } from './pages/reports'
import Daybooks from './pages/Daybooks'
import BankReconciliation from './pages/BankReconciliation'
import Settings from './pages/Settings'
import AuditLog from './pages/AuditLog'
import Members from './pages/Members'
import MembershipTypes from './pages/MembershipTypes'
import SyncBanner from './components/SyncBanner'
import ConnectingBanner from './components/ConnectingBanner'
import SyncStatus from './components/SyncStatus'
import CommandPalette from './components/CommandPalette'
import IllakaSwitcher from './components/IllakaSwitcher'
import RefreshingBar from './components/RefreshingBar'
import Toaster from './components/Toaster'
import Tour from './components/Tour'
import UpdatePrompt from './components/UpdatePrompt'
import ErrorBoundary from './components/ErrorBoundary'
import { TenantProvider } from './lib/tenant'
import { useBackgroundSync } from './lib/BackgroundSync'
import { CalendarProvider } from './lib/calendar'
import { api } from './lib/api'
import type { BillingSettings } from './lib/types'

type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean }

const navGroups: { title?: string; items: NavItem[] }[] = [
  { items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true }] },
  {
    title: 'Bookkeeping',
    items: [
      { to: '/vouchers', label: 'Vouchers', icon: FileText },
      { to: '/journal', label: 'Journal', icon: BookOpenText },
    ],
  },
  {
    title: 'Masters',
    items: [
      { to: '/accounts', label: 'Accounts', icon: FolderTree },
      { to: '/parties', label: 'Parties', icon: Users },
      { to: '/members', label: 'Members', icon: Users },
      { to: '/membership-types', label: 'Membership Types', icon: Users },
    ],
  },
  {
    title: 'Inventory',
    items: [{ to: '/inventory', label: 'Inventory', icon: Boxes }],
  },
  {
    title: 'Reports',
    items: [
      { to: '/trial-balance', label: 'Trial Balance', icon: Scale },
      { to: '/aging', label: 'Aging', icon: Clock3 },
      { to: '/reports', label: 'Reports', icon: BarChart3 },
      { to: '/daybooks', label: 'Daybooks', icon: NotebookText },
      { to: '/bank-reconciliation', label: 'Bank Reconciliation', icon: CreditCard },
    ],
  },
  {
    title: 'Admin',
    items: [
      { to: '/audit', label: 'Audit Log', icon: FileText },
    ],
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
        <Shell email={session.user.email} />
      </CalendarProvider>
    </TenantProvider>
  )
}

function Shell({ email }: { email: string }) {
  useBackgroundSync()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('sidebar-collapsed') === '1',
  )
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
  const location = useLocation()
  const refreshFeatures = () => {
    api<BillingSettings>('/globals/billing-settings', { query: { depth: 0 } })
      .then((s) => setFeatures({ bankReconciliationEnabled: !!s.bankReconciliationEnabled }))
      .catch(() => {})
  }
  useEffect(() => { refreshFeatures() }, [location.pathname])
  useEffect(() => {
    window.addEventListener('billing-settings-changed', refreshFeatures)
    return () => window.removeEventListener('billing-settings-changed', refreshFeatures)
  }, [])

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
              Syasya Accounting
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
              if (item.to === '/bank-reconciliation' && !features.bankReconciliationEnabled) return false
              return true
            })
            if (items.length === 0) return null
            return (
            <div key={group.items[0].to}>
              {!collapsed && group.title && (
                <div className="px-3 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  {group.title}
                </div>
              )}
              <div
                className={collapsed ? 'flex flex-col items-center gap-1' : 'space-y-1'}
              >
                {items.map(({ to, label, icon: Icon, end }) => (
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
          <RefreshingBar />
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
            <Route path="/reports/cash-statement" element={<CashStatement />} />
            <Route path="/reports/bank-statement" element={<BankStatement />} />
            <Route path="/reports/expense-category" element={<ExpenseCategory />} />
            <Route path="/reports/income-category" element={<IncomeCategory />} />
            <Route path="/reports/stock-quantity" element={<StockQuantity />} />
            <Route path="/reports/balance-sheet" element={<BalanceSheet />} />
            <Route path="/reports/pnl" element={<ProfitLoss />} />
            <Route path="/audit" element={<AuditLog />} />
            {features.bankReconciliationEnabled && <Route path="/bank-reconciliation" element={<BankReconciliation />} />}
            <Route path="/daybooks" element={<Daybooks />} />
            <Route path="/members" element={<Members />} />
            <Route path="/membership-types" element={<MembershipTypes />} />
            <Route path="/settings" element={<Settings />} />
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
