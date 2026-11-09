/**
 * Payroll Groups — pay frequency management (MONTHLY / WEEKLY / FORTNIGHTLY / FOUR_WEEKLY).
 *
 * Each group ties a frequency to a fiscal year and generates pay periods.
 * Route: /payroll/groups
 */
import { useCallback, useEffect, useState } from 'react'
import { Plus, RefreshCw, Trash2 } from 'lucide-react'
import { api, fmt, list } from '../lib/api'
import { useTenantQuery } from '../lib/tenant'
import { pushToast } from '../lib/toast'
import type { PayrollGroup } from '../lib/types'

export default function PayrollGroups() {
  const tenantQuery = useTenantQuery()
  const [groups, setGroups] = useState<PayrollGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [frequency, setFrequency] = useState<'MONTHLY' | 'WEEKLY' | 'FORTNIGHTLY' | 'FOUR_WEEKLY'>('MONTHLY')
  const [error, setError] = useState('')

  const FREQUENCY_LABELS: Record<string, string> = {
    MONTHLY: 'Monthly (12 periods)',
    WEEKLY: 'Weekly (52 periods)',
    FORTNIGHTLY: 'Fortnightly (26 periods)',
    FOUR_WEEKLY: 'Four-Weekly (13 periods)',
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await list<PayrollGroup>('/pay-groups', { ...tenantQuery })
      setGroups(res.docs || [])
    } catch {
      /* api() toasted */
    } finally {
      setLoading(false)
    }
  }, [JSON.stringify(tenantQuery)])

  useEffect(() => { load() }, [load])

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Name is required.')
      return
    }
    setCreating(true)
    setError('')
    try {
      await api('/pay-groups', {
        method: 'POST',
        body: { name: name.trim(), frequency },
      })
      setName('')
      setCreating(false)
      await load()
      pushToast('success', 'Pay group created')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create pay group')
      setCreating(false)
    }
  }

  const handleGeneratePeriods = async (group: PayrollGroup) => {
    try {
      await api(`/pay-groups/${group.id}/generate-periods`, {
        method: 'POST',
        body: { tenant: group.tenant },
      })
      pushToast('success', 'Periods generated', `${group.name} — ${group.frequency}`)
    } catch (err) {
      pushToast('error', 'Generate periods failed', err instanceof Error ? err.message : String(err))
    }
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this pay group? This removes its periods too.')) return
    try {
      await api(`/pay-groups/${id}`, { method: 'DELETE' })
      await load()
      pushToast('success', 'Pay group deleted')
    } catch {
      /* api() toasted */
    }
  }

  return (
    <div className="p-6 mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">
          <RefreshCw size={20} className="mr-2 text-crimson-600" />
          Payroll Groups
        </h1>
        <p className="text-sm text-slate-500">
          Pay frequencies that drive pay period generation. Each group generates
          periods for its fiscal year (monthly → 12, weekly → 52, …).
        </p>
      </div>

      {/* Create form */}
      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-medium text-slate-800 mb-3">New Pay Group</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div className="col-span-2 sm:col-span-2">
            <label className="block text-xs font-medium text-slate-500 mb-1">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Monthly Salary"
              className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Frequency</label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as any)}
              className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm"
            >
              {Object.entries(FREQUENCY_LABELS).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <button
              onClick={handleCreate}
              disabled={creating || !name.trim()}
              className="rounded bg-crimson-600 px-4 py-2 text-sm font-medium text-white hover:bg-crimson-700 disabled:opacity-50"
            >
              {creating ? 'Creating…' : 'Create'}
            </button>
          </div>
          {error && (
            <div className="col-span-3 mt-1 text-sm text-red-600">{error}</div>
          )}
        </div>
      </div>

      {/* Groups list */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading…</div>
        ) : groups.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No pay groups yet — create one above, then generate periods.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Frequency</th>
                <th className="px-4 py-3 text-right">Periods / Year</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-800">{g.name}</td>
                  <td className="px-4 py-3 text-slate-600">{FREQUENCY_LABELS[g.frequency]}</td>
                  <td className="px-4 py-3 text-right">{g.periodsPerYear}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        g.active
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {g.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={() => handleGeneratePeriods(g)}
                        disabled={!g.active}
                        className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                      >
                        Generate Periods
                      </button>
                      <button
                        onClick={() => handleDelete(g.id)}
                        className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-50"
                      >
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
