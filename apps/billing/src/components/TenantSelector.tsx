import { useMemo, useState } from 'react'
import { ChevronDown, Building2, MapPin, Lock } from 'lucide-react'
import { useTenant } from '../lib/tenant'
import { useT } from '../lib/i18n'
import { LiquidButton } from './ui/LiquidButton'

/**
 * Tenant Selector Component
 * 
 * Central users: Dropdown with "All (Consolidated)" + all Illakas
 * Illaka users: Locked chip showing their Illaka
 */
export default function TenantSelector() {
  const { tenantId, setTenantId, tenants, isCentral, isIllaka, illakaCode } = useTenant()
  const t = useT()
  const [open, setOpen] = useState(false)

  // Current tenant display
  const currentTenant = useMemo(() => {
    if (!tenantId) {
      return { name: t('tenant.all', 'All (Consolidated)'), code: 'ALL' }
    }
    const found = tenants.find(t => t.id === tenantId)
    return found || { name: tenantId, code: tenantId }
  }, [tenantId, tenants, t])

  if (isIllaka) {
    // Illaka users see locked chip
    return (
      <div className="flex items-center gap-2" data-testid="tenant-chip">
        <Lock size={14} className="text-slate-400" />
        <span className="px-3 py-1.5 text-sm font-medium bg-slate-100 text-slate-700 rounded-lg border border-slate-200">
          {t('tenant.currentIllaka', 'Current:')} {illakaCode || currentTenant.name}
        </span>
        <span className="text-xs text-slate-400">{t('tenant.locked', 'Locked')}</span>
      </div>
    )
  }

  // Central users see dropdown
  return (
    <div className="relative" data-testid="tenant-selector">
      <LiquidButton
        variant="outline"
        size="sm"
        onClick={() => setOpen(!open)}
        className="w-48 md:w-64 justify-between"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Building2 size={14} />
        <span className="truncate">{currentTenant.name}</span>
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </LiquidButton>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden="true" data-testid="dropdown-backdrop" />
          <div className="absolute right-0 mt-1 z-20 w-56 md:w-72 rounded-lg border border-slate-200 bg-white shadow-lg py-1">
            {/* All (Consolidated) option */}
            <button
              type="button"
              role="option"
              aria-selected={!tenantId}
              onClick={() => { setTenantId(''); setOpen(false); }}
              className={`w-full px-3 py-2 text-left text-sm ${
                !tenantId ? 'bg-crimson-50 text-crimson-700' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className="flex items-center gap-2">
                <Building2 size={14} className={!tenantId ? 'text-crimson-600' : 'text-slate-400'} />
                {t('tenant.all', 'All (Consolidated)')}
              </span>
            </button>

            <hr className="my-1 border-slate-100" />

            {/* Illaka options */}
            {tenants
              .filter(t => t.type === 'illaka')
              .map(tenant => (
                <button
                  key={tenant.id}
                  type="button"
                  role="option"
                  aria-selected={tenantId === tenant.id}
                  onClick={() => { setTenantId(tenant.id); setOpen(false); }}
                  className={`w-full px-3 py-2 text-left text-sm ${
                    tenantId === tenant.id ? 'bg-crimson-50 text-crimson-700' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <MapPin size={14} className={tenantId === tenant.id ? 'text-crimson-600' : 'text-slate-400'} />
                    {tenant.name}
                    {tenant.code && <span className="text-xs text-slate-400">({tenant.code})</span>}
                  </span>
                </button>
              ))}

            {tenants.filter(t => t.type === 'illaka').length === 0 && (
              <div className="px-3 py-2 text-sm text-slate-400 text-center">
                {t('tenant.noIllakas', 'No Illakas found')}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}