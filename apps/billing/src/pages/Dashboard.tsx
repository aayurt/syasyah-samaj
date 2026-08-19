import { useEffect, useState } from 'react'
import { api, fmt, list, useSyncState } from '../lib/api'
import DataStatus from '../components/DataStatus'
import { useTenant, useTenantQuery } from '../lib/tenant'
import type { Account, JournalEntry } from '../lib/types'

interface TrialBalanceSummary {
  totals: { debit: number; credit: number }
  balanced: boolean
}

export default function Dashboard() {
  const { cacheVersion, online } = useSyncState()
  const { tenantId } = useTenant()
  const tenantQuery = useTenantQuery()
  const [stats, setStats] = useState<{
    accounts: number
    entries: number
    posted: number
    trial?: TrialBalanceSummary
  } | null>(null)
  const [recent, setRecent] = useState<JournalEntry[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const [accts, entries, tb] = await Promise.all([
          list<Account>('gl-accounts', { depth: 0, ...tenantQuery }),
          list<JournalEntry>('journal-entries', { depth: 0, ...tenantQuery }),
          // Computed report endpoint — cache-first reads don't cover it, so
          // keep it independent: when offline (or still loading) the KPI
          // shows '–' but the cached accounts/entries still render.
          api<TrialBalanceSummary>('/journal-entries/trial-balance', {
            query: { ...tenantQuery },
          }).catch(() => null),
        ])
        setStats({
          accounts: accts.totalDocs,
          entries: entries.totalDocs,
          posted: entries.docs.filter((e) => e.status === 'posted').length,
          trial: tb ?? undefined,
        })
        setRecent(entries.docs.slice(0, 8))
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard')
      }
    })()
  }, [cacheVersion, online, tenantId])

  const kpis = [
    { label: 'Accounts', value: stats ? String(stats.accounts) : '–' },
    { label: 'Journal entries', value: stats ? String(stats.entries) : '–' },
    { label: 'Posted', value: stats ? String(stats.posted) : '–' },
    {
      label: 'Trial balance',
      value: stats?.trial ? fmt(stats.trial.totals.debit) : '–',
      sub: stats?.trial
        ? stats.trial.balanced
          ? '✓ balanced'
          : '✗ out of balance'
        : undefined,
    },
  ]

  const entryTotals = (e: JournalEntry) =>
    // Guard against stale cached rows missing the `lines` array.
    (Array.isArray(e.lines) ? e.lines : []).reduce(
      (acc, l) => ({
        debit: acc.debit + (Number(l.debit) || 0),
        credit: acc.credit + (Number(l.credit) || 0),
      }),
      { debit: 0, credit: 0 },
    )

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-lg font-semibold text-slate-900">Dashboard</h1>

      <div className="mt-2">
        <DataStatus />
      </div>

      {error && (
        <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div data-tour="dashboard-stats" className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="rounded-lg border border-slate-200 bg-white p-4"
          >
            <div className="text-xs uppercase tracking-wide text-slate-500">
              {k.label}
            </div>
            <div className="mt-1 font-mono text-lg font-semibold text-amber-700">
              {k.value}
            </div>
            {k.sub && (
              <div
                className={`mt-0.5 text-xs ${
                  k.sub.startsWith('✓') ? 'text-emerald-600' : 'text-red-600'
                }`}
              >
                {k.sub}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3 text-sm font-medium text-slate-700">
          Recent journal entries
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Narration</th>
              <th className="px-4 py-2">Debit</th>
              <th className="px-4 py-2">Credit</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {recent.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  No entries yet — post your first journal entry.
                </td>
              </tr>
            )}
            {recent.map((e) => {
              const t = entryTotals(e)
              return (
                <tr key={e.id} className="border-b border-slate-50">
                  <td className="px-4 py-2 text-slate-600">
                    {e.date?.slice(0, 10)}
                  </td>
                  <td className="px-4 py-2 text-slate-800">
                    {e.narration || '—'}
                  </td>
                  <td className="px-4 py-2 font-mono text-slate-700">
                    {fmt(t.debit)}
                  </td>
                  <td className="px-4 py-2 font-mono text-slate-700">
                    {fmt(t.credit)}
                  </td>
                  <td className="px-4 py-2">
                    <StatusPill status={e.status} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-600',
    posted: 'bg-emerald-100 text-emerald-700',
    void: 'bg-red-100 text-red-700',
  }
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
        styles[status] || 'bg-slate-100 text-slate-600'
      }`}
    >
      {status}
    </span>
  )
}
