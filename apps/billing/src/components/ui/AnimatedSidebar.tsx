import * as React from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { NavLink } from 'react-router-dom'
import { ChevronDown, PanelLeftClose, PanelLeftOpen } from 'lucide-react'

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
  return (
    <motion.aside
      initial={false}
      animate={{
        width: collapsed ? 64 : 224,
      }}
      transition={{
        type: 'spring',
        stiffness: 350,
        damping: 32,
      }}
      className="print:hidden relative z-20 flex flex-col bg-slate-900 text-slate-300 shadow-xl select-none"
    >
      {/* Sidebar Header */}
      <div
        className={`flex items-center py-4 transition-all duration-200 ${
          collapsed ? 'justify-center px-2' : 'justify-between px-5'
        }`}
      >
        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
              className="truncate text-lg font-semibold tracking-tight text-white"
            >
              स्यस्यः धुकू
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={onToggle}
          title={
            collapsed
              ? t('sidebar.expand', 'Expand sidebar')
              : t('sidebar.collapse', 'Collapse sidebar')
          }
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </motion.button>
      </div>

      {/* Nav Content */}
      <nav className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden px-2 pb-4 scrollbar-thin scrollbar-thumb-slate-700">
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
              {isGroup && !collapsed && (
                <button
                  onClick={() => onToggleGroup(group.title as string)}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between gap-1 rounded-md px-3 pb-1 pt-1.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-300"
                >
                  <span className="truncate">
                    {group.titleKey ? t(group.titleKey, group.title) : group.title}
                  </span>
                  <ChevronDown
                    size={12}
                    className={`shrink-0 transition-transform duration-200 ${
                      open ? '' : '-rotate-90'
                    }`}
                  />
                </button>
              )}

              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    initial={isGroup && !collapsed ? { opacity: 0, height: 0 } : false}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className={
                      collapsed
                        ? 'flex flex-col items-center gap-1.5'
                        : 'space-y-1'
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
                              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-600 cursor-not-allowed ${
                                collapsed ? 'w-10 justify-center p-2' : ''
                              }`}
                            >
                              <Icon size={16} className="shrink-0" />
                              {!collapsed && <span className="truncate">{translatedLabel}</span>}
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
                              `group relative flex items-center gap-2.5 rounded-lg text-xs font-medium transition-colors ${
                                collapsed
                                  ? 'h-10 w-10 justify-center p-0'
                                  : 'px-3 py-2'
                              } ${
                                isActive
                                  ? 'text-white'
                                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                              }`
                            }
                          >
                            {({ isActive }) => (
                              <>
                                {/* Animated active highlight pill */}
                                {isActive && (
                                  <motion.div
                                    layoutId="sidebar-active-pill"
                                    transition={{
                                      type: 'spring',
                                      stiffness: 400,
                                      damping: 35,
                                    }}
                                    className="absolute inset-0 rounded-lg bg-crimson-600/90 shadow-sm shadow-crimson-900/40"
                                  />
                                )}

                                <span className="relative z-10 flex items-center gap-2.5">
                                  <Icon
                                    size={16}
                                    className={`shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                                      isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
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
    </motion.aside>
  )
}
