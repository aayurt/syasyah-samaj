import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDownLeft,
  ArrowUpRight,
  BookOpenText,
  Clock3,
  CreditCard,
  IndianRupee,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { api, fmt, list, useSyncState } from '../lib/api'
import DataStatus from '../components/DataStatus'
import { useCalendar } from '../lib/calendar'
import { useTenant, useTenantQuery } from '../lib/tenant'
import type {
  Account,
  AgingParty,
  AgingResponse,
  JournalEntry,
  PnlResponse,
} from '../lib/types'

interface TrialBalanceSummary {
  totals: { debit: number; credit: number }
  balanced: boolean
}

interface MonthData {
  label: string
  income: number
  expense: number
}

/* ── Helpers ─────────────────────────────────────────────────────── */

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function monthLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short' })
}
function last12Months(): { key: string; label: string }[] {
  const result: { key: string; label: string }[] = []
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    result.push({ key: monthKey(d), label: monthLabel(d) })
  }
  return result
}

/* ── Mini bar chart (pure CSS, no library) ──────────────────────── */

function MiniBarChart({
  months,
  data,
}: {
  months: { key: string; label: string }[]
  data: Map<string, MonthData>
}) {
  const maxVal = useMemo(() => {
    let m = 1
    for (const m2 of months) {
      const d = data.get(m2.key)
      if (d) {
        m = Math.max(m, d.income, d.expense)
      }
    }
    return m
  }, [months, data])

  return (
    <div className="flex items-end gap-1" style={{ height: 120 }}>
      {months.map((m) => {
        const d = data.get(m.key) || { income: 0, expense: 0 }
        const incH = maxVal > 0 ? (d.income / maxVal) * 100 : 0
        const expH = maxVal > 0 ? (d.expense / maxVal) * 100 : 0
        return (
          <div
            key={m.key}
            className="group flex flex-1 flex-col items-center gap-0.5"
          >
            {/* Tooltip */}
            <div className="pointer-events-none absolute -mt-8 hidden rounded bg-slate-800 px-2 py-1 text-[10px] text-white group-hover:block">
              +{fmt(d.income)} / −{fmt(d.expense)}
            </div>
            <div className="flex w-full items-end justify-center gap-px">
              <div
                className="w-2 rounded-t bg-emerald-400 transition-all"
                style={{ height: `${incH}%`, minHeight: incH > 0 ? 2 : 0 }}
              />
              <div
                className="w-2 rounded-t bg-red-400 transition-all"
                style={{ height: `${expH}%`, minHeight: expH > 0 ? 2 : 0 }}
              />
            </div>
            <div className="text-[9px] text-slate-400">{m.label.slice(0, 1)}</div>
          </div>
        )
      })}
    </div>
  )
}

/* ── Status pill ────────────────────────────────────────────────── */

export function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-600',
    posted: 'bg-emerald-100 text-emerald-700',
    void: 'bg-red-100 text-red-700',
  }
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${styles[status] || 'bg-slate-100 text-slate-600'}`}
    >
      {status}
    </span>
  )
}

/* ── Dashboard ──────────────────────────────────────────────────── */

export default function Dashboard() {
  const { cacheVersion, online } = useSyncState()
  const { tenantId } = useTenant()
  const tenantQuery = useTenantQuery()
  const { formatDate } = useCalendar()

  // Core data
  const [stats, setStats] = useState<{
    accounts: number
    entries: number
    posted: number
    trial?: TrialBalanceSummary
  } | null>(null)
  const [recent, setRecent] = useState<JournalEntry[]>([])
  const [error, setError] = useState('')

  // Trend data (12 months of P&L)
  const [trend, setTrend] = useState<Map<string, MonthData>>(new Map())
  const [trendLoading, setTrendLoading] = useState(true)

  // Outstanding dues (AR + AP)
  const [arData, setArData] = useState<AgingResponse | null>(null)
  const [apData, setApData] = useState<AgingResponse | null>(null)

  // Cash position
  const [cashAccounts, setCashAccounts] = useState<
    { name: string; balance: number }[]
  >([])
  const [bankAccounts, setBankAccounts] = useState<
    { name: string; balance: number }[]
  >([])

  const months = useMemo(() => last12Months(), [])

  const load = useCallback(async () => {
    try {
      // Core
      const [accts, entries, tb] = await Promise.all([
        list<Account>('gl-accounts', { depth: 0, ...tenantQuery }),
        list<JournalEntry>('journal-entries', { depth: 0, sort: '-date', ...tenantQuery }),
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

      // Trend: fetch P&L for each of last 12 months
      setTrendLoading(true)
      const trendMap = new Map<string, MonthData>()
      const now = new Date()
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
        const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0)
        const to = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`
        const key = monthKey(d)
        try {
          const pnl = await api<PnlResponse>('/journal-entries/profit-loss', {
            query: { from, to, ...tenantQuery },
          })
          trendMap.set(key, {
            label: monthLabel(d),
            income: pnl.totals.income,
            expense: pnl.totals.expense,
          })
        } catch {
          trendMap.set(key, { label: monthLabel(d), income: 0, expense: 0 })
        }
      }
      setTrend(trendMap)
      setTrendLoading(false)

      // Aging (AR + AP)
      const [ar, ap] = await Promise.all([
        api<AgingResponse>('/documents/aging', { query: { side: 'ar', ...tenantQuery } }).catch(() => null),
        api<AgingResponse>('/documents/aging', { query: { side: 'ap', ...tenantQuery } }).catch(() => null),
      ])
      setArData(ar)
      setApData(ap)

      // Cash + Bank balances from accounts list
      const cashAcctList = accts.docs.filter((a: any) => a.class === 'cash' && a.type === 'asset')
      const bankAcctList = accts.docs.filter((a: any) => a.class === 'bank' && a.type === 'asset')
      // Use trial balance to get balances for these accounts
      const tbRes = await api<{ docs: any[] }>('/journal-entries/trial-balance', {
        query: { ...tenantQuery },
      }).catch(() => ({ docs: [] }))
      const tbDocs = tbRes.docs || []
      setCashAccounts(
        tbDocs
          .filter((r: any) => cashAcctList.some((a: any) => a.id === r.account?.id))
          .map((r: any) => ({ name: r.account.name, balance: r.debit - r.credit })),
      )
      setBankAccounts(
        tbDocs
          .filter((r: any) => bankAcctList.some((a: any) => a.id === r.account?.id))
          .map((r: any) => ({ name: r.account.name, balance: r.debit - r.credit })),
      )
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard')
    }
  }, [cacheVersion, online, tenantId])

  useEffect(() => {
    load()
  }, [load])

  // Derived values
  const totalCash = cashAccounts.reduce((s, a) => s + a.balance, 0)
  const totalBank = bankAccounts.reduce((s, a) => s + a.balance, 0)
  const arTotal = arData?.totals?.total || 0
  const apTotal = apData?.totals?.total || 0

  const kpis = [
    {
      label: 'Accounts',
      value: stats ? String(stats.accounts) : '–',
      icon: BookOpenText,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Journal Entries',
      value: stats ? String(stats.entries) : '–',
      icon: BookOpenText,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: 'Posted',
      value: stats ? String(stats.posted) : '–',
      icon: TrendingUp,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: 'Trial Balance',
      value: stats?.trial ? fmt(stats.trial.totals.debit) : '–',
      sub: stats?.trial
        ? stats.trial.balanced
          ? '✓ balanced'
          : '✗ out of balance'
        : undefined,
      icon: TrendingDown,
      color: stats?.trial?.balanced ? 'text-emerald-600' : 'text-red-600',
      bg: stats?.trial?.balanced ? 'bg-emerald-50' : 'bg-red-50',
    },
  ]

  const entryTotals = (e: JournalEntry) =>
    (Array.isArray(e.lines) ? e.lines : []).reduce(
      (acc, l) => ({
        debit: acc.debit + (Number(l.debit) || 0),
        credit: acc.credit + (Number(l.credit) || 0),
      }),
      { debit: 0, credit: 0 },
    )

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-lg font-semibold text-slate-900">Dashboard</h1>
      <div className="mt-2">
        <DataStatus />
      </div>

      {error && (
        <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* ── KPI Cards ─────────────────────────────────────────── */}
      <div data-tour="dashboard-stats" className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4"
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${k.bg}`}>
              <k.icon size={18} className={k.color} />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">
                {k.label}
              </div>
              <div className="font-mono text-lg font-semibold text-slate-800">
                {k.value}
              </div>
              {k.sub && (
                <div
                  className={`mt-0.5 text-xs ${k.sub.startsWith('✓') ? 'text-emerald-600' : 'text-red-600'}`}
                >
                  {k.sub}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Second row: Cash Position + Outstanding Dues ──────── */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Cash Position */}
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 mb-3">
            <Wallet size={16} className="text-slate-400" />
            <h3 className="text-sm font-medium text-slate-700">Cash Position</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2">
              <div className="flex items-center gap-2">
                <IndianRupee size={14} className="text-emerald-600" />
                <span className="text-sm text-slate-700">Cash in Hand</span>
              </div>
              <span className="font-mono text-sm font-semibold text-emerald-700">
                {fmt(totalCash)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-blue-50 px-3 py-2">
              <div className="flex items-center gap-2">
                <CreditCard size={14} className="text-blue-600" />
                <span className="text-sm text-slate-700">Bank Balance</span>
              </div>
              <span className="font-mono text-sm font-semibold text-blue-700">
                {fmt(totalBank)}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 pt-2">
              <span className="text-sm font-medium text-slate-700">
                Total Liquid
              </span>
              <span className="font-mono text-sm font-semibold text-slate-800">
                {fmt(totalCash + totalBank)}
              </span>
            </div>
            {/* Account breakdown */}
            {(cashAccounts.length > 0 || bankAccounts.length > 0) && (
              <div className="mt-2 space-y-1">
                {[...cashAccounts, ...bankAccounts].map((a) => (
                  <div
                    key={a.name}
                    className="flex items-center justify-between text-xs text-slate-500"
                  >
                    <span>{a.name}</span>
                    <span className="font-mono">{fmt(a.balance)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="mt-3">
            <Link
              to="/reports/cash-statement"
              className="text-xs text-blue-600 hover:underline"
            >
              View Cash Statement →
            </Link>
          </div>
        </div>

        {/* Outstanding Dues */}
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock3 size={16} className="text-slate-400" />
            <h3 className="text-sm font-medium text-slate-700">
              Outstanding Dues
            </h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2">
              <div className="flex items-center gap-2">
                <ArrowUpRight size={14} className="text-emerald-600" />
                <span className="text-sm text-slate-700">Receivable (AR)</span>
              </div>
              <span className="font-mono text-sm font-semibold text-emerald-700">
                {fmt(arTotal)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-red-50 px-3 py-2">
              <div className="flex items-center gap-2">
                <ArrowDownLeft size={14} className="text-red-600" />
                <span className="text-sm text-slate-700">Payable (AP)</span>
              </div>
              <span className="font-mono text-sm font-semibold text-red-700">
                {fmt(apTotal)}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 pt-2">
              <span className="text-sm font-medium text-slate-700">
                Net Position
              </span>
              <span
                className={`font-mono text-sm font-semibold ${arTotal - apTotal >= 0 ? 'text-emerald-700' : 'text-red-600'}`}
              >
                {arTotal - apTotal >= 0 ? '+' : ''}
                {fmt(arTotal - apTotal)}
              </span>
            </div>
            {/* Aging buckets */}
            {arData?.totals?.buckets && (
              <div className="mt-2">
                <div className="text-xs font-medium text-slate-500 mb-1">
                  AR Aging
                </div>
                <div className="flex gap-1">
                  {(['0-30', '31-60', '61-90', '90+'] as const).map((b) => {
                    const val = arData.totals.buckets[b] || 0
                    const pct = arTotal > 0 ? (val / arTotal) * 100 : 0
                    return (
                      <div key={b} className="flex-1">
                        <div className="h-8 rounded bg-slate-100 overflow-hidden">
                          <div
                            className={`rounded ${b === '0-30' ? 'bg-emerald-300' : b === '31-60' ? 'bg-amber-300' : b === '61-90' ? 'bg-orange-400' : 'bg-red-400'}`}
                            style={{ height: `${pct}%` }}
                          />
                        </div>
                        <div className="text-[9px] text-center text-slate-400 mt-0.5">
                          {b}d
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
          <div className="mt-3">
            <Link
              to="/aging"
              className="text-xs text-blue-600 hover:underline"
            >
              View Aging Report →
            </Link>
          </div>
        </div>
      </div>

      {/* ── Trend Chart: Revenue vs Expenses (12 months) ──────── */}
      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-slate-400" />
            <h3 className="text-sm font-medium text-slate-700">
              Revenue vs Expenses (12 months)
            </h3>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
              Income
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-red-400" />
              Expenses
            </span>
          </div>
        </div>
        {trendLoading ? (
          <div className="flex items-center justify-center h-32 text-sm text-slate-400">
            Loading trend data…
          </div>
        ) : (
          <MiniBarChart months={months} data={trend} />
        )}
      </div>

      {/* ── Recent journal entries ────────────────────────────── */}
      <div className="mt-4 rounded-lg border border-slate-200 bg-white">
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
                <td
                  colSpan={5}
                  className="px-4 py-6 text-center text-slate-400"
                >
                  No entries yet — post your first journal entry.
                </td>
              </tr>
            )}
            {recent.map((e) => {
              const t = entryTotals(e)
              return (
                <tr key={e.id} className="border-b border-slate-50">
                  <td className="px-4 py-2 text-slate-600">
                    {formatDate(e.date)}
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
