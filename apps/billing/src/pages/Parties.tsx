import { useCallback, useEffect, useState } from 'react'
import { Download, Pencil, Plus, Trash2 } from 'lucide-react'
import { api, list, useSyncState } from '../lib/api'
import { downloadCsv } from '../lib/csv'
import { type SortState, useSortSearch } from '../lib/useSortSearch'
import ActionMenu from '../components/ActionMenu'
import SearchBox from '../components/SearchBox'
import SortableTh from '../components/SortableTh'
import { TableSkeleton } from '../components/Skeleton'
import DataStatus from '../components/DataStatus'
import { useSearchParams } from 'react-router-dom'
import { useTenant, useTenantQuery } from '../lib/tenant'
import type { Account, Party } from '../lib/types'

const TYPES: Party['type'][] = ['customer', 'vendor', 'both']
const TYPE_LABELS: Record<string, string> = {
  customer: 'Customer',
  vendor: 'Vendor',
  both: 'Customer & Vendor',
}

const emptyForm = {
  type: 'customer' as Party['type'],
  name: '',
  email: '',
  phone: '',
  taxId: '',
  address: '',
  openingBalance: '',
  receivableAccount: '',
  payableAccount: '',
}

export default function Parties() {
  const { cacheVersion } = useSyncState()
  const { tenantId } = useTenant()
  const tenantQuery = useTenantQuery()
  const [parties, setParties] = useState<Party[]>([])
  const [error, setError] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [accounts, setAccounts] = useState<Account[]>([])

  const load = async () => {
    setLoading(true)
    try {
      const [res, glRes] = await Promise.all([
        list<Party>('parties', { depth: 0, sort: 'name', ...tenantQuery }),
        list<Account>('gl-accounts', {
          depth: 0,
          sort: 'code',
          limit: 1000,
          where: { type: { in: ['asset', 'liability'] } } as unknown as string,
          ...tenantQuery,
        }),
      ])
      setParties(res.docs)
      setAccounts(glRes.docs)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load parties')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [cacheVersion, tenantId])

  const openNew = () => {
    setForm(emptyForm)
    setEditing(null)
    setShowForm((s) => !s)
  }

  const startEdit = (p: Party) => {
    setForm({
      type: p.type,
      name: p.name,
      email: p.email || '',
      phone: p.phone || '',
      taxId: p.taxId || '',
      address: p.address || '',
      openingBalance: p.openingBalance ? String(p.openingBalance) : '',
      receivableAccount: p.receivableAccount
        ? String(typeof p.receivableAccount === 'object' ? (p.receivableAccount as Account).id : p.receivableAccount)
        : '',
      payableAccount: p.payableAccount
        ? String(typeof p.payableAccount === 'object' ? (p.payableAccount as Account).id : p.payableAccount)
        : '',
    })
    setEditing(p.id)
    setShowForm(true)
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const body = {
        type: form.type,
        name: form.name,
        email: form.email || undefined,
        phone: form.phone || undefined,
        taxId: form.taxId || undefined,
        address: form.address || undefined,
        openingBalance: form.openingBalance ? Number(form.openingBalance) : 0,
        receivableAccount: form.receivableAccount || undefined,
        payableAccount: form.payableAccount || undefined,
        ...(tenantId ? { tenant: tenantId } : {}),
      }
      if (editing) {
        await api(`/parties/${editing}`, { method: 'PATCH', body })
      } else {
        await api('/parties', { method: 'POST', body })
      }
      setForm(emptyForm)
      setEditing(null)
      setShowForm(false)
      await load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : editing ? 'Failed to update party' : 'Failed to create party')
    }
    setSaving(false)
  }

  const remove = async (id: number) => {
    if (!window.confirm('Delete this party?')) return
    try {
      // Queued to the offline outbox — resolves local ids, and if the row
      // hasn't synced yet the optimistic row is simply dropped. When offline
      // the delete flushes on reconnect (api() toasts "queued").
      await api(`/parties/${id}`, { method: 'DELETE' })
      await load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete party')
    }
  }

  const filtered = parties.filter(
    (p) => !filter || p.type === filter || (filter === 'both' && p.type === 'both'),
  )

  const [searchParams, setSearchParams] = useSearchParams()
  const urlSortKey = searchParams.get('sort') || 'name'
  const urlSortDir = (searchParams.get('dir') as 'asc' | 'desc') || 'asc'
  const urlQuery = searchParams.get('q') || ''

  const syncToUrl = useCallback((_q: string, s: SortState) => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      if (_q) params.set('q', _q); else params.delete('q')
      if (s.key && s.key !== 'name') params.set('sort', s.key); else params.delete('sort')
      if (s.key && s.dir !== 'asc') params.set('dir', s.dir); else params.delete('dir')
      return params
    }, { replace: true })
  }, [setSearchParams])

  const { query, setQuery, sort, toggleSort, visible } = useSortSearch(filtered, {
    searchable: (p) =>
      [p.name, p.email || '', p.phone || '', p.taxId || '', p.type].join(' '),
    valueOf: (p, key) => {
      switch (key) {
        case 'opening':
          return Number(p.openingBalance) || 0
        default:
          return (p as unknown as Record<string, unknown>)[key] as
            | string
            | number
            | undefined
      }
    },
    defaultSort: { key: 'name', dir: 'asc' },
    initialQuery: urlQuery,
    initialSort: { key: urlSortKey, dir: urlSortDir },
    onChange: syncToUrl,
  })

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Parties</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => downloadCsv('parties.csv', ['Name', 'Type', 'Phone', 'Email', 'Opening Balance'],
              visible.map((p) => [p.name, p.type, p.phone || '', p.email || '', p.openingBalance || 0]))
            }
            disabled={visible.length === 0}
            className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            <Download size={14} /> CSV
          </button>
          <button
            onClick={openNew}
            className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Plus size={14} />
            New party
          </button>
        </div>
      </div>

      <div className="mt-2">
        <DataStatus />
      </div>

      {error && (
        <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {showForm && (
        <form
          onSubmit={save}
          className="mt-4 rounded-lg border border-slate-200 bg-white p-4"
        >
          <h3 className="mb-3 text-sm font-semibold text-slate-700">
            {editing ? 'Edit Party' : 'New Party'}
          </h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <label className="text-sm text-slate-700">
              Name *
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              />
            </label>
            <label className="text-sm text-slate-700">
              Type
              <select
                value={form.type}
                onChange={(e) =>
                  setForm({ ...form, type: e.target.value as Party['type'] })
                }
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-slate-700">
              Email
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              />
            </label>
            <label className="text-sm text-slate-700">
              Phone
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              />
            </label>
            <label className="text-sm text-slate-700">
              Tax ID / PAN
              <input
                value={form.taxId}
                onChange={(e) => setForm({ ...form, taxId: e.target.value })}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              />
            </label>
            <label className="text-sm text-slate-700">
              Opening balance
              <input
                type="number"
                step="0.01"
                value={form.openingBalance}
                onChange={(e) =>
                  setForm({ ...form, openingBalance: e.target.value })
                }
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              />
            </label>
            <label className="text-sm text-slate-700">
              AR account (optional)
              <select
                value={form.receivableAccount}
                onChange={(e) => setForm({ ...form, receivableAccount: e.target.value })}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              >
                <option value="">Default (global AR)</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code ? `${a.code} — ` : ''}{a.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-slate-700">
              AP account (optional)
              <select
                value={form.payableAccount}
                onChange={(e) => setForm({ ...form, payableAccount: e.target.value })}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              >
                <option value="">Default (global AP)</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code ? `${a.code} — ` : ''}{a.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="col-span-2 text-sm text-slate-700 md:col-span-3">
              Address
              <textarea
                rows={2}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              />
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded bg-crimson-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-crimson-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : editing ? 'Update' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setEditing(null) }}
              className="rounded border border-slate-300 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading && parties.length === 0 ? (
        <TableSkeleton />
      ) : (
        <>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-slate-500">
            Filter
          </span>
          {['', ...TYPES].map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`rounded px-2.5 py-1 text-xs font-medium ${
                filter === t
                  ? 'bg-crimson-600 text-white'
                  : 'border border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t === '' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
          ))}
        </div>
        <SearchBox
          value={query}
          onChange={setQuery}
          placeholder="Search name, email, phone…"
        />
      </div>

      <div className="mt-3 rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
              <SortableTh label="Name" sortKey="name" sort={sort} onSort={toggleSort} />
              <SortableTh label="Type" sortKey="type" sort={sort} onSort={toggleSort} />
              <SortableTh label="Email" sortKey="email" sort={sort} onSort={toggleSort} />
              <SortableTh label="Phone" sortKey="phone" sort={sort} onSort={toggleSort} />
              <SortableTh label="Tax ID" sortKey="taxId" sort={sort} onSort={toggleSort} />
              <SortableTh label="Opening" sortKey="opening" sort={sort} onSort={toggleSort} align="right" />
              <th className="px-4 py-2">Accounts</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                  No parties yet.
                </td>
              </tr>
            )}
            {visible.map((p) => (
              <tr key={p.id} className="border-b border-slate-50">
                <td className="px-4 py-2 font-medium text-slate-800">
                  {p.name}
                </td>
                <td className="px-4 py-2 text-slate-500">
                  {TYPE_LABELS[p.type] || p.type}
                </td>
                <td className="px-4 py-2 text-slate-600">{p.email || '—'}</td>
                <td className="px-4 py-2 text-slate-600">{p.phone || '—'}</td>
                <td className="px-4 py-2 font-mono text-slate-500">
                  {p.taxId || '—'}
                </td>
                <td className="px-4 py-2 text-right font-mono text-slate-700">
                  {Number(p.openingBalance || 0).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                  })}
                </td>
                <td className="px-4 py-2 text-xs text-slate-500">
                  {(() => {
                    const ids = [
                      p.receivableAccount && 'AR',
                      p.payableAccount && 'AP',
                    ].filter(Boolean)
                    return ids.length ? ids.join(' · ') : '—'
                  })()}
                </td>
                <td className="px-4 py-2 text-right">
                  <ActionMenu
                    items={[
                      {
                        label: 'Edit',
                        icon: <Pencil size={13} />,
                        onClick: () => startEdit(p),
                      },
                      {
                        label: 'Delete',
                        icon: <Trash2 size={13} />,
                        danger: true,
                        onClick: () => remove(p.id),
                      },
                    ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
        </>
      )}
    </div>
  )
}
