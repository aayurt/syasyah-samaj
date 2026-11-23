import React, { useMemo } from 'react'
import { Lock, ChevronDown } from 'lucide-react'
import { useTenant, getParentCompanies, getSubCompaniesForParent } from '../lib/tenant'
import { useT } from '../lib/i18n'

/**
 * Multi-company & Sub-company cascading switcher.
 * Allows switching the Parent Company first, and then choosing its Sub-companies / Branches.
 */
export default function IllakaSwitcher() {
  const { tenantId, setTenantId, tenants, isCentral, isIllaka, illakaCode, multiCompanyEnabled } =
    useTenant()
  const t = useT()

  const parents = useMemo(() => getParentCompanies(tenants), [tenants])

  const activeTenant = useMemo(
    () => tenants.find((t) => String(t.id) === String(tenantId)),
    [tenants, tenantId]
  )

  // Identify which parent company corresponds to the currently active tenantId
  // If tenantId is empty -> selectedParentId is '' (All Companies)
  // If tenantId is a parent -> selectedParentId is tenantId
  // If tenantId is a sub-company -> selectedParentId is tenant.parentId
  const selectedParentId = useMemo(() => {
    if (!tenantId) return ''
    if (activeTenant && activeTenant.parentId) {
      return String(activeTenant.parentId)
    }
    return tenantId
  }, [tenantId, activeTenant])

  // Get sub-companies of the currently selected parent company
  const currentSubCompanies = useMemo(() => {
    if (!selectedParentId) return []
    return getSubCompaniesForParent(selectedParentId, tenants)
  }, [selectedParentId, tenants])

  // If multi-company mode is explicitly turned off, hide the switcher for central users
  if (multiCompanyEnabled === false && !isIllaka) {
    return null
  }

  // Illaka-scoped user: show a locked chip
  if (isIllaka) {
    const locked = tenants.find((t) => t.id === tenantId)
    const label = illakaCode
      ? `${locked?.name || illakaCode}`
      : locked?.name || t('illaka.label', 'Illaka')
    return (
      <div className="flex items-center gap-1.5 rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 shadow-2xs">
        <Lock size={12} />
        <span>{label}</span>
      </div>
    )
  }

  // Central role: dropdowns for Company and Sub-Company
  if (!isCentral) return null

  const handleCompanyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    setTenantId(val)
  }

  const handleSubCompanyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    setTenantId(val)
  }

  return (
    <div className="flex items-center gap-1.5">
      {/* 1. Company Selector */}
      <div className="relative">
        <select
          value={selectedParentId}
          onChange={handleCompanyChange}
          aria-label={t('illaka.switchCompany', 'Select Company')}
          className="appearance-none rounded-lg border border-slate-200 bg-white py-1.5 pl-2.5 pr-7 text-xs font-semibold text-slate-800 hover:border-slate-300 focus:border-crimson-500 focus:outline-none focus:ring-1 focus:ring-crimson-500 shadow-2xs max-w-[160px] truncate"
          title={t('illaka.switchCompany', 'Select Company')}
        >
          <option value="">{t('illaka.all', 'All Companies (Consolidated)')}</option>
          {parents.map((p) => (
            <option key={p.id} value={p.id}>
              🏢 {p.name}
            </option>
          ))}
        </select>
        <ChevronDown
          size={13}
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
        />
      </div>

      {/* 2. Sub-Company / Branch Selector (visible when a company is selected) */}
      {selectedParentId && currentSubCompanies.length > 0 && (
        <div className="relative animate-in fade-in duration-150">
          <select
            value={tenantId}
            onChange={handleSubCompanyChange}
            aria-label={t('illaka.switchBranch', 'Select Sub-Company / Branch')}
            className="appearance-none rounded-lg border border-slate-200 bg-white py-1.5 pl-2.5 pr-7 text-xs font-medium text-slate-700 hover:border-slate-300 focus:border-crimson-500 focus:outline-none focus:ring-1 focus:ring-crimson-500 shadow-2xs max-w-[160px] truncate"
            title={t('illaka.switchBranch', 'Select Sub-Company / Branch')}
          >
            <option value={selectedParentId}>
              Main / HQ ({parents.find((p) => p.id === selectedParentId)?.name || 'HQ'})
            </option>
            {currentSubCompanies.map((child) => (
              <option key={child.id} value={child.id}>
                ↳ {child.code ? `${child.code} · ` : ''}{child.name}
              </option>
            ))}
          </select>
          <ChevronDown
            size={13}
            className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
          />
        </div>
      )}
    </div>
  )
}
