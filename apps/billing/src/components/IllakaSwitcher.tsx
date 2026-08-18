import { Lock, ChevronDown } from 'lucide-react'
import { useTenant } from '../lib/tenant'

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

  // Illaka-scoped user: show a locked chip
  if (isIllaka) {
    const locked = tenants.find((t) => t.id === tenantId)
    const label = illakaCode
      ? `${locked?.name || illakaCode}`
      : locked?.name || 'Illaka'
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
    : 'All Illakas'

  return (
    <div className="relative">
      <select
        value={tenantId}
        onChange={(e) => setTenantId(e.target.value)}
        className="appearance-none rounded border border-slate-200 bg-white py-1.5 pl-3 pr-8 text-xs font-medium text-slate-700 hover:border-slate-300 focus:border-crimson-500 focus:outline-none focus:ring-1 focus:ring-crimson-500"
        title="Switch illaka scope"
      >
        <option value="">All Illakas</option>
        {tenants.map((t) => (
          <option key={t.id} value={t.id}>
            {t.code ? `${t.code} · ` : ''}{t.name}
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
