import * as React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useT } from '../../lib/i18n'

/**
 * Route segment → i18n key. Labels come from the `nav` namespace so the
 * breadcrumb always matches the active language (no bilingual strings).
 * Unknown segments fall back to the raw URL segment.
 */
const ROUTE_KEYS: Record<string, string> = {
  accounts: 'nav.accounts',
  'opening-balances': 'nav.openingBalances',
  vouchers: 'nav.vouchers',
  parties: 'nav.parties',
  journal: 'nav.journal',
  'trial-balance': 'nav.trialBalance',
  aging: 'nav.aging',
  inventory: 'nav.inventory',
  reports: 'nav.reportsHub',
  members: 'nav.members',
  'membership-types': 'nav.membershipTypes',
  posting: 'nav.posting',
  audit: 'nav.auditLog',
  settings: 'nav.settings',
  transfers: 'nav.transfers',
  daybooks: 'nav.daybook',
  payroll: 'nav.payroll',
  employees: 'nav.employees',
  registers: 'nav.statutoryRegisters',
}

export function Breadcrumbs() {
  const location = useLocation()
  const t = useT()
  const segments = location.pathname.split('/').filter(Boolean)

  if (segments.length === 0) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
        <span className="text-slate-900 font-semibold">{t('nav.dashboard', 'Dashboard')}</span>
      </div>
    )
  }

  let currentPath = ''

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs">
      <Link
        to="/"
        className="text-slate-400 hover:text-slate-700 transition-colors"
      >
        {t('nav.home', 'Home')}
      </Link>
      {segments.map((seg: string, idx: number) => {
        currentPath += `/${seg}`
        const isLast = idx === segments.length - 1
        const key = ROUTE_KEYS[seg]
        const label = key ? t(key, seg) : seg

        return (
          <React.Fragment key={currentPath}>
            <ChevronRight size={12} className="text-slate-300 shrink-0" />
            {isLast ? (
              <span className="font-semibold text-slate-900 truncate">
                {label}
              </span>
            ) : (
              <Link
                to={currentPath}
                className="text-slate-500 hover:text-slate-800 transition-colors truncate"
              >
                {label}
              </Link>
            )}
          </React.Fragment>
        )
      })}
    </nav>
  )
}
