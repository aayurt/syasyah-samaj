import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { api, list, useSyncState } from '../lib/api'
import { useSortSearch } from '../lib/useSortSearch'
import ActionMenu from '../components/ActionMenu'
import SearchBox from '../components/SearchBox'
import SortableTh from '../components/SortableTh'
import type { Account, AccountGroup, AccountType } from '../lib/types'

const TYPES: AccountType[] = ['asset', 'liability', 'equity', 'income', 'expense']
const TYPE_LABELS: Record<string, string> = {
  asset: 'Assets',
  liability: 'Liabilities',
  equity: 'Equity',
  income: 'Income',
  expense: 'Expenses',
}

const emptyForm = {
  name: '',
  code: '',
  type: 'asset' as AccountType,
  class: 'other',
  group: '',
  openingBalance: '',
}

export default function Accounts() {
  const { cacheVersion } = useSyncState()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [groups, setGroups] = useState<AccountGroup[]>([])
  const [error, setError] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const load = async () => {
    try {
      const [a, g] = await Promise.all([
        list<Account>('gl-accounts', { depth: 1, sort: 'name' }),
        list<AccountGroup>('account-groups', { depth: 0, sort: 'name' }),
      ])
      setAccounts(a.docs)
      setGroups(g.docs)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load accounts')
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
      await api('/gl-accounts', {
        method: 'POST',
        body: {
          name: form.name,
          code: form.code || undefined,
          type: form.type,
          class: form.class,
          group: form.group ? Number(form.group) : undefined,
          openingBalance: form.openingBalance
            ? Number(form.openingBalance)
            : 0,
        },
      })
      setForm(emptyForm)
      setShowForm(false)
      await load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create account')
    }
    setSaving(false)
  }

  const remove = async (id: number) => {
    if (!window.confirm('Delete this account?')) return
    try {
      await api(`/gl-accounts/${id}`, { method: 'DELETE' })
      await load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete account')
    }
  }

  const groupName = (a: Account) => {
    const g = a.group && typeof a.group === 'object' ? a.group : groups.find((x) => x.id === a.group)
    return g ? `${g.name}${g.code ? ` (${g.code})` : ''}` : '—'
  }

  const { query, setQuery, sort, toggleSort, visible } = useSortSearch(accounts, {
    searchable: (a) =>
      [a.name, a.code || '', groupName(a), a.class || ''].join(' '),
    valueOf: (a, key) => {
      switch (key) {
        case 'group':
          return groupName(a)
        case 'opening':
          return Number(a.openingBalance) || 0
        default:
          return (a as unknown as Record<string, unknown>)[key] as
            | string
            | number
            | undefined
      }
    },
    defaultSort: { key: 'name', dir: 'asc' },
  })

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Chart of Accounts</h1>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <Plus size={14} />
          New account
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
              Code
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              />
            </label>
            <label className="text-sm text-slate-700">
              Type
              <select
                value={form.type}
                onChange={(e) =>
                  setForm({ ...form, type: e.target.value as AccountType })
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
              Class
              <select
                value={form.class}
                onChange={(e) => setForm({ ...form, class: e.target.value })}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              >
                <option value="other">Other</option>
                <option value="cash">Cash</option>
                <option value="bank">Bank</option>
              </select>
            </label>
            <label className="text-sm text-slate-700">
              Group
              <select
                value={form.group}
                onChange={(e) => setForm({ ...form, group: e.target.value })}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              >
                <option value="">— none —</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
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

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-xs text-slate-400">
          {visible.length} of {accounts.length}
        </span>
        <SearchBox
          value={query}
          onChange={setQuery}
          placeholder="Search name, code, group…"
        />
      </div>

      {TYPES.map((type) => {
        const rows = visible.filter((a) => a.type === type)
        if (rows.length === 0) return null
        return (
          <div
            key={type}
            className="mt-4 rounded-lg border border-slate-200 bg-white"
          >
            <div className="border-b border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700">
              {TYPE_LABELS[type]}
              <span className="ml-2 text-xs font-normal text-slate-400">
                {rows.length}
              </span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <SortableTh label="Code" sortKey="code" sort={sort} onSort={toggleSort} />
                  <SortableTh label="Name" sortKey="name" sort={sort} onSort={toggleSort} />
                  <SortableTh label="Group" sortKey="group" sort={sort} onSort={toggleSort} />
                  <SortableTh label="Class" sortKey="class" sort={sort} onSort={toggleSort} />
                  <SortableTh label="Opening" sortKey="opening" sort={sort} onSort={toggleSort} align="right" />
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} className="border-b border-slate-50">
                    <td className="px-4 py-2 font-mono text-slate-500">
                      {a.code || '—'}
                    </td>
                    <td className="px-4 py-2 text-slate-800">{a.name}</td>
                    <td className="px-4 py-2 text-slate-500">
                      {groupName(a)}
                    </td>
                    <td className="px-4 py-2 text-slate-500">{a.class || 'other'}</td>
                    <td className="px-4 py-2 text-right font-mono text-slate-700">
                      {Number(a.openingBalance || 0).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <ActionMenu
                        items={[
                          {
                            label: 'Delete',
                            icon: <Trash2 size={13} />,
                            danger: true,
                            onClick: () => remove(a.id),
                          },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}

      {accounts.length === 0 && !error && (
        <p className="mt-6 text-center text-sm text-slate-400">
          No accounts yet. Add your first account to build the chart of accounts.
        </p>
      )}
    </div>
  )
}
