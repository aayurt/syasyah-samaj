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
  const { tenantId, setTenantId, tenants, isCentral, isIllaka, illakaCode } =
    useTenant()
  const t = useT()

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

  // Central role: dropdown
  if (!isCentral) return null

  const current = tenants.find((t) => t.id === tenantId)
  const displayLabel = tenantId
    ? current
      ? `${current.code ? current.code + ' · ' : ''}${current.name}`
      : 'Unknown'
    : t('illaka.all', 'All Illakas')

  return (
    <div className="relative">
      <select
        value={tenantId}
        onChange={(e) => setTenantId(e.target.value)}
        className="appearance-none rounded border border-slate-200 bg-white py-1.5 pl-3 pr-8 text-xs font-medium text-slate-700 hover:border-slate-300 focus:border-crimson-500 focus:outline-none focus:ring-1 focus:ring-crimson-500"
        title={t('illaka.switchScope', 'Switch illaka scope')}
      >
        <option value="">{t('illaka.all', 'All Illakas')}</option>
        {tenants.map((ten) => (
          <option key={ten.id} value={ten.id}>
            {ten.code ? `${ten.code} · ` : ''}{ten.name}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
      />
    </div>
  )
}
