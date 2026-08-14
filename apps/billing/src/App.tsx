import { useEffect, useState } from 'react'
import { Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  BookOpenText,
  Boxes,
  Clock3,
  FileText,
  FolderTree,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  NotebookText,
  PanelLeftClose,
  PanelLeftOpen,
  Scale,
  Settings as SettingsIcon,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { authClient, clearCachedSession, isAdminUser, useOfflineSession } from './lib/auth'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Accounts from './pages/Accounts'
import Journal from './pages/Journal'
import TrialBalance from './pages/TrialBalance'
import Vouchers from './pages/Vouchers'
import Parties from './pages/Parties'
import Aging from './pages/Aging'
import Items from './pages/Items'
import Reports from './pages/Reports'
import Daybooks from './pages/Daybooks'
import Settings from './pages/Settings'
import SyncBanner from './components/SyncBanner'
import SyncStatus from './components/SyncStatus'
import Tour from './components/Tour'

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

  return <Shell email={session.user.email} />
}

function Shell({ email }: { email: string }) {
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('sidebar-collapsed') === '1',
  )
  const [tourOpen, setTourOpen] = useState(false)

  // Auto-start the tutorial once per browser. The flag is only written when
  // the tour is dismissed or finished, so the StrictMode remount can't race it.
  useEffect(() => {
    if (localStorage.getItem('tour-seen') !== '1') setTourOpen(true)
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

  return (
    <div className="flex h-screen bg-slate-100">
      <aside
        className={`flex flex-col bg-slate-900 text-slate-300 transition-[width] duration-200 ${
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
          {navGroups.map((group) => (
            <div key={group.items[0].to}>
              {!collapsed && group.title && (
                <div className="px-3 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  {group.title}
                </div>
              )}
              <div
                className={collapsed ? 'flex flex-col items-center gap-1' : 'space-y-1'}
              >
                {group.items.map(({ to, label, icon: Icon, end }) => (
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
          ))}
        </nav>
      </aside>
      <div className="flex flex-1 flex-col overflow-hidden">
        <SyncBanner />
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
          <div className="text-sm text-slate-500">{email}</div>
          <div className="flex items-center gap-3">
            <span data-tour="sync">
              <SyncStatus />
            </span>
            <button
              onClick={() => setTourOpen(true)}
              title="Show the tutorial again"
              className="flex items-center gap-1.5 rounded border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              <HelpCircle size={14} />
              Guide
            </button>
            <button
              onClick={async () => {
                await authClient.signOut()
                await clearCachedSession()
                navigate('/')
              }}
            className="flex items-center gap-1.5 rounded border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            <LogOut size={14} />
            Sign out
          </button>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/vouchers" element={<Vouchers />} />
            <Route path="/parties" element={<Parties />} />
            <Route path="/journal" element={<Journal />} />
            <Route path="/trial-balance" element={<TrialBalance />} />
            <Route path="/aging" element={<Aging />} />
            <Route path="/inventory" element={<Items />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/daybooks" element={<Daybooks />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
      {tourOpen && <Tour open={tourOpen} onClose={closeTour} />}
    </div>
  )
}
