import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarClock, Pause, Play, Plus, Trash2, Zap } from 'lucide-react'
import { api, fmt } from '../lib/api'
import { useCalendar } from '../lib/calendar'
import { useTenant, useTenantQuery } from '../lib/tenant'
import { pushToast } from '../lib/toast'
import type { RecurringSchedule, RecurringFrequency, DocType, Party } from '../lib/types'
import SearchSelect from '../components/SearchSelect'

const FREQ_OPTIONS: { value: RecurringFrequency; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
]

const DOCTYPES: { value: DocType; label: string }[] = [
  { value: 'sales-invoice', label: 'Sales Invoice' },
  { value: 'purchase-invoice', label: 'Purchase Invoice' },
  { value: 'membership-receipt', label: 'Membership Receipt' },
  { value: 'donation-receipt', label: 'Donation Receipt' },
]

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  paused: 'bg-amber-100 text-amber-700',
  completed: 'bg-slate-100 text-slate-500',
}

const today = () => new Date().toISOString().slice(0, 10)

type LineDraft = { description: string; qty: string; rate: string }

export default function RecurringBilling() {
  const tenantQuery = useTenantQuery()
  const { tenants } = useTenant()
  const { formatDate } = useCalendar()

  // ── Schedule list ──────────────────────────────────────────────
  const [schedules, setSchedules] = useState<RecurringSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api<{ docs: RecurringSchedule[] }>(
        '/recurring-schedules',
        { query: { limit: 500, depth: 1, sort: '-nextRunDate', ...tenantQuery } },
      )
      setSchedules(res.docs || [])
    } catch {
      /* offline */
    } finally {
      setLoading(false)
    }
  }, [tenantQuery])
  useEffect(() => { load() }, [load])

  // ── Parties (for the form) ─────────────────────────────────────
  const [parties, setParties] = useState<Party[]>([])
  useEffect(() => {
    api<{ docs: Party[] }>('/parties', { query: { limit: 500, sort: 'name', ...tenantQuery } })
      .then((r) => setParties(r.docs || []))
      .catch(() => {})
  }, [tenantQuery])

  // ── Create form ────────────────────────────────────────────────
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [docType, setDocType] = useState<DocType>('sales-invoice')
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly')
  const [dayOfMonth, setDayOfMonth] = useState('1')
  const [partyId, setPartyId] = useState('')
  const [taxRate, setTaxRate] = useState('')
  const [narration, setNarration] = useState('')
  const [startDate, setStartDate] = useState(today())
  const [endDate, setEndDate] = useState('')
  const [lines, setLines] = useState<LineDraft[]>([{ description: '', qty: '1', rate: '' }])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const addLine = () => setLines([...lines, { description: '', qty: '1', rate: '' }])
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i))
  const updateLine = (i: number, field: keyof LineDraft, val: string) => {
    const next = [...lines]
    next[i] = { ...next[i], [field]: val }
    setLines(next)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!name.trim()) { setError('Name is required.'); return }
    if (!partyId) { setError('Select a party.'); return }
    if (lines.some((l) => !l.description.trim() || !Number(l.rate))) {
      setError('Each line needs a description and rate.'); return
    }
    setSubmitting(true)
    try {
      const body = {
        name: name.trim(),
        docType,
        frequency,
        dayOfMonth: dayOfMonth ? Number(dayOfMonth) : undefined,
        party: Number(partyId),
        taxRate: taxRate ? Number(taxRate) : 0,
        narration: narration || undefined,
        startDate,
        endDate: endDate || undefined,
        nextRunDate: startDate,
        lines: lines.map((l) => ({
          description: l.description.trim(),
          qty: Number(l.qty) || 1,
          rate: Number(l.rate),
          amount: (Number(l.qty) || 1) * Number(l.rate),
        })),
      }
      await api('/recurring-schedules', { method: 'POST', body })
      pushToast('success', 'Schedule created', `${name} — ${frequency}`)
      setShowForm(false)
      resetForm()
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setName(''); setDocType('sales-invoice'); setFrequency('monthly')
    setDayOfMonth('1'); setPartyId(''); setTaxRate(''); setNarration('')
    setStartDate(today()); setEndDate(''); setLines([{ description: '', qty: '1', rate: '' }])
  }

  // ── Actions ────────────────────────────────────────────────────
  const handleRunNow = async (id: string) => {
    setRunning(id)
    try {
      const res = await api<{ docId: number; number: string; grossTotal: number }>(
        `recurring-schedules/${id}/run-now`,
        { method: 'POST' },
      )
      pushToast('success', 'Invoice generated', `${res.number} — ${fmt(res.grossTotal)}`)
      load()
    } catch (err) {
      pushToast('error', 'Generation failed', err instanceof Error ? err.message : String(err))
    } finally {
      setRunning(null)
    }
  }

  const handleToggle = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active'
    try {
      await api(`/recurring-schedules/${id}`, {
        method: 'PATCH',
        body: { status: newStatus },
      })
      pushToast('info', `Schedule ${newStatus}`, '')
      load()
    } catch (err) {
      pushToast('error', 'Failed', err instanceof Error ? err.message : String(err))
    }
  }

  const handleDelete = async (id: string, scheduleName: string) => {
    if (!confirm(`Delete schedule "${scheduleName}"? This cannot be undone.`)) return
    try {
      await api(`/recurring-schedules/${id}`, { method: 'DELETE' })
      pushToast('info', 'Deleted', scheduleName)
      load()
    } catch (err) {
      pushToast('error', 'Failed', err instanceof Error ? err.message : String(err))
    }
  }

  const partyName = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of parties) m.set(String(p.id), p.name)
    return (id: number | string) => m.get(String(id)) || `#${id}`
  }, [parties])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-800">
          <CalendarClock size={18} className="mr-1.5 inline text-slate-400" />
          Recurring Billing
        </h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 rounded bg-crimson-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-crimson-700"
        >
          <Plus size={14} />
          New Schedule
        </button>
      </div>

      {/* ── Create form ────────────────────────────────────── */}
      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">New Recurring Schedule</h3>
          {error && (
            <p className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-500">Schedule Name</label>
              <input
                value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Monthly office rent"
                className="h-[42px] w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-crimson-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Document Type</label>
              <SearchSelect
                value={docType}
                onChange={(v) => setDocType(v as DocType)}
                options={DOCTYPES.map((d) => ({ value: d.value, label: d.label }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Frequency</label>
              <SearchSelect
                value={frequency}
                onChange={(v) => setFrequency(v as RecurringFrequency)}
                options={FREQ_OPTIONS.map((f) => ({ value: f.value, label: f.label }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Day of Month</label>
              <input type="number" min={1} max={31} value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)}
                className="h-[42px] w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-crimson-500" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Party</label>
              <SearchSelect
                value={partyId}
                onChange={setPartyId}
                placeholder="Select party…"
                options={parties.map((p) => ({ value: p.id, label: p.name }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Start Date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="h-[42px] w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-crimson-500" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">End Date (optional)</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                className="h-[42px] w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-crimson-500" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Tax Rate %</label>
              <input type="number" min={0} max={100} step={0.1} value={taxRate} onChange={(e) => setTaxRate(e.target.value)}
                placeholder="0" className="h-[42px] w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-crimson-500" />
            </div>
          </div>

          {/* Line items */}
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-medium text-slate-500">Template Lines</label>
              <button type="button" onClick={addLine}
                className="text-xs text-crimson-600 hover:underline">+ Add line</button>
            </div>
            <div className="space-y-2">
              {lines.map((line, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={line.description} onChange={(e) => updateLine(i, 'description', e.target.value)}
                    placeholder="Description" className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-crimson-500" />
                  <input type="number" min={1} value={line.qty} onChange={(e) => updateLine(i, 'qty', e.target.value)}
                    className="w-16 rounded border border-slate-300 px-3 py-2 text-sm text-right outline-none focus:border-crimson-500" />
                  <input type="number" min={0} step={0.01} value={line.rate} onChange={(e) => updateLine(i, 'rate', e.target.value)}
                    placeholder="Rate" className="w-24 rounded border border-slate-300 px-3 py-2 text-sm text-right outline-none focus:border-crimson-500" />
                  <span className="w-24 text-right text-sm font-mono text-slate-600">
                    {fmt((Number(line.qty) || 1) * Number(line.rate || 0))}
                  </span>
                  {lines.length > 1 && (
                    <button type="button" onClick={() => removeLine(i)} className="text-slate-400 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3">
            <label className="mb-1 block text-xs font-medium text-slate-500">Narration</label>
            <input value={narration} onChange={(e) => setNarration(e.target.value)} placeholder="Optional note…"
              className="h-[42px] w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-crimson-500" />
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button type="submit" disabled={submitting}
              className="inline-flex h-[42px] items-center gap-1.5 rounded bg-crimson-600 px-4 text-sm font-medium text-white hover:bg-crimson-700 disabled:opacity-50">
              {submitting ? 'Creating…' : 'Create Schedule'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); resetForm() }}
              className="text-sm text-slate-500 hover:text-slate-700">Cancel</button>
          </div>
        </form>
      )}

      {/* ── Schedule list ──────────────────────────────────── */}
      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3 text-sm text-slate-500">
          Schedules{loading ? '' : ` (${schedules.length})`}
        </div>
        {loading && schedules.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-400">Loading…</p>
        ) : schedules.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <CalendarClock size={32} className="mx-auto mb-2 text-slate-300" />
            <p className="text-sm text-slate-400">No recurring schedules yet.</p>
            <p className="mt-1 text-xs text-slate-400">Create one to auto-generate invoices on a schedule.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Party</th>
                <th className="px-4 py-3">Frequency</th>
                <th className="px-4 py-3">Next Run</th>
                <th className="px-4 py-3">Generated</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {schedules.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{s.name}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {DOCTYPES.find((d) => d.value === s.docType)?.label || s.docType}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {s.party ? partyName(typeof s.party === 'object' ? s.party.id : s.party) : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-600 capitalize">{s.frequency}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(s.nextRunDate)}</td>
                  <td className="px-4 py-3 text-slate-600">{s.generatedCount || 0}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[s.status] || ''}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {s.status === 'active' && (
                        <button onClick={() => handleRunNow(String(s.id))} disabled={running === String(s.id)}
                          title="Generate invoice now"
                          className="inline-flex items-center gap-1 rounded p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-50">
                          <Zap size={14} />
                        </button>
                      )}
                      <button onClick={() => handleToggle(String(s.id), s.status)} title={s.status === 'active' ? 'Pause' : 'Resume'}
                        className={`inline-flex items-center gap-1 rounded p-1.5 ${s.status === 'active' ? 'text-amber-500 hover:bg-amber-50' : 'text-emerald-500 hover:bg-emerald-50'}`}>
                        {s.status === 'active' ? <Pause size={14} /> : <Play size={14} />}
                      </button>
                      <button onClick={() => handleDelete(String(s.id), s.name)} title="Delete"
                        className="inline-flex items-center gap-1 rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
