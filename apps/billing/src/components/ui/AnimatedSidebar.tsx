import * as React from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { NavLink } from 'react-router-dom'
import {
  Building2,
  ChevronRight,
  ChevronsUpDown,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
} from 'lucide-react'
import { useTenant } from '../../lib/tenant'
import { authClient, useOfflineSession } from '../../lib/auth'

export interface SidebarItem {
  to: string
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  end?: boolean
  disabled?: boolean
  labelKey?: string
  feature?: string
}

export interface SidebarGroup {
  title?: string
  titleKey?: string
  items: SidebarItem[]
}

interface AnimatedSidebarProps {
  collapsed: boolean
  onToggle: () => void
  navGroups: SidebarGroup[]
  features: Record<string, boolean>
  closedGroups: Record<string, boolean>
  onToggleGroup: (groupTitle: string) => void
  t: (key: string, fallback?: string) => string
}

export function AnimatedSidebar({
  collapsed,
  onToggle,
  navGroups,
  features,
  closedGroups,
  onToggleGroup,
  t,
}: AnimatedSidebarProps) {
  const { tenantId, setTenantId, tenants, isCentral } = useTenant()
  const { session } = useOfflineSession()

  const [tenantDropdownOpen, setTenantDropdownOpen] = React.useState(false)
  const [userDropdownOpen, setUserDropdownOpen] = React.useState(false)

  const activeTenant = React.useMemo(() => {
    return tenants.find((tn) => String(tn.id) === String(tenantId)) || tenants[0]
  }, [tenants, tenantId])

  const userInitial = React.useMemo(() => {
    const email = session?.user?.email || 'Admin'
    return email.charAt(0).toUpperCase()
  }, [session])

  const handleSignOut = async () => {
    await authClient.signOut()
    window.location.href = '/admin/login'
  }

  return (
    <motion.aside
      initial={false}
      animate={{
        width: collapsed ? 64 : 240,
      }}
      transition={{
        type: 'spring',
        stiffness: 350,
        damping: 32,
      }}
      className="print:hidden relative z-20 flex flex-col bg-white border-r border-slate-200/90 text-slate-700 select-none shadow-xs"
    >
      {/* ── 1. Header: Organization / Illaka Switcher ─────────── */}
      <div className="p-2 border-b border-slate-100 relative">
        <div className="flex items-center justify-between gap-1">
          <button
            onClick={() => {
              if (isCentral && !collapsed) {
                setTenantDropdownOpen((o) => !o)
              }
            }}
            disabled={!isCentral || collapsed}
            className={`flex flex-1 items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors ${
              isCentral && !collapsed
                ? 'hover:bg-slate-100 cursor-pointer'
                : 'cursor-default'
            }`}
          >
            {/* Logo Badge */}
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-crimson-600 text-white font-bold text-xs shadow-xs">
              <Building2 size={16} />
            </div>

            {/* Title & Subtitle */}
            {!collapsed && (
              <div className="grid flex-1 text-left leading-tight truncate">
                <span className="truncate text-xs font-bold text-slate-900">
                  {activeTenant?.name || 'स्यस्यः धुकू'}
                </span>
                <span className="truncate text-[10px] text-slate-500">
                  {activeTenant?.type === 'central'
                    ? 'केन्द्रीय कार्यालय (HQ)'
                    : activeTenant?.code || 'इलाका शाखा'}
                </span>
              </div>
            )}

            {isCentral && !collapsed && (
              <ChevronsUpDown size={14} className="text-slate-400 shrink-0 ml-auto" />
            )}
          </button>

          {/* Toggle sidebar button */}
          <button
            onClick={onToggle}
            title={
              collapsed
                ? t('sidebar.expand', 'Expand sidebar')
                : t('sidebar.collapse', 'Collapse sidebar')
            }
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>

        {/* Illaka Selector Dropdown */}
        <AnimatePresence>
          {tenantDropdownOpen && !collapsed && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              transition={{ duration: 0.15 }}
              className="absolute left-2 right-2 top-full mt-1.5 z-50 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg space-y-1"
            >
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                इलाका / संगठन चयन
              </div>
              <div className="max-h-48 overflow-y-auto space-y-0.5">
                {tenants.map((tn) => {
                  const active = String(tn.id) === String(tenantId)
                  return (
                    <button
                      key={tn.id}
                      onClick={() => {
                        setTenantId(String(tn.id))
                        setTenantDropdownOpen(false)
                      }}
                      className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-left transition-colors ${
                        active
                          ? 'bg-crimson-50 text-crimson-800 font-semibold'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="truncate">{tn.name}</span>
                      {tn.code && (
                        <span className="ml-2 font-mono text-[10px] text-slate-400">
                          {tn.code}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── 2. Navigation Content with Tree Guide ─────────────── */}
      <nav className="flex-1 space-y-3 overflow-y-auto overflow-x-hidden p-2 scrollbar-thin scrollbar-thumb-slate-200">
        {navGroups.map((group) => {
          const items = group.items.filter((item) => {
            if (item.feature && !features[item.feature]) return false
            return true
          })
          if (items.length === 0) return null

          const isGroup = !!group.title
          const open =
            collapsed || !isGroup || !closedGroups[group.title as string]

          return (
            <div key={group.items[0].to} className="space-y-1">
              {/* Group Label */}
              {isGroup && !collapsed && (
                <button
                  onClick={() => onToggleGroup(group.title as string)}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between gap-1 rounded-md px-2.5 py-1 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700"
                >
                  <span className="truncate">
                    {group.titleKey ? t(group.titleKey, group.title) : group.title}
                  </span>
                  <ChevronRight
                    size={12}
                    className={`shrink-0 transition-transform duration-200 text-slate-400 ${
                      open ? 'rotate-90' : ''
                    }`}
                  />
                </button>
              )}

              {/* Sub-tree */}
              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    initial={isGroup && !collapsed ? { opacity: 0, height: 0 } : false}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.18 }}
                    className={
                      collapsed
                        ? 'flex flex-col items-center gap-1'
                        : isGroup
                        ? 'ml-2.5 pl-2.5 border-l border-slate-200/80 space-y-0.5'
                        : 'space-y-0.5'
                    }
                  >
                    {items.map(
                      ({ to, label, labelKey, icon: Icon, end, disabled }) => {
                        const translatedLabel = labelKey ? t(labelKey, label) : label

                        if (disabled) {
                          return (
                            <div
                              key={to}
                              title={`${translatedLabel} (coming soon)`}
                              className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-400 cursor-not-allowed opacity-60 ${
                                collapsed ? 'size-9 justify-center p-0' : ''
                              }`}
                            >
                              <Icon size={15} className="shrink-0" />
                              {!collapsed && (
                                <span className="truncate">{translatedLabel}</span>
                              )}
                            </div>
                          )
                        }

                        return (
                          <NavLink
                            key={to}
                            to={to}
                            end={end}
                            title={collapsed ? translatedLabel : undefined}
                            className={({ isActive }) =>
                              `group relative flex items-center gap-2 rounded-lg text-xs font-medium transition-colors ${
                                collapsed
                                  ? 'size-9 justify-center p-0'
                                  : 'px-2.5 py-1.5'
                              } ${
                                isActive
                                  ? 'text-crimson-700 font-semibold'
                                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                              }`
                            }
                          >
                            {({ isActive }) => (
                              <>
                                {/* Animated Active Pill */}
                                {isActive && (
                                  <motion.div
                                    layoutId="sidebar-active-pill"
                                    transition={{
                                      type: 'spring',
                                      stiffness: 400,
                                      damping: 35,
                                    }}
                                    className="absolute inset-0 rounded-lg bg-crimson-50 border border-crimson-200/60"
                                  />
                                )}

                                <span className="relative z-10 flex items-center gap-2">
                                  <Icon
                                    size={15}
                                    className={`shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                                      isActive
                                        ? 'text-crimson-600'
                                        : 'text-slate-400 group-hover:text-slate-600'
                                    }`}
                                  />
                                  {!collapsed && (
                                    <span className="truncate">{translatedLabel}</span>
                                  )}
                                </span>
                              </>
                            )}
                          </NavLink>
                        )
                      },
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </nav>

      {/* ── 3. Footer: User Identity Card ─────────────────────── */}
      <div className="p-2 border-t border-slate-100 relative">
        <button
          onClick={() => setUserDropdownOpen((o) => !o)}
          className={`flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors hover:bg-slate-100 ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          {/* Avatar Circle */}
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-700 font-bold text-xs">
            {userInitial}
          </div>

          {/* User Email & Role */}
          {!collapsed && (
            <div className="grid flex-1 text-left leading-tight truncate">
              <span className="truncate text-xs font-semibold text-slate-800">
                {session?.user?.email?.split('@')[0] || 'User'}
              </span>
              <span className="truncate text-[10px] text-slate-400 font-mono">
                {session?.user?.email || 'authenticated'}
              </span>
            </div>
          )}

          {!collapsed && (
            <ChevronsUpDown size={14} className="text-slate-400 shrink-0 ml-auto" />
          )}
        </button>

        {/* User Context Dropdown */}
        <AnimatePresence>
          {userDropdownOpen && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.15 }}
              className={`absolute bottom-full mb-1.5 z-50 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg space-y-1 ${
                collapsed ? 'left-2 w-48' : 'left-2 right-2'
              }`}
            >
              <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 border-b border-slate-100">
                {session?.user?.email || 'User Account'}
              </div>
              <NavLink
                to="/settings"
                onClick={() => setUserDropdownOpen(false)}
                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Settings size={14} className="text-slate-400" />
                <span>सेटिंग्स (Settings)</span>
              </NavLink>
              <button
                onClick={handleSignOut}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 transition-colors text-left"
              >
                <LogOut size={14} className="text-red-500" />
                <span>लगआउट (Log out)</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.aside>
  )
}
