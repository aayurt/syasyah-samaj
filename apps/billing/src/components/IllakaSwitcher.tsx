import { Lock, ChevronDown } from 'lucide-react'
import { useTenant } from '../lib/tenant'
import { useT } from '../lib/i18n'

/**
 * P1 illaka switcher (§21.1 of docs/illaka/PLAN.md).
 *
 * Central roles: a dropdown — All · Central (C00) · Illaka 01 … Illaka N.
 * Illaka roles: a static locked chip showing their illaka code + name.
 * Viewer: same dropdown but disabled.
 */
export default function IllakaSwitcher() {
  const { tenantId, setTenantId, tenants, isCentral, isIllaka, illakaCode, multiCompanyEnabled } =
    useTenant()
  const t = useT()

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
      <div className="flex items-center gap-1.5 rounded bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200">
        <Lock size={12} />
        <span>{label}</span>
      </div>
    )
  }

  // Central role: dropdown with Parent and Children grouping
  if (!isCentral) return null

  const parentTenants = tenants.filter(
    (tn) => tn.type === 'central' || tn.code === 'C00' || tn.code === 'SYASYAJ',
  )
  const childTenants = tenants.filter((tn) => !parentTenants.some((p) => p.id === tn.id))

  return (
    <div className="relative">
      <select
        value={tenantId}
        onChange={(e) => setTenantId(e.target.value)}
        className="appearance-none rounded border border-slate-200 bg-white py-1.5 pl-3 pr-8 text-xs font-medium text-slate-700 hover:border-slate-300 focus:border-crimson-500 focus:outline-none focus:ring-1 focus:ring-crimson-500 shadow-2xs"
        title={t('illaka.switchScope', 'Switch company / branch scope')}
      >
        <option value="">{t('illaka.all', 'All Companies (Consolidated)')}</option>

        {parentTenants.length > 0 && (
          <optgroup label={t('illaka.parentOrg', 'Parent Organization')}>
            {parentTenants.map((ten) => (
              <option key={ten.id} value={ten.id}>
                {ten.name || 'Syasyah Samaj Central'} [Parent]
              </option>
            ))}
          </optgroup>
        )}

        {childTenants.length > 0 && (
          <optgroup label={t('illaka.children', 'Sub-Companies / Branches')}>
            {childTenants.map((ten) => (
              <option key={ten.id} value={ten.id}>
                {ten.code ? `${ten.code} · ` : ''}{ten.name}
              </option>
            ))}
          </optgroup>
        )}
      </select>
      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
      />
    </div>
  )
}
