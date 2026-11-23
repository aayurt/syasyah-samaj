import React from 'react'
import { Building2, Database, Tag, Users } from 'lucide-react'
import { useT } from '../../../lib/i18n'

interface SetupMetricsProps {
  isParent: boolean
  illakaCount: number | null
  memberCount: number | null
  chartCount: number | null
  taxTypesCount: number | null
}

export const SetupMetrics: React.FC<SetupMetricsProps> = ({
  isParent,
  illakaCount,
  memberCount,
  chartCount,
  taxTypesCount,
}) => {
  const t = useT()

  return (
    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {isParent ? (
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <Building2 size={18} />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {t('setup.illakaCount', 'Sub-Companies')}
            </div>
            <div className="font-mono text-lg font-bold text-slate-800">
              {illakaCount ?? '–'}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <Building2 size={18} />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Branch Status
            </div>
            <div className="text-xs font-bold text-slate-800">
              Active Branch
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
          <Users size={18} />
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            {t('setup.members', 'Members')}
          </div>
          <div className="font-mono text-lg font-bold text-slate-800">
            {memberCount ?? '–'}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
          <Database size={18} />
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            {t('setup.chartOfAccounts', 'GL Accounts')}
          </div>
          <div className="font-mono text-lg font-bold text-slate-800">
            {chartCount ?? '–'}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
          <Tag size={18} />
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Tax Types
          </div>
          <div className="font-mono text-lg font-bold text-slate-800">
            {taxTypesCount ?? '–'}
          </div>
        </div>
      </div>
    </div>
  )
}
