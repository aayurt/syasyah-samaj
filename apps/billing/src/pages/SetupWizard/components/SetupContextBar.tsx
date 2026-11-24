import React from 'react'
import { Building2 } from 'lucide-react'
import type { TenantOption } from '../../../lib/tenant'
import { isParentCompany } from '../../../lib/tenant'

interface SetupContextBarProps {
  activeTenant: TenantOption | null
  companyName: string
  isCentral: boolean
  isSuperAdmin?: boolean
  onSwitchAll: () => void
}

export const SetupContextBar: React.FC<SetupContextBarProps> = ({
  activeTenant,
  companyName,
  isCentral,
  isSuperAdmin = false,
  onSwitchAll,
}) => {
  const isParent = !activeTenant || isParentCompany(activeTenant)

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-2xs">
      <div className="flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-crimson-50 text-crimson-600 font-bold text-xs shadow-2xs">
          <Building2 size={18} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-900">
              {activeTenant?.name || companyName || 'Organization Profile'}
            </span>
            {activeTenant?.code && (
              <span className="font-mono text-[11px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                {activeTenant.code}
              </span>
            )}
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                isParent
                  ? 'bg-crimson-100 text-crimson-700'
                  : 'bg-indigo-100 text-indigo-700'
              }`}
            >
              {isParent ? 'Parent Company' : 'Sub-Company / Branch'}
            </span>
          </div>
          {activeTenant?.pan && (
            <span className="text-[11px] text-slate-500 font-mono">
              PAN: {activeTenant.pan}
            </span>
          )}
        </div>
      </div>

      {isSuperAdmin && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSwitchAll}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition shadow-2xs"
          >
            <Building2 size={13} className="text-slate-500" />
            <span>Switch / All Companies</span>
          </button>
        </div>
      )}
    </div>
  )
}
