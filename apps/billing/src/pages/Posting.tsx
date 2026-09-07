import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCheck, FilePenLine, Pencil } from 'lucide-react'
import { api, fmt, useSyncState } from '../lib/api'
import {
  DOC_TYPE_LABELS,
  type Document,
  effectiveAmount,
} from '../lib/types'
import { todayAD } from '../lib/nepaliDate'
import { pushToast } from '../lib/toast'
import { useCachedList } from '../lib/useCachedList'
import { useTenantQuery } from '../lib/tenant'
import { useCalendar } from '../lib/calendar'
import { StatusPill } from './Dashboard'
import SearchBox from '../components/SearchBox'
import DataStatus from '../components/DataStatus'
import { TableSkeleton } from '../components/Skeleton'

const ALL_TYPES = Object.entries(DOC_TYPE_LABELS).map(([value, label]) => ({ value, label }))

function partyName(p: Document['party']): string {
  if (!p) return '—'
  if (typeof p === 'object') return (p as { fullName?: string; name?: string }).fullName || (p as { name?: string }).name || `#${(p as { id: number }).id}`
  return `#${p}`
}

export default function Posting() {
  const navigate = useNavigate()
  const tenantQuery = useTenantQuery()
  const { docs, setDocs, loading } = useCachedList<Document>('documents', {
    sort: '-date',
    depth: 1,
    ...tenantQuery,
  })
  useSyncState()
  const { formatDate } = useCalendar()

  const [type, setType] = useState('')
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [busy, setBusy] = useState<Set<number>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)

  const drafts = useMemo(() => docs.filter((d) => d.status === 'draft'), [docs])
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return drafts.filter((d) => {
      if (type && d.docType !== type) return false
      if (!needle) return true
      return [d.number, d.docType, partyName(d.party), d.narration]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(needle))
    })
  }, [drafts, type, q])

  const grossTotal = useMemo(
    () => filtered.reduce((s, d) => s + effectiveAmount(d), 0),
    [filtered],
  )
  const allSelected = filtered.length > 0 && filtered.every((d) => selected.has(d.id))

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const toggleAll = () => {
    setSelected((prev) => {
      if (allSelected) {
        const next = new Set(prev)
        for (const d of filtered) next.delete(d.id)
        return next
      }
      const next = new Set(prev)
      for (const d of filtered) next.add(d.id)
      return next
    })
  }

  const postOne = async (id: number) => {
    setBusy((prev) => new Set(prev).add(id))
    try {
      await api(`/documents/${id}/post`, { method: 'POST' })
      setDocs((prev) => prev.map((d) => (d.id === id ? { ...d, status: 'posted' as const } : d)))
      pushToast('success', 'Transaction posted successfully')
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Posting failed')
    } finally {
      setBusy((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  const postSelected = async () => {
    const targets = filtered.filter((d) => selected.has(d.id) && d.status === 'draft')
    if (targets.length === 0) return
    if (!window.confirm(`Post ${targets.length} draft voucher(s) to the ledger?`)) return
    setBulkLoading(true)
    let ok = 0
    for (const d of targets) {
      try {
        await api(`/documents/${d.id}/post`, { method: 'POST' })
        ok += 1
      } catch (err) {
        pushToast('error', `${d.number || d.docType}: ${err instanceof Error ? err.message : 'failed'}`)
      }
    }
    setBulkLoading(false)
    if (ok > 0) {
      setSelected(new Set())
      pushToast('success', `Posted ${ok} of ${targets.length}`)
    }
  }

  const selectDraft = (d: Document) => {
    if (d.docType === 'journal-voucher') navigate('/vouchers')
    else navigate(`/vouchers/edit/${d.id}`)
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Posting</h1>
          <p className="text-sm text-slate-500">Review draft transactions and post them to the ledger.</p>
        </div>
        <button
          onClick={postSelected}
          disabled={bulkLoading || selected.size === 0}
          className="flex items-center gap-1.5 rounded-md bg-amber-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-40"
        >
          <CheckCheck size={15} />
          {bulkLoading ? 'Posting…' : `Post ${selected.size} Draft${selected.size === 1 ? '' : 's'}`}
        </button>
      </div>
      <div className="mt-2"><DataStatus /></div>

      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-3">
        {[
          { label: 'Draft Transactions', value: String(drafts.length) },
          { label: 'Filtered', value: String(filtered.length) },
          { label: 'Draft Value', value: fmt(grossTotal) },
        ].map((k) => (
          <div key={k.label} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">{k.label}</div>
            <div className="mt-1 font-mono text-lg font-semibold text-amber-700">{k.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <select
          value={type}
          onChange={(e) => { setType(e.target.value); setSelected(new Set()) }}
          className="w-48 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:border-amber-500 focus:outline-none"
        >
          <option value="">All types</option>
          {ALL_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <div className="w-64"><SearchBox value={q} onChange={setQ} placeholder="Search number, party, narration…" /></div>
        <div className="text-xs text-slate-400">as of {formatDate(todayAD())}</div>
      </div>

      {loading ? <div className="mt-4"><TableSkeleton rows={8} /></div> : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} className="accent-amber-700" />
                </th>
                <th className="px-3 py-2">Number</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Party</th>
                <th className="px-3 py-2">Narration</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={selected.has(d.id)} onChange={() => toggle(d.id)} className="accent-amber-700" />
                  </td>
                  <td className="px-3 py-2 font-medium text-slate-800">{d.number || `#${d.id}`}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-slate-600">{formatDate(d.date)}</td>
                  <td className="px-3 py-2 text-slate-600">{DOC_TYPE_LABELS[d.docType] || d.docType}</td>
                  <td className="px-3 py-2 text-slate-700">{partyName(d.party)}</td>
                  <td className="max-w-[220px] truncate px-3 py-2 text-slate-500">{d.narration || '—'}</td>
                  <td className="px-3 py-2 text-right font-mono text-slate-700">{fmt(effectiveAmount(d))}</td>
                  <td className="px-3 py-2"><StatusPill status={d.status} /></td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        title="Edit draft"
                        onClick={() => selectDraft(d)}
                        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        title={d.docType === 'journal-voucher' ? 'Edit in Vouchers' : 'Post now'}
                        onClick={() => postOne(d.id)}
                        disabled={busy.has(d.id) || bulkLoading}
                        className="flex items-center gap-1 rounded border border-amber-600 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-40"
                      >
                        <FilePenLine size={12} />
                        {busy.has(d.id) ? 'Posting…' : 'Post'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-10 text-center text-slate-400">
                    {drafts.length === 0 ? 'No draft transactions — everything is posted.' : 'No drafts match your filters.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}