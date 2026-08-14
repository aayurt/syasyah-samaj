import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { api, list, useSyncState } from '../lib/api'
import { TableSkeleton } from '../components/Skeleton'
import type { Party } from '../lib/types'

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
}

export default function Parties() {
  const { cacheVersion } = useSyncState()
  const [parties, setParties] = useState<Party[]>([])
  const [error, setError] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      const res = await list<Party>('parties', { depth: 0, sort: 'name' })
      setParties(res.docs)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load parties')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [cacheVersion])

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api('/parties', {
        method: 'POST',
        body: {
          type: form.type,
          name: form.name,
          email: form.email || undefined,
          phone: form.phone || undefined,
          taxId: form.taxId || undefined,
          address: form.address || undefined,
          openingBalance: form.openingBalance ? Number(form.openingBalance) : 0,
        },
      })
      setForm(emptyForm)
      setShowForm(false)
      await load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create party')
    }
    setSaving(false)
  }

  const remove = async (id: number) => {
    if (!window.confirm('Delete this party?')) return
    try {
      await api(`/parties/${id}`, { method: 'DELETE' })
      await load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete party')
    }
  }

  const visible = parties.filter(
    (p) => !filter || p.type === filter || (filter === 'both' && p.type === 'both'),
  )

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Parties</h1>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <Plus size={14} />
          New party
        </button>
      </div>

      {error && (
        <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {showForm && (
        <form
          onSubmit={create}
          className="mt-4 rounded-lg border border-slate-200 bg-white p-4"
        >
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
              {saving ? 'Saving…' : 'Save'}
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
      <div className="mt-6 flex items-center gap-2">
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
            {t || 'all'}
          </button>
        ))}
      </div>

      <div className="mt-3 rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Phone</th>
              <th className="px-4 py-2">Tax ID</th>
              <th className="px-4 py-2 text-right">Opening</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
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
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => remove(p.id)}
                    className="text-xs text-slate-400 hover:text-red-600"
                  >
                    delete
                  </button>
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
