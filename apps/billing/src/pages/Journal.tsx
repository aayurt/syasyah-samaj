import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { api, fmt, list, useSyncState } from '../lib/api'
import { useSortSearch } from '../lib/useSortSearch'
import ActionMenu from '../components/ActionMenu'
import SearchBox from '../components/SearchBox'
import SortableTh from '../components/SortableTh'
import { TableSkeleton } from '../components/Skeleton'
import type { Account, JournalEntry } from '../lib/types'
import { StatusPill } from './Dashboard'

interface LineDraft {
  key: string
  account: string
  debit: string
  credit: string
  memo: string
}

const emptyLine = (): LineDraft => ({
  key: crypto.randomUUID(),
  account: '',
  debit: '',
  credit: '',
  memo: '',
})

const emptyForm = {
  date: new Date().toISOString().slice(0, 10),
  narration: '',
  lines: [emptyLine(), emptyLine()],
}

export default function Journal() {
  const { cacheVersion } = useSyncState()
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [error, setError] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      const [e, a] = await Promise.all([
        list<JournalEntry>('journal-entries', {
          depth: 0,
          sort: '-date',
        }),
        list<Account>('gl-accounts', { depth: 0, sort: 'name' }),
      ])
      setEntries(e.docs)
      setAccounts(a.docs)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load journal')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [cacheVersion])

  const totals = useMemo(() => {
    let debit = 0
    let credit = 0
    for (const l of form.lines) {
      debit += parseFloat(l.debit) || 0
      credit += parseFloat(l.credit) || 0
    }
    return { debit, credit, diff: debit - credit }
  }, [form.lines])

  const setLine = (key: string, patch: Partial<LineDraft>) => {
    setForm((f) => ({
      ...f,
      lines: f.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)),
    }))
  }

  const removeLine = (key: string) => {
    setForm((f) =>
      f.lines.length > 1
        ? { ...f, lines: f.lines.filter((l) => l.key !== key) }
        : f,
    )
  }

  const submit = async (status: 'draft' | 'posted') => {
    setSaving(true)
    setError('')
    try {
      await api('/journal-entries', {
        method: 'POST',
        body: {
          date: form.date,
          narration: form.narration || undefined,
          status,
          lines: form.lines.map((l) => ({
            account: Number(l.account),
            debit: l.debit ? parseFloat(l.debit) : undefined,
            credit: l.credit ? parseFloat(l.credit) : undefined,
            memo: l.memo || undefined,
          })),
        },
      })
      setForm({ ...emptyForm, date: form.date })
      setShowForm(false)
      await load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save entry')
    }
    setSaving(false)
  }

  const voidEntry = async (id: number) => {
    if (!window.confirm('Void this posted entry? This cannot be undone.')) return
    try {
      await api(`/journal-entries/${id}`, {
        method: 'PATCH',
        body: { status: 'void' },
      })
      await load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to void entry')
    }
  }

  const filtered = entries.filter(
    (e) => !filter || e.status === filter,
  )

  const entryLines = (e: JournalEntry) =>
    Array.isArray(e.lines) ? e.lines : []

  const { query, setQuery, sort, toggleSort, visible } = useSortSearch(filtered, {
    searchable: (e) => `${e.narration || ''} ${e.status}`,
    valueOf: (e, key) => {
      switch (key) {
        case 'debit':
          return entryLines(e).reduce((s, l) => s + (Number(l.debit) || 0), 0)
        case 'credit':
          return entryLines(e).reduce((s, l) => s + (Number(l.credit) || 0), 0)
        default:
          return (e as unknown as Record<string, unknown>)[key] as
            | string
            | number
            | undefined
      }
    },
    defaultSort: { key: 'date', dir: 'desc' },
  })

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Journal</h1>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <Plus size={14} />
          New entry
        </button>
      </div>

      {error && (
        <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {showForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit('draft')
          }}
          className="mt-4 rounded-lg border border-slate-200 bg-white p-4"
        >
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <label className="text-sm text-slate-700">
              Date
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              />
            </label>
            <label className="col-span-2 text-sm text-slate-700 md:col-span-3">
              Narration
              <input
                value={form.narration}
                onChange={(e) => setForm({ ...form, narration: e.target.value })}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                placeholder="e.g. Rent for March, member donation…"
              />
            </label>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-2">Account</th>
                  <th className="w-28 py-2 pr-2">Debit</th>
                  <th className="w-28 py-2 pr-2">Credit</th>
                  <th className="py-2 pr-2">Memo</th>
                  <th className="w-8 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {form.lines.map((l) => (
                  <tr key={l.key}>
                    <td className="py-1.5 pr-2">
                      <select
                        required
                        value={l.account}
                        onChange={(e) =>
                          setLine(l.key, { account: e.target.value })
                        }
                        className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-slate-500"
                      >
                        <option value="">— select account —</option>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.code ? `${a.code} · ` : ''}
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1.5 pr-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={l.debit}
                        onChange={(e) =>
                          setLine(l.key, {
                            debit: e.target.value,
                            credit: l.credit ? '' : l.credit,
                          })
                        }
                        className="w-full rounded border border-slate-300 px-2 py-1.5 text-right font-mono outline-none focus:border-slate-500"
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={l.credit}
                        onChange={(e) =>
                          setLine(l.key, {
                            credit: e.target.value,
                            debit: l.debit ? '' : l.debit,
                          })
                        }
                        className="w-full rounded border border-slate-300 px-2 py-1.5 text-right font-mono outline-none focus:border-slate-500"
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <input
                        value={l.memo}
                        onChange={(e) => setLine(l.key, { memo: e.target.value })}
                        className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-slate-500"
                      />
                    </td>
                    <td className="py-1.5">
                      <button
                        type="button"
                        onClick={() => removeLine(l.key)}
                        className="text-slate-400 hover:text-red-600"
                        aria-label="Remove line"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-100">
                  <td className="py-2 pr-2 text-xs uppercase tracking-wide text-slate-500">
                    Totals
                  </td>
                  <td className="py-2 pr-2 text-right font-mono text-slate-800">
                    {fmt(totals.debit)}
                  </td>
                  <td className="py-2 pr-2 text-right font-mono text-slate-800">
                    {fmt(totals.credit)}
                  </td>
                  <td
                    className={`py-2 pl-4 text-xs font-medium ${
                      Math.abs(totals.diff) < 0.001
                        ? 'text-emerald-600'
                        : 'text-red-600'
                    }`}
                  >
                    {Math.abs(totals.diff) < 0.001
                      ? '✓ balanced'
                      : `difference ${fmt(totals.diff)}`}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="mt-2">
            <button
              type="button"
              onClick={() =>
                setForm((f) => ({ ...f, lines: [...f.lines, emptyLine()] }))
              }
              className="text-xs font-medium text-slate-500 hover:text-slate-800"
            >
              + Add line
            </button>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => submit('draft')}
              disabled={saving}
              className="rounded border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save draft'}
            </button>
            <button
              type="button"
              onClick={() => submit('posted')}
              disabled={saving || Math.abs(totals.diff) >= 0.001}
              className="rounded bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
              title={
                Math.abs(totals.diff) >= 0.001
                  ? 'Entry must be balanced to post'
                  : 'Post this entry to the ledger'
              }
            >
              Post
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded border border-slate-300 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <TableSkeleton />
      ) : (
        <>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-slate-500">
            Filter
          </span>
          {['', 'draft', 'posted', 'void'].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded px-2.5 py-1 text-xs font-medium ${
                filter === s
                  ? 'bg-crimson-600 text-white'
                  : 'border border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {s || 'all'}
          </button>
          ))}
        </div>
        <SearchBox
          value={query}
          onChange={setQuery}
          placeholder="Search narration…"
        />
      </div>

      <div className="mt-3 rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
              <SortableTh label="Date" sortKey="date" sort={sort} onSort={toggleSort} />
              <SortableTh label="Narration" sortKey="narration" sort={sort} onSort={toggleSort} />
              <SortableTh label="Debit" sortKey="debit" sort={sort} onSort={toggleSort} />
              <SortableTh label="Credit" sortKey="credit" sort={sort} onSort={toggleSort} />
              <SortableTh label="Status" sortKey="status" sort={sort} onSort={toggleSort} />
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  No entries.
                </td>
              </tr>
            )}
            {visible.map((e) => {
              // Guard against stale cached rows that lack the `lines` array
              // (e.g. ledger rows cached before the read-cache was scoped to
              // plain collection lists) — render zeros instead of crashing.
              const lines = Array.isArray(e.lines) ? e.lines : []
              const debit = lines.reduce(
                (s, l) => s + (Number(l.debit) || 0),
                0,
              )
              const credit = lines.reduce(
                (s, l) => s + (Number(l.credit) || 0),
                0,
              )
              return (
                <tr key={e.id} className="border-b border-slate-50">
                  <td className="px-4 py-2 text-slate-600">
                    {e.date?.slice(0, 10)}
                  </td>
                  <td className="px-4 py-2 text-slate-800">
                    {e.narration || '—'}
                  </td>
                  <td className="px-4 py-2 font-mono text-slate-700">
                    {fmt(debit)}
                  </td>
                  <td className="px-4 py-2 font-mono text-slate-700">
                    {fmt(credit)}
                  </td>
                  <td className="px-4 py-2">
                    <StatusPill status={e.status} />
                  </td>
                  <td className="px-4 py-2 text-right">
                    {e.status === 'posted' && (
                      <ActionMenu
                        items={[
                          {
                            label: 'Void',
                            danger: true,
                            onClick: () => voidEntry(e.id),
                          },
                        ]}
                      />
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
        </>
      )}
    </div>
  )
}
