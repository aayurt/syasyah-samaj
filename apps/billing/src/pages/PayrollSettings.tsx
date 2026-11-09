/**
 * Payroll Settings — statutory configuration (Nepal SSF/PF/CIT or India EPF/ESIC/PT/LWF/TDS).
 *
 * Route: /payroll/settings
 */
import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import { pushToast } from '../lib/toast'
import type { PayrollSettings } from '../lib/types'

const COUNTRY_LABELS: Record<string, string> = { Nepal: 'Nepal', India: 'India' }

export default function PayrollSettings() {
  const [settings, setSettings] = useState<PayrollSettings>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const s = await api<PayrollSettings>('/globals/payroll-settings', { query: { depth: 0 } })
      setSettings(s)
    } catch {
      /* api() toasted */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async () => {
    setSaving(true)
    try {
      await api('/globals/billing-settings', {
        method: 'PATCH',
        body: { payroll: settings },
      })
      pushToast('success', 'Payroll settings saved')
    } catch (err) {
      pushToast('error', 'Save failed', err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const setField = (key: string, value: unknown) =>
    setSettings((prev) => ({ ...prev, [key]: value }))

  return (
    <div className="p-6 mx-auto max-w-3xl">
      <h1 className="text-xl font-semibold text-slate-900 mb-6">Payroll Settings</h1>
      {loading ? (
        <div className="p-8 text-center text-sm text-slate-500">Loading…</div>
      ) : (
        <form
          onSubmit={(e) => e.preventDefault()}
          className="rounded-lg border border-slate-200 bg-white p-6 space-y-6"
        >
          {/* Country */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-2">Country</label>
            <select
              value={settings.country || 'Nepal'}
              onChange={(e) => setField('country', e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              {Object.entries(COUNTRY_LABELS).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {settings.country === 'Nepal' && (
            <fieldset className="border border-slate-200 rounded-lg p-4">
              <legend className="text-xs font-semibold text-slate-700 px-2">Nepal Statutes (SSF / PF / CIT)</legend>
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={settings.ssfEnabled !== false}
                    onChange={(e) => setField('ssfEnabled', e.target.checked)}
                  />
                  <span>SSF (Social Security Fund)</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={settings.pfEnabled !== false}
                    onChange={(e) => setField('pfEnabled', e.target.checked)}
                  />
                  <span>PF (Provident Fund)</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={settings.citEnabled !== false}
                    onChange={(e) => setField('citEnabled', e.target.checked)}
                  />
                  <span>CIT (Corporate/Individual Tax)</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">SSF Rate %</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.1}
                      value={settings.ssfRate ?? 11}
                      onChange={(e) => setField('ssfRate', Number(e.target.value) || 0)}
                      className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">PF Rate %</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.1}
                      value={settings.pfRate ?? 10}
                      onChange={(e) => setField('pfRate', Number(e.target.value) || 0)}
                      className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">SSF Min Basic</label>
                    <input
                      type="number"
                      min={0}
                      value={settings.ssfMinBasic ?? 7000}
                      onChange={(e) => setField('ssfMinBasic', Number(e.target.value) || 0)}
                      className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">SSF Number</label>
                    <input
                      value={settings.ssfNumber ?? ''}
                      onChange={(e) => setField('ssfNumber', e.target.value)}
                      className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">PF Number</label>
                    <input
                      value={settings.pfNumber ?? ''}
                      onChange={(e) => setField('pfNumber', e.target.value)}
                      className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Company PAN</label>
                    <input
                      value={settings.panNumber ?? ''}
                      onChange={(e) => setField('panNumber', e.target.value)}
                      className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                    />
                  </div>
                </div>
              </div>
            </fieldset>
          )}

          {settings.country === 'India' && (
            <fieldset className="border border-slate-200 rounded-lg p-4">
              <legend className="text-xs font-semibold text-slate-700 px-2">India Statutes (EPF / ESIC / PT / LWF / TDS)</legend>
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={settings.epfEnabled}
                    onChange={(e) => setField('epfEnabled', e.target.checked)}
                  />
                  <span>EPF (Employees' Provident Fund)</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={settings.esicEnabled}
                    onChange={(e) => setField('esicEnabled', e.target.checked)}
                  />
                  <span>ESIC (Employee State Insurance)</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={settings.professionalTaxEnabled}
                    onChange={(e) => setField('professionalTaxEnabled', e.target.checked)}
                  />
                  <span>Professional Tax</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={settings.lwfEnabled}
                    onChange={(e) => setField('lwfEnabled', e.target.checked)}
                  />
                  <span>LWF (Labour Welfare Fund)</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={settings.tdsEnabled}
                    onChange={(e) => setField('tdsEnabled', e.target.checked)}
                  />
                  <span>TDS (Tax Deducted at Source)</span>
                </label>
              </div>
            </fieldset>
          )}

          <div className="pt-4 flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded bg-crimson-600 px-6 py-2 text-sm font-medium text-white hover:bg-crimson-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
