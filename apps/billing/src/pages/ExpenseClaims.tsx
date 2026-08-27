import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle, FileText, Plus, Receipt, Send, Trash2, XCircle, DollarSign } from 'lucide-react'
import { api, fmt } from '../lib/api'
import { useTenant, useTenantQuery } from '../lib/tenant'
import { pushToast } from '../lib/toast'
import type { ExpenseClaim, Party, Account } from '../lib/types'

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  submitted: 'bg-blue-100 text-blue-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-600',
  reimbursed: 'bg-purple-100 text-purple-700',
}

const today = () => new Date().toISOString().slice(0, 10)

type LineDraft = { description: string; amount: string; accountId: string }

export default function ExpenseClaims() {
  const tenantQuery = useTenantQuery()
  const { isCentral } = useTenant()

  // ── List ───────────────────────────────────────────────────────
  const [claims, setClaims] = useState<ExpenseClaim[]>([])
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api<{ docs: ExpenseClaim[] }>(
        '/expense-claims',
        { query: { limit: 500, depth: 0, sort: '-date', ...tenantQuery } },
      )
      setClaims(res.docs || [])
    } catch { /* */ } finally { setLoading(false) }
  }, [tenantQuery])
  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    if (filter === 'all') return claims
    if (filter === 'billable') return claims.filter((c) => c.billable && !c.billedInvoiceId && ['approved', 'reimbursed'].includes(c.status))
    return claims.filter((c) => c.status === filter)
  }, [claims, filter])

  // ── Related data ───────────────────────────────────────────────
  const [parties, setParties] = useState<Party[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  useEffect(() => {
    api<{ docs: Party[] }>('/parties', { query: { limit: 500, sort: 'name', ...tenantQuery } }).then((r) => setParties(r.docs || [])).catch(() => {})
    api<{ docs: Account[] }>('/accounts', { query: { limit: 500, sort: 'name', ...tenantQuery } }).then((r) => setAccounts(r.docs || [])).catch(() => {})
  }, [tenantQuery])

  const partyName = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of parties) m.set(String(p.id), p.name)
    return (id: number | string) => m.get(String(id)) || `#${id}`
  }, [parties])

  // ── Create form ────────────────────────────────────────────────
  const [showForm, setShowForm] = useState(false)
  const [claimant, setClaimant] = useState('')
  const [date, setDate] = useState(today())
  const [billable, setBillable] = useState(false)
  const [partyId, setPartyId] = useState('')
  const [lines, setLines] = useState<LineDraft[]>([{ description: '', amount: '', accountId: '' }])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const addLine = () => setLines([...lines, { description: '', amount: '', accountId: '' }])
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i))
  const updateLine = (i: number, field: keyof LineDraft, val: string) => {
    const next = [...lines]; next[i] = { ...next[i], [field]: val }; setLines(next)
  }

  const total = useMemo(() => lines.reduce((s, l) => s + (Number(l.amount) || 0), 0), [lines])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('')
    if (!claimant.trim()) { setError('Claimant name is required.'); return }
    if (lines.some((l) => !l.description.trim() || !Number(l.amount))) {
      setError('Each line needs a description and amount.'); return
    }
    setSubmitting(true)
    try {
      await api('/expense-claims', {
        method: 'POST',
        body: {
          claimNumber: `EC-${Date.now().toString(36).toUpperCase()}`,
          claimant: claimant.trim(),
          date,
          status: 'draft',
          billable,
          party: billable && partyId ? Number(partyId) : undefined,
          lines: lines.map((l) => ({
            description: l.description.trim(),
            amount: Number(l.amount),
            account: l.accountId ? Number(l.accountId) : undefined,
          })),
          totalAmount: total,
        },
      })
      pushToast('success', 'Claim created', `₹${fmt(total)}`)
      setShowForm(false); resetForm(); load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally { setSubmitting(false) }
  }

  const resetForm = () => {
    setClaimant(''); setDate(today()); setBillable(false); setPartyId('')
    setLines([{ description: '', amount: '', accountId: '' }])
  }

  // ── Workflow actions ───────────────────────────────────────────
  const act = async (id: string, action: string, body?: any) => {
    setActionId(id)
    try {
      await api(`/expense-claims/${id}/${action}`, { method: 'POST', body })
      pushToast('success', `Claim ${action}d`, '')
      load()
    } catch (err) {
      pushToast('error', 'Failed', err instanceof Error ? err.message : String(err))
    } finally { setActionId(null) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this claim?')) return
    try { await api(`/expense-claims/${id}`, { method: 'DELETE' }); pushToast('info', 'Deleted', ''); load() }
    catch (err) { pushToast('error', 'Failed', err instanceof Error ? err.message : String(err)) }
  }

  // ── Bill to customer ───────────────────────────────────────────
  const [billingParty, setBillingParty] = useState('')
  const handleBillToCustomer = async () => {
    if (!billingParty) { pushToast('error', 'Select a party', ''); return }
    setActionId('bill')
    try {
      const res = await api<{ invoiceId: number; netTotal: number; claimsCount: number }>(
        '/expense-claims/bill-to-customer',
        { method: 'POST', body: { party: Number(billingParty) } },
      )
      pushToast('success', 'Invoice created', `#${res.invoiceId} — ${fmt(res.netTotal)} (${res.claimsCount} claims)`)
      setBillingParty(''); load()
    } catch (err) {
      pushToast('error', 'Failed', err instanceof Error ? err.message : String(err))
    } finally { setActionId(null) }
  }

  const billableCount = useMemo(() => claims.filter((c) => c.billable && !c.billedInvoiceId && ['approved', 'reimbursed'].includes(c.status)).length, [claims])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-800">
          <Receipt size={18} className="mr-1.5 inline text-slate-400" />
          Expense Claims
        </h1>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 rounded bg-crimson-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-crimson-700">
          <Plus size={14} /> New Claim
        </button>
      </div>

      {/* ── Billable summary ─────────────────────────────────── */}
      {billableCount > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <DollarSign size={16} className="text-amber-600" />
          <span className="text-sm text-amber-800">{billableCount} billable claim(s) ready to invoice</span>
          <select value={billingParty} onChange={(e) => setBillingParty(e.target.value)}
            className="ml-auto h-[34px] rounded border border-amber-300 px-2 text-sm outline-none">
            <option value="">Select customer…</option>
            {parties.filter((p) => p.type === 'customer' || p.type === 'both').map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button onClick={handleBillToCustomer} disabled={!billingParty || actionId === 'bill'}
            className="rounded bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50">
            {actionId === 'bill' ? 'Creating…' : 'Create Invoice'}
          </button>
        </div>
      )}

      {/* ── Filter tabs ──────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {['all', 'draft', 'submitted', 'approved', 'rejected', 'reimbursed', 'billable'].map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
              filter === f ? 'bg-crimson-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}>
            {f}{f === 'billable' && billableCount > 0 ? ` (${billableCount})` : ''}
          </button>
        ))}
      </div>

      {/* ── Create form ──────────────────────────────────────── */}
      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">New Expense Claim</h3>
          {error && <p className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Claimant</label>
              <input value={claimant} onChange={(e) => setClaimant(e.target.value)} placeholder="Employee name"
                className="h-[42px] w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-crimson-500" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="h-[42px] w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-crimson-500" />
            </div>
            <div className="flex items-end gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)} className="rounded" />
                Billable to customer
              </label>
            </div>
          </div>
          {billable && (
            <div className="mt-2">
              <label className="mb-1 block text-xs font-medium text-slate-500">Customer</label>
              <select value={partyId} onChange={(e) => setPartyId(e.target.value)}
                className="h-[42px] w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-crimson-500">
                <option value="">Select customer…</option>
                {parties.filter((p) => p.type === 'customer' || p.type === 'both').map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Lines */}
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-medium text-slate-500">Expense Lines</label>
              <button type="button" onClick={addLine} className="text-xs text-crimson-600 hover:underline">+ Add line</button>
            </div>
            <div className="space-y-2">
              {lines.map((line, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={line.description} onChange={(e) => updateLine(i, 'description', e.target.value)}
                    placeholder="Description" className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-crimson-500" />
                  <input type="number" min={0} step={0.01} value={line.amount} onChange={(e) => updateLine(i, 'amount', e.target.value)}
                    placeholder="Amount" className="w-28 rounded border border-slate-300 px-3 py-2 text-sm text-right outline-none focus:border-crimson-500" />
                  <select value={line.accountId} onChange={(e) => updateLine(i, 'accountId', e.target.value)}
                    className="w-48 rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-crimson-500">
                    <option value="">Expense account…</option>
                    {accounts.filter((a) => a.type === 'expense').map((a) => (
                      <option key={a.id} value={a.id}>{a.code ? `${a.code} · ` : ''}{a.name}</option>
                    ))}
                  </select>
                  {lines.length > 1 && (
                    <button type="button" onClick={() => removeLine(i)} className="text-slate-400 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-2 text-right text-sm font-medium text-slate-700">Total: {fmt(total)}</p>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button type="submit" disabled={submitting}
              className="inline-flex h-[42px] items-center gap-1.5 rounded bg-crimson-600 px-4 text-sm font-medium text-white hover:bg-crimson-700 disabled:opacity-50">
              {submitting ? 'Creating…' : 'Create Claim'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); resetForm() }} className="text-sm text-slate-500 hover:text-slate-700">Cancel</button>
          </div>
        </form>
      )}

      {/* ── Claims list ──────────────────────────────────────── */}
      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3 text-sm text-slate-500">
          Claims{loading ? '' : ` (${filtered.length})`}
        </div>
        {loading && claims.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-400">Loading…</p>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <Receipt size={32} className="mx-auto mb-2 text-slate-300" />
            <p className="text-sm text-slate-400">No expense claims yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Number</th>
                <th className="px-4 py-3">Claimant</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Billable</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{c.claimNumber}</td>
                  <td className="px-4 py-3 text-slate-800">{c.claimant}</td>
                  <td className="px-4 py-3 text-slate-600">{c.date}</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-700">{fmt(c.totalAmount || 0)}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {c.billable ? (
                      c.billedInvoiceId ? (
                        <span className="text-emerald-600">Invoiced #{c.billedInvoiceId}</span>
                      ) : (
                        <span className="text-amber-600">→ {c.party ? partyName(typeof c.party === 'object' ? c.party.id : c.party) : '—'}</span>
                      )
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[c.status] || ''}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {c.status === 'draft' && (
                        <button onClick={() => act(String(c.id), 'submit')} disabled={actionId === String(c.id)}
                          title="Submit for approval"
                          className="inline-flex items-center gap-1 rounded p-1.5 text-blue-500 hover:bg-blue-50 disabled:opacity-50">
                          <Send size={14} />
                        </button>
                      )}
                      {c.status === 'submitted' && (
                        <>
                          <button onClick={() => act(String(c.id), 'approve')} disabled={actionId === String(c.id)}
                            title="Approve"
                            className="inline-flex items-center gap-1 rounded p-1.5 text-emerald-500 hover:bg-emerald-50 disabled:opacity-50">
                            <CheckCircle size={14} />
                          </button>
                          <button onClick={() => act(String(c.id), 'reject')} disabled={actionId === String(c.id)}
                            title="Reject"
                            className="inline-flex items-center gap-1 rounded p-1.5 text-red-500 hover:bg-red-50 disabled:opacity-50">
                            <XCircle size={14} />
                          </button>
                        </>
                      )}
                      {c.status === 'approved' && (
                        <button onClick={() => act(String(c.id), 'reimburse')} disabled={actionId === String(c.id)}
                          title="Mark as reimbursed"
                          className="inline-flex items-center gap-1 rounded p-1.5 text-purple-500 hover:bg-purple-50 disabled:opacity-50">
                          <DollarSign size={14} />
                        </button>
                      )}
                      {c.status === 'draft' && (
                        <button onClick={() => handleDelete(String(c.id))} title="Delete"
                          className="inline-flex items-center gap-1 rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500">
                          <Trash2 size={14} />
                        </button>
                      )}
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
