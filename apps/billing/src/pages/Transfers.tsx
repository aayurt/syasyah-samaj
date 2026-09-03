import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, Ban, Download } from 'lucide-react'
import { api, fmt } from '../lib/api'
import { downloadCsv } from '../lib/csv'
import { pushToast } from '../lib/toast'
import { useTenant } from '../lib/tenant'
import NepaliDateInput from '../components/NepaliDateInput'

type Account = {
  id: number
  name: string
  code?: string
  accountType?: string
}

type TransferLeg = {
  id: number
  date: string
  narration: string
  tenant: number | { id: number; name: string; code?: string }
  amount: number
}

type TransferGroup = {
  ref: string
  date: string
  legs: TransferLeg[]
}

const today = () => new Date().toISOString().slice(0, 10)

export default function Transfers() {
  const { tenants, isCentral } = useTenant()

  // ── Form state ──────────────────────────────────────────────────
  const [fromTenant, setFromTenant] = useState('')
  const [toTenant, setToTenant] = useState('')
  const [fromAccount, setFromAccount] = useState('')
  const [toAccount, setToAccount] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today())
  const [narration, setNarration] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Accounts for each side
  const [fromAccounts, setFromAccounts] = useState<Account[]>([])
  const [toAccounts, setToAccounts] = useState<Account[]>([])

  useEffect(() => { setFromAccount('') }, [fromTenant])
  useEffect(() => { setToAccount('') }, [toTenant])

  useEffect(() => {
    if (!fromTenant) { setFromAccounts([]); return }
    api<{ docs: Account[] }>('/accounts', {
      query: { tenant: fromTenant, limit: 500, depth: 0 },
    })
      .then((res) => setFromAccounts(res.docs || []))
      .catch(() => setFromAccounts([]))
  }, [fromTenant])

  useEffect(() => {
    if (!toTenant) { setToAccounts([]); return }
    api<{ docs: Account[] }>('/accounts', {
      query: { tenant: toTenant, limit: 500, depth: 0 },
    })
      .then((res) => setToAccounts(res.docs || []))
      .catch(() => setToAccounts([]))
  }, [toTenant])

  // ── Recent transfers ────────────────────────────────────────────
  const [groups, setGroups] = useState<TransferGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [voiding, setVoiding] = useState<string | null>(null)

  const loadTransfers = useCallback(async () => {
    setLoading(true)
    try {
      // immediate: bypass the collection cache — we need the where filter applied.
      const res = await api<{ docs: (TransferLeg & { transferRef?: string })[] }>(
        '/journal-entries',
        {
          immediate: true,
          query: {
            limit: 200,
            depth: 0,
            sort: '-createdAt',
            // Payload accepts URL-encoded JSON in the `where` param.
            where: JSON.stringify({ transferRef: { exists: true } }),
          },
        },
      )
      // Group legs by transferRef
      const byRef = new Map<string, TransferGroup>()
      for (const doc of res.docs || []) {
        if (!doc.transferRef) continue
        let g = byRef.get(doc.transferRef)
        if (!g) {
          g = { ref: doc.transferRef, date: doc.date, legs: [] }
          byRef.set(doc.transferRef, g)
        }
        g.legs.push(doc)
      }
      setGroups([...byRef.values()].sort((a, b) => b.date.localeCompare(a.date)))
    } catch {
      /* offline — list will populate after sync */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadTransfers() }, [loadTransfers])

  const tenantLabel = useMemo(() => {
    const m = new Map<string, string>()
    for (const t of tenants) m.set(t.id, `${t.code ? `${t.code} · ` : ''}${t.name}`)
    return m
  }, [tenants])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!fromTenant || !toTenant) { setError('Select both illakas.'); return }
    if (fromTenant === toTenant) { setError('From and To illakas must differ.'); return }
    const amt = Number(amount)
    if (!amt || amt <= 0) { setError('Enter a positive amount.'); return }
    if (!fromAccount || !toAccount) { setError('Select accounts on both sides.'); return }
    setSubmitting(true)
    try {
      const res = await api<{ message: string; transferRef: string; amount: number }>(
        '/journal-entries/transfers',
        {
          method: 'POST',
          immediate: true, // atomic server transaction — not queueable offline
          body: {
            fromTenant: Number(fromTenant),
            toTenant: Number(toTenant),
            amount: amt,
            fromAccount: Number(fromAccount),
            toAccount: Number(toAccount),
            date,
            narration: narration || undefined,
          },
        },
      )
      pushToast('success', 'Transfer posted', `${res.transferRef} — ${fmt(res.amount)} moved between illakas.`)
      setAmount(''); setNarration('')
      loadTransfers()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  const handleVoid = async (ref: string) => {
    if (!confirm(`Reverse both legs of transfer ${ref}? Reversal entries will be posted.`)) return
    setVoiding(ref)
    try {
      await api(`/journal-entries/transfers/${ref}/void`, { method: 'POST' })
      pushToast('success', 'Transfer reversed', `${ref} — both legs reversed.`)
      loadTransfers()
    } catch (err) {
      pushToast('error', 'Reversal failed', err instanceof Error ? err.message : String(err))
    } finally {
      setVoiding(null)
    }
  }

  if (!isCentral) {
    return (
      <div className="py-12 text-center text-sm text-slate-400">
        Cross-illaka transfers are performed by central roles only.
      </div>
    )
  }

  const illakaOpts = tenants.filter((t) => t.type !== 'central' || tenants.length <= 1)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-800">Cross-Illaka Transfers</h1>
        <button
          onClick={() =>
            downloadCsv(
              'transfers.csv',
              ['Ref', 'Date', 'Legs', 'Narration'],
              groups.map((g) => [
                g.ref,
                g.date,
                g.legs.map((l) => typeof l.tenant === 'object' ? l.tenant?.name : tenantLabel.get(String(l.tenant)) || String(l.tenant)).join(' → '),
                g.legs[0]?.narration || '',
              ]),
            )
          }
          disabled={groups.length === 0}
          className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"
        >
          <Download size={14} /> CSV
        </button>
      </div>

      {/* New transfer */}
      <form onSubmit={handleSubmit} className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">New Transfer</h3>
        {error && (
          <p className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-500">From Illaka</label>
            <select value={fromTenant} onChange={(e) => setFromTenant(e.target.value)}
              className="h-[42px] w-full min-h-[42px] rounded border border-slate-300 px-3 text-sm outline-none focus:border-crimson-500">
              <option value="">Select illaka…</option>
              {illakaOpts.filter((t) => t.id !== toTenant).map((t) => (
                <option key={t.id} value={t.id}>{t.code ? `${t.code} · ` : ''}{t.name}</option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-500">To Illaka</label>
            <select value={toTenant} onChange={(e) => setToTenant(e.target.value)}
              className="h-[42px] w-full min-h-[42px] rounded border border-slate-300 px-3 text-sm outline-none focus:border-crimson-500">
              <option value="">Select illaka…</option>
              {illakaOpts.filter((t) => t.id !== fromTenant).map((t) => (
                <option key={t.id} value={t.id}>{t.code ? `${t.code} · ` : ''}{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Amount (Rs)</label>
            <input type="number" min={0} step={0.01} placeholder="0.00" value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-[42px] w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-crimson-500" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Date</label>
            <NepaliDateInput compact value={date} onChange={setDate} />
          </div>
          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-500">From Account ({tenantLabel.get(fromTenant) ? `of ${tenantLabel.get(fromTenant)}` : 'select illaka'})</label>
            <select value={fromAccount} onChange={(e) => setFromAccount(e.target.value)} disabled={!fromTenant}
              className="h-[42px] w-full min-h-[42px] rounded border border-slate-300 px-3 text-sm outline-none focus:border-crimson-500 disabled:bg-slate-50 disabled:text-slate-400">
              <option value="">Select account…</option>
              {fromAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.code ? `${a.code} · ` : ''}{a.name}</option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-500">To Account ({tenantLabel.get(toTenant) ? `of ${tenantLabel.get(toTenant)}` : 'select illaka'})</label>
            <select value={toAccount} onChange={(e) => setToAccount(e.target.value)} disabled={!toTenant}
              className="h-[42px] w-full min-h-[42px] rounded border border-slate-300 px-3 text-sm outline-none focus:border-crimson-500 disabled:bg-slate-50 disabled:text-slate-400">
              <option value="">Select account…</option>
              {toAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.code ? `${a.code} · ` : ''}{a.name}</option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-1">
            <label className="mb-1 block text-xs font-medium text-slate-500">Narration</label>
            <input type="text" placeholder="Optional note…" value={narration}
              onChange={(e) => setNarration(e.target.value)}
              className="h-[42px] w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-crimson-500" />
          </div>
          <div className="flex items-end lg:col-span-1">
            <button type="submit" disabled={submitting}
              className="inline-flex h-[42px] w-full items-center justify-center gap-1.5 rounded bg-crimson-600 px-4 text-sm font-medium text-white hover:bg-crimson-700 disabled:opacity-50">
              <ArrowRight size={14} />
              {submitting ? 'Posting…' : 'Transfer'}
            </button>
          </div>
        </div>
      </form>

      {/* Recent transfers */}
      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3 text-sm text-slate-500">
          Recent transfers{loading ? '' : ` (${groups.length})`}
        </div>
        {loading && groups.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-400">Loading…</p>
        ) : groups.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-400">No transfers yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Ref</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Route</th>
                <th className="px-4 py-3">Narration</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {groups.map((g) => {
                const voided = g.legs.some((l) => l.narration?.includes('[VOID]'))
                return (
                  <tr key={g.ref} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{g.ref}</td>
                    <td className="px-4 py-3 text-slate-600">{g.date}</td>
                    <td className="px-4 py-3 text-slate-700">
                      <span className="inline-flex items-center gap-1">
                        {g.legs.map((l, i) => (
                          <span key={l.id}>
                            {i > 0 && <ArrowRight size={12} className="mx-1 inline text-slate-300" />}
                            {typeof l.tenant === 'object' ? l.tenant?.name : tenantLabel.get(String(l.tenant)) || `#${l.tenant}`}
                          </span>
                        ))}
                      </span>
                    </td>
                    <td className="max-w-[220px] truncate px-4 py-3 text-slate-500">{g.legs[0]?.narration || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${voided ? 'bg-slate-100 text-slate-500 line-through' : 'bg-emerald-100 text-emerald-700'}`}>
                        {voided ? 'Reversed' : 'Posted'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!voided && (
                        <button onClick={() => handleVoid(g.ref)} disabled={voiding === g.ref}
                          title="Reverse both legs"
                          className="inline-flex items-center gap-1 rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50">
                          <Ban size={14} />
                          {voiding === g.ref ? 'Reversing…' : ''}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
