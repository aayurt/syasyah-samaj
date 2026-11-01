import { useEffect, useState } from 'react'
import { Save, Settings2 } from 'lucide-react'
import { api } from '../lib/api'
import { pushToast } from '../lib/toast'
import { INDIAN_STATES } from '../lib/indiaStates'
import type { Account, PayrollSettings } from '../lib/types'

/**
 * Payroll Settings — the india-payroll compliance page.
 *
 * Statute toggles (EPF / ESIC / PT / LWF / TDS) gate what the generate
 * endpoint computes; registration numbers print on the statutory registers;
 * account mappings decide which payable each scheme credits (falling back
 * to Accrued Payables on the server when empty).
 */

const STATUTES: Array<{
  key: keyof Pick<
    PayrollSettings,
    'epfEnabled' | 'esicEnabled' | 'professionalTaxEnabled' | 'lwfEnabled' | 'tdsEnabled'
  >;
  label: string
  description: string
}> = [
  {
    key: 'epfEnabled',
    label: 'Provident Fund (EPF)',
    description: '12 % employee on PF wage (Basic + DA), capped at the statutory ceiling; employer EPF/EPS/EDLI/admin accrued.',
  },
  {
    key: 'esicEnabled',
    label: 'Employee State Insurance (ESIC)',
    description: '0.75 % employee / 3.25 % employer on ESI wage when gross ≤ ₹21,000.',
  },
  {
    key: 'professionalTaxEnabled',
    label: 'Professional Tax',
    description: 'State slabs on the employment state — monthly, half-yearly or yearly with cumulative adjustment.',
  },
  {
    key: 'lwfEnabled',
    label: 'Labour Welfare Fund',
    description: 'Employee + employer amounts per the state frequency (monthly, June + December, or December).',
  },
  {
    key: 'tdsEnabled',
    label: 'TDS on salary',
    description: 'Monthly instalment of the projected annual tax (new or old regime, rebate, surcharge + relief, cess).',
  },
]

const ACCOUNT_FIELDS: Array<{
  key: keyof Pick<
    PayrollSettings,
    | 'epfPayableAccount'
    | 'epsPayableAccount'
    | 'edliPayableAccount'
    | 'esicPayableAccount'
    | 'ptPayableAccount'
    | 'lwfPayableAccount'
    | 'tdsPayableAccount'
    | 'statutoryExpenseAccount'
  >;
  label: string
}> = [
  { key: 'epfPayableAccount', label: 'EPF payable' },
  { key: 'epsPayableAccount', label: 'EPS (pension) payable' },
  { key: 'edliPayableAccount', label: 'EDLI + admin payable' },
  { key: 'esicPayableAccount', label: 'ESIC payable' },
  { key: 'ptPayableAccount', label: 'Professional Tax payable' },
  { key: 'lwfPayableAccount', label: 'LWF payable' },
  { key: 'tdsPayableAccount', label: 'TDS payable' },
  { key: 'statutoryExpenseAccount', label: 'Employer contributions expense' },
]

const relId = (v: number | Account | null | undefined): string => {
  if (v == null) return ''
  return String(typeof v === 'object' ? v.id : v)
}

export default function PayrollSettingsPage() {
  const [settings, setSettings] = useState<PayrollSettings>({})
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [s, a] = await Promise.all([
          api<PayrollSettings>('/globals/payroll-settings', { query: { depth: 0 } }),
          api<{ docs: Account[] }>('/gl-accounts', {
            query: { limit: 500, sort: 'name' },
          }),
        ])
        if (cancelled) return
        setSettings(s || {})
        setAccounts(a.docs || [])
      } catch {
        /* api() already toasted */
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const set = <K extends keyof PayrollSettings>(key: K, value: PayrollSettings[K]) =>
    setSettings((s) => ({ ...s, [key]: value }))

  const handleSave = async () => {
    setSaving(true)
    try {
      await api('/globals/payroll-settings', { method: 'POST', body: settings })
      pushToast('success', 'Payroll settings saved')
    } catch (err) {
      pushToast(
        'error',
        'Save failed',
        err instanceof Error ? err.message : 'Failed to save payroll settings',
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">Loading payroll settings…</div>
  }

  return (
    <div className="p-6 mx-auto max-w-3xl">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
          <Settings2 size={20} className="text-crimson-600" />
          Payroll Settings
        </h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 rounded bg-crimson-600 px-3 py-2 text-sm font-medium text-white hover:bg-crimson-700 disabled:opacity-50"
        >
          <Save size={15} />
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {/* Statute toggles */}
      <section className="mb-5 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Statutes
        </h2>
        <div className="space-y-3">
          {STATUTES.map((s) => (
            <label key={s.key} className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={!!settings[s.key]}
                onChange={(e) => set(s.key, e.target.checked)}
                className="mt-0.5"
              />
              <span>
                <span className="block text-sm font-medium text-slate-800">{s.label}</span>
                <span className="block text-xs text-slate-500">{s.description}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      {/* Registration numbers + default state */}
      <section className="mb-5 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Registration &amp; defaults
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-xs font-medium text-slate-500">PF account number</span>
            <input
              value={settings.pfNumber || ''}
              onChange={(e) => set('pfNumber', e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="text-xs font-medium text-slate-500">ESIC registration number</span>
            <input
              value={settings.esiNumber || ''}
              onChange={(e) => set('esiNumber', e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="text-xs font-medium text-slate-500">LWF number</span>
            <input
              value={settings.lwfNumber || ''}
              onChange={(e) => set('lwfNumber', e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="text-xs font-medium text-slate-500">
              Default employment state
            </span>
            <select
              value={settings.defaultEmploymentState || ''}
              onChange={(e) => set('defaultEmploymentState', e.target.value || null)}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="">— none —</option>
              {INDIAN_STATES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {/* Account mappings */}
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Accounts
        </h2>
        <p className="mb-3 text-xs text-slate-500">
          Empty mappings fall back to Accrued Payables (deductions) or the salary
          expense account (employer contributions) at posting time.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ACCOUNT_FIELDS.map((f) => (
            <label key={f.key} className="block text-sm">
              <span className="text-xs font-medium text-slate-500">{f.label}</span>
              <select
                value={relId(settings[f.key])}
                onChange={(e) =>
                  set(f.key, e.target.value ? Number(e.target.value) : null)
                }
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              >
                <option value="">— Accrued Payables fallback —</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </section>
    </div>
  )
}
