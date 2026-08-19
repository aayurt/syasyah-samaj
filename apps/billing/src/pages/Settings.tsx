import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, HelpCircle, LogOut, Settings2 } from 'lucide-react'
import { api } from '../lib/api'
import { authClient, clearCachedSession } from '../lib/auth'
import { formatDate } from '../lib/nepaliDate'
import type { Account, BillingSettings } from '../lib/types'

const ACCOUNT_FIELDS: { key: keyof BillingSettings; label: string }[] = [
  { key: 'receivableAccount', label: 'Accounts Receivable' },
  { key: 'payableAccount', label: 'Accounts Payable' },
  { key: 'revenueAccount', label: 'Sales Revenue' },
  { key: 'expenseAccount', label: 'Purchases / Expense' },
  { key: 'taxAccount', label: 'Output / Input Tax' },
  { key: 'cashAccount', label: 'Cash' },
  { key: 'bankAccount', label: 'Bank (default)' },
  { key: 'pettyCashAccount', label: 'Petty Cash' },
  { key: 'inventoryAccount', label: 'Inventory' },
  { key: 'cogsAccount', label: 'Cost of Goods Sold' },
  { key: 'returnsAccount', label: 'Sales / Purchase Returns' },
  { key: 'accruedPayableAccount', label: 'Accrued Payables' },
]

export default function Settings() {
  const [settings, setSettings] = useState<BillingSettings | null>(null)
  const [fiscalYearStart, setFiscalYearStart] = useState('')
  const [freezeDate, setFreezeDate] = useState('')
  const [error, setError] = useState('')
  const [calendarType, setCalendarType] = useState<'AD' | 'BS'>('AD')
  const [dateFormat, setDateFormat] = useState('YYYY-MM-DD')
  const [timeFormat, setTimeFormat] = useState<'12h' | '24h'>('12h')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const navigate = useNavigate()

  const load = async () => {
    try {
      const res = await api<BillingSettings>('/globals/billing-settings', {
        query: { depth: 1 },
      })
      setSettings(res)
      setFiscalYearStart(res.fiscalYearStart?.slice(0, 10) || '')
      setFreezeDate(res.freezeDate?.slice(0, 10) || '')
      setCalendarType(res.calendarType || 'AD')
      setDateFormat(res.dateFormat || 'YYYY-MM-DD')
      setTimeFormat(res.timeFormat || '12h')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load settings')
    }
  }

  useEffect(() => {
    load()
  }, [])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      await api('/globals/billing-settings', {
        method: 'POST',
        body: {
          calendarType,
          dateFormat,
          timeFormat,
          fiscalYearStart: fiscalYearStart || null,
          freezeDate: freezeDate || null,
        },
      })
      setSaved(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save settings')
    }
    setSaving(false)
  }

  const accountName = (v: BillingSettings[keyof BillingSettings]) =>
    v && typeof v === 'object'
      ? (v as Account).name
      : '—'

  return (
    <div data-tour="settings" className="mx-auto max-w-4xl">
      <h1 className="text-lg font-semibold text-slate-900">Settings</h1>

      {error && (
        <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* ── Calendar ──────────────────────────────────────────── */}
      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Calendar size={16} className="text-slate-500" />
          <div>
            <div className="text-sm font-medium text-slate-700">Calendar</div>
            <div className="text-xs text-slate-400">
              To adjust calendar type, choose from available options
            </div>
          </div>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={() => setCalendarType('AD')}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                calendarType === 'AD'
                  ? 'bg-slate-200 text-slate-800'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              AD
            </button>
            <button
              type="button"
              onClick={() => setCalendarType('BS')}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                calendarType === 'BS'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              BS
            </button>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm text-slate-600">Date Format</label>
            <select
              value={dateFormat}
              onChange={(e) => setDateFormat(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            >
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="YYYY/MM/DD">YYYY/MM/DD</option>
              <option value="DD MMMM YYYY">DD MMMM YYYY (15 Asar 2083)</option>
              <option value="MMMM DD, YYYY">MMMM DD, YYYY</option>
              <option value="DD MMM YYYY">DD MMM YYYY</option>
            </select>
            <div className="mt-2 rounded bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <span className="text-xs text-slate-400">Preview: </span>
              <span className="font-medium">
                {formatDate(new Date().toISOString(), calendarType, dateFormat)}
              </span>
            </div>
          </div>
          <div>
            <label className="text-sm text-slate-600">Time Format</label>
            <select
              value={timeFormat}
              onChange={(e) => setTimeFormat(e.target.value as '12h' | '24h')}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            >
              <option value="12h">12-hour (1:30 PM)</option>
              <option value="24h">24-hour (13:30)</option>
            </select>
            <div className="mt-2 rounded bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <span className="text-xs text-slate-400">Preview: </span>
              <span className="font-medium">
                {formatDate(new Date().toISOString(), calendarType, 'HH:mm', timeFormat)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Fiscal Settings ────────────────────────────────────── */}
      <form
        onSubmit={save}
        className="mt-4 rounded-lg border border-slate-200 bg-white p-4"
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="text-sm text-slate-700">
            Fiscal year start
            <input
              type="date"
              value={fiscalYearStart}
              onChange={(e) => setFiscalYearStart(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            />
            <span className="mt-1 block text-xs text-slate-400">
              Used for voucher numbering (e.g. 2026-07-16). Empty = calendar
              year.
            </span>
          </label>
          <label className="text-sm text-slate-700">
            Freeze date
            <input
              type="date"
              value={freezeDate}
              onChange={(e) => setFreezeDate(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            />
            <span className="mt-1 block text-xs text-slate-400">
              No entry may be posted with a date before this (period close).
              Empty = no freeze.
            </span>
          </label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-crimson-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-crimson-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          {saved && <span className="text-sm text-emerald-600">✓ Saved</span>}
        </div>
      </form>

      <div className="mt-6 rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3 text-sm font-medium text-slate-700">
          Default accounts
        </div>
        <table className="w-full text-sm">
          <tbody>
            {ACCOUNT_FIELDS.map((f) => (
              <tr key={f.key} className="border-b border-slate-50 last:border-0">
                <td className="px-4 py-2 text-slate-600">{f.label}</td>
                <td className="px-4 py-2 text-right font-medium text-slate-800">
                  {settings ? accountName(settings[f.key]) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-400">
          Default accounts are managed in the Payload admin (Billing → Billing
          Settings). Missing accounts block posting until configured.
        </p>
      </div>

      {/* Account actions */}
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
        <div className="text-sm font-medium text-slate-700">Account</div>
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem('tour-seen')
              window.location.reload()
            }}
            className="flex items-center gap-2 rounded border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            <HelpCircle size={14} />
            Show Tutorial
          </button>
          <button
            type="button"
            onClick={async () => {
              await authClient.signOut()
              await clearCachedSession()
              navigate('/')
            }}
            className="flex items-center gap-2 rounded border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  )
}
