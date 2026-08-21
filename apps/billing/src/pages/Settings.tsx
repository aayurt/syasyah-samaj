import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, Hash, HelpCircle, LogOut, RotateCcw, Settings2 } from 'lucide-react'
import { api } from '../lib/api'
import { authClient, clearCachedSession } from '../lib/auth'
import { formatDate } from '../lib/nepaliDate'
import { useCalendar } from '../lib/calendar'
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
  const [calendarType, setCalendarType] = useState<'AD' | 'BS'>('BS')
  const [dateFormat, setDateFormat] = useState('YYYY-MM-DD')
  const [timeFormat, setTimeFormat] = useState<'12h' | '24h'>('12h')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [calSaved, setCalSaved] = useState(false)
  const loaded = useRef(false)
  // Doc sequences
  const [sequences, setSequences] = useState<{ key: string; lastNumber: number; id?: number }[]>([])
  const [resetKey, setResetKey] = useState('')
  const [resetValue, setResetValue] = useState('')
  const [resetting, setResetting] = useState(false)
  const navigate = useNavigate()
  const { update: updateCalendar } = useCalendar()

  const load = async () => {
    try {
      const res = await api<BillingSettings>('/globals/billing-settings', {
        query: { depth: 1 },
      })
      setSettings(res)
      setFiscalYearStart(res.fiscalYearStart?.slice(0, 10) || '')
      setFreezeDate(res.freezeDate?.slice(0, 10) || '')
      setCalendarType(res.calendarType || 'BS')
      setDateFormat(res.dateFormat || 'YYYY-MM-DD')
      setTimeFormat(res.timeFormat || '12h')
      loaded.current = true
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load settings')
    }
  }

  useEffect(() => {
    load()
    loadSequences()
  }, [])

  const loadSequences = async () => {
    try {
      const res = await api<{ docs: { key: string; lastNumber: number; id?: number }[] }>('doc-sequences', {
        query: { limit: 100, sort: 'key' },
      })
      setSequences(res.docs || [])
    } catch {
      // Silently fail — non-critical
    }
  }

  // Auto-save the calendar (AD/BS, date/time format) as soon as it changes —
  // debounced so flicking between AD and BS saves once, not per click.
  const persistCalendar = async () => {
    try {
      await api('/globals/billing-settings', {
        method: 'POST',
        body: { calendarType, dateFormat, timeFormat },
      })
      updateCalendar({ calendarType, dateFormat, timeFormat })
      setCalSaved(true)
    } catch {
      // offline — the Save button will retry
    }
  }

  useEffect(() => {
    if (!loaded.current) return
    const id = setTimeout(() => void persistCalendar(), 500)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendarType, dateFormat, timeFormat])

  useEffect(() => {
    if (!calSaved) return
    const id = setTimeout(() => setCalSaved(false), 2000)
    return () => clearTimeout(id)
  }, [calSaved])

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
              Choose the calendar — changes save automatically
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {calSaved && <span className="text-xs text-emerald-600">✓ Saved</span>}
            <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setCalendarType('AD')}
              aria-pressed={calendarType === 'AD'}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ring-1 ring-inset ${
                calendarType === 'AD'
                  ? 'bg-crimson-600 text-white ring-crimson-600'
                  : 'bg-slate-100 text-slate-500 ring-slate-200 hover:bg-slate-200'
              }`}
            >
              AD
            </button>
            <button
              type="button"
              onClick={() => setCalendarType('BS')}
              aria-pressed={calendarType === 'BS'}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ring-1 ring-inset ${
                calendarType === 'BS'
                  ? 'bg-crimson-600 text-white ring-crimson-600'
                  : 'bg-slate-100 text-slate-500 ring-slate-200 hover:bg-slate-200'
              }`}
            >
              BS
            </button>
            </div>
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
        <div className="mt-3 flex items-center gap-3 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => void persistCalendar()}
            className="rounded bg-crimson-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-crimson-700"
          >
            Save
          </button>
          {calSaved && <span className="text-sm text-emerald-600">✓ Saved</span>}
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

      {/* ── Doc Sequences ──────────────────────────────────────── */}
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Hash size={16} className="text-slate-500" />
          <div>
            <div className="text-sm font-medium text-slate-700">Voucher Numbering</div>
            <div className="text-xs text-slate-400">
              View and reset sequence counters for voucher numbers
            </div>
          </div>
        </div>
        {sequences.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">
            No sequences yet. Numbers are created automatically when vouchers are posted.
          </p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Key</th>
                <th className="px-3 py-2">Doc Type</th>
                <th className="px-3 py-2">Fiscal Year</th>
                <th className="px-3 py-2 text-right">Last Number</th>
                <th className="px-3 py-2 text-right">Next Number</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {sequences.map((seq) => {
                const [docType, fy] = seq.key.split(':')
                return (
                  <tr key={seq.key} className="border-b border-slate-50 last:border-0">
                    <td className="px-3 py-2 font-mono text-xs text-slate-600">{seq.key}</td>
                    <td className="px-3 py-2 text-slate-700">{docType || '—'}</td>
                    <td className="px-3 py-2 text-slate-600">{fy || '—'}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-800">{seq.lastNumber}</td>
                    <td className="px-3 py-2 text-right font-mono font-medium text-emerald-700">{seq.lastNumber + 1}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => { setResetKey(seq.key); setResetValue('0') }}
                        className="flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
                      >
                        <RotateCcw size={10} /> Reset
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        {resetKey && (
          <div className="mt-3 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <div className="text-sm text-slate-700">
              Reset <span className="font-mono font-medium">{resetKey}</span> to:
            </div>
            <input
              type="number"
              min="0"
              value={resetValue}
              onChange={(e) => setResetValue(e.target.value)}
              className="w-24 rounded border border-slate-300 px-2 py-1 text-sm font-mono outline-none focus:border-slate-500"
            />
            <button
              onClick={async () => {
                if (!resetKey) return
                const val = parseInt(resetValue) || 0
                if (!window.confirm(`Reset ${resetKey} to ${val}? The next voucher will use ${val + 1}.`)) return
                setResetting(true)
                try {
                  await api(`doc-sequences/${sequences.find((s) => s.key === resetKey)?.id}`, {
                    method: 'PATCH',
                    body: { lastNumber: val },
                  })
                  setResetKey('')
                  await loadSequences()
                } catch (err: unknown) {
                  setError(err instanceof Error ? err.message : 'Failed to reset sequence')
                }
                setResetting(false)
              }}
              disabled={resetting}
              className="rounded bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-40"
            >
              {resetting ? 'Saving…' : 'Confirm Reset'}
            </button>
            <button
              onClick={() => setResetKey('')}
              className="text-xs text-slate-400 hover:text-slate-700"
            >
              Cancel
            </button>
          </div>
        )}
        <p className="mt-3 text-xs text-slate-400">
          Sequences are keyed by document type and fiscal year (e.g. sales-invoice:2083).
          Resetting sets the counter — the next posted voucher will use the new value + 1.
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
