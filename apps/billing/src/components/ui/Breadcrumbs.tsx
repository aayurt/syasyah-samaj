import * as React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

const ROUTE_LABELS: Record<string, string> = {
  '': 'ड्यासबोर्ड (Dashboard)',
  accounts: 'खाता सूची (Chart of Accounts)',
  'opening-balances': 'प्रारम्भिक मौज्दात (Opening Balances)',
  vouchers: 'भौचरहरू (Vouchers)',
  parties: 'पक्षहरू (Parties)',
  journal: 'जर्नल भौचर (Journal)',
  'trial-balance': 'सन्तुलन परीक्षण (Trial Balance)',
  aging: 'उधारो विश्लेषण (Aging)',
  inventory: 'जिन्सी मौज्दात (Inventory)',
  reports: 'प्रतिवेदनहरू (Reports Hub)',
  members: 'सदस्यता (Members)',
  'membership-types': 'सदस्यता प्रकार (Membership Types)',
  posting: 'प्रमाणीकरण (Posting Queue)',
  'audit-log': 'अडिट लग (Audit Log)',
  settings: 'सेटिंग्स (Settings)',
  transfers: 'आन्तरिक रकमान्तर (Transfers)',
  daybooks: 'दैनिक खाता (Daybooks)',
}

export function Breadcrumbs() {
  const location = useLocation()
  const segments = location.pathname.split('/').filter(Boolean)

  if (segments.length === 0) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
        <span className="text-slate-900 font-semibold">ड्यासबोर्ड (Dashboard)</span>
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
        गृह (Home)
      </Link>
      {segments.map((seg: string, idx: number) => {
        currentPath += `/${seg}`
        const isLast = idx === segments.length - 1
        const label = ROUTE_LABELS[seg] || seg

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
