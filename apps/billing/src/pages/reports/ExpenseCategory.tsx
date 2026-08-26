import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Download, FileText, Printer } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api, fmt } from '../../lib/api'
import { downloadCsv } from '../../lib/csv'
import { exportReportPdf } from '../../lib/pdf'
import { useCalendar } from '../../lib/calendar'
import { useTenant, useTenantQuery } from '../../lib/tenant'
import { ReportSkeleton } from '../../components/Skeleton'
import DataStatus from '../../components/DataStatus'
import type { Account, AccountGroup, PnlResponse, PnlRow } from '../../lib/types'
import NepaliDateInput from '../../components/NepaliDateInput'

const QUICK_RANGES = [
  { label: 'This Month', from: () => monthStart(0), to: () => monthEnd(0) },
  { label: 'Last Month', from: () => monthStart(-1), to: () => monthEnd(-1) },
  { label: 'This FY', from: () => fyStart(), to: () => fyEnd() },
  { label: 'All Time', from: () => '', to: () => '' },
]
function monthStart(o: number): string { const d = new Date(); d.setMonth(d.getMonth() + o, 1); return d.toISOString().slice(0, 10) }
function monthEnd(o: number): string { const d = new Date(); d.setMonth(d.getMonth() + o + 1, 0); return d.toISOString().slice(0, 10) }
function fyStart(): string { const n = new Date(); return (n.getMonth() >= 6 ? n.getFullYear() : n.getFullYear() - 1) + '-07-16' }
function fyEnd(): string { const n = new Date(); return (n.getMonth() >= 6 ? n.getFullYear() + 1 : n.getFullYear()) + '-07-15' }

interface GroupedCategory { name: string; accounts: { name: string; amount: number }[]; total: number }

export default function ExpenseCategory() {
  const navigate = useNavigate()
  const { tenantId } = useTenant()
  const tenantQuery = useTenantQuery()
  const { formatDate } = useCalendar()
  const [categories, setCategories] = useState<GroupedCategory[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    try {
      const q = { from: from || undefined, to: to || undefined, ...tenantQuery }
      const [pnl, groups, accts] = await Promise.all([
        api<PnlResponse>('/journal-entries/profit-loss', { query: q }),
        api<{ docs: AccountGroup[] } | AccountGroup[]>('/account-groups', { query: { depth: 0 } }),
        api<{ docs: Account[] } | Account[]>('/gl-accounts', { query: { depth: 0, ...tenantQuery } }),
      ])
      const groupList = Array.isArray(groups) ? groups : (groups as { docs: AccountGroup[] }).docs || []
      const acctList = Array.isArray(accts) ? accts : (accts as { docs: Account[] }).docs || []
      const groupMap = new Map(groupList.map((g) => [g.id, g]))
      const acctMap = new Map(acctList.map((a) => [a.id, a]))

      // Group expense rows by their account's group
      const byGroup = new Map<string, { name: string; accounts: { name: string; amount: number }[] }>()
      let grandTotal = 0

      for (const row of pnl.expense) {
        const amount = Number(row.amount) || 0
        grandTotal += amount
        const acc = acctMap.get(Number(row.account.id))
        const groupId = acc?.group ? (typeof acc.group === 'object' ? (acc.group as AccountGroup).id : acc.group) : null
        const groupName = groupId ? (groupMap.get(groupId)?.name || 'Ungrouped') : 'Ungrouped'
        if (!byGroup.has(groupName)) byGroup.set(groupName, { name: groupName, accounts: [] })
        byGroup.get(groupName)!.accounts.push({
          name: acc?.code ? `${acc.code} · ${row.account.name}` : row.account.name,
          amount,
        })
      }

      const cats = Array.from(byGroup.values()).map((g) => ({
        ...g,
        total: g.accounts.reduce((s, a) => s + a.amount, 0),
      })).sort((a, b) => b.total - a.total)

      setCategories(cats)
      setTotal(grandTotal)
      // Auto-expand top 3 categories
      setExpanded(new Set(cats.slice(0, 3).map((c) => c.name)))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load expense categories')
    } finally { setLoading(false) }
  }, [from, to, tenantId])

  useEffect(() => { load() }, [load])

  const toggle = (name: string) => setExpanded((prev) => { const next = new Set(prev); next.has(name) ? next.delete(name) : next.add(name); return next })

  const csv = () => downloadCsv('expense-category.csv', ['Category', 'Account', 'Amount'],
    categories.flatMap((c) => c.accounts.map((a) => [c.name, a.name, a.amount])))

  const pdf = () => exportReportPdf({
    filename: 'expense-category.pdf', title: 'Expense Categories',
    meta: [['From', from || 'Earliest'], ['To', to || 'Latest'], ['Total Expenses', fmt(total)]],
    tables: categories.map((c) => ({
      title: `${c.name} (${fmt(c.total)})`,
      columns: ['Account', 'Amount'],
      rows: c.accounts.map((a) => [a.name, a.amount]),
      totals: ['Subtotal', c.total],
    })),
    foot: [{ label: 'Total Expenses', value: total }],
  })

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/reports')} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><ArrowLeft size={18} /></button>
          <h1 className="text-lg font-semibold text-slate-900">Expense by Category</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={csv} disabled={loading} className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"><Download size={14} /> CSV</button>
          <button onClick={pdf} disabled={loading} className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"><FileText size={14} /> PDF</button>
          <button onClick={() => window.print()} disabled={loading} className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"><Printer size={14} /> Print</button>
        </div>
      </div>
      <div className="mt-2"><DataStatus /></div>
      <div className="mt-4 flex items-center gap-3">
        <NepaliDateInput compact value={from} onChange={(v) => setFrom(v)} />
        <span className="text-xs text-slate-400">to</span>
        <NepaliDateInput compact value={to} onChange={(v) => setTo(v)} />
        <div className="flex gap-1">
          {QUICK_RANGES.map((r) => (<button key={r.label} onClick={() => { setFrom(r.from()); setTo(r.to()) }} className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50">{r.label}</button>))}
        </div>
      </div>
      {error && <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {loading && categories.length === 0 ? <ReportSkeleton sections={2} /> : (
        <>
          <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Total Expenses</div>
            <div className="mt-1 font-mono text-xl font-semibold text-red-600">{fmt(total)}</div>
          </div>
          <div className="mt-4 space-y-2">
            {categories.map((cat) => (
              <div key={cat.name} className="rounded-lg border border-slate-200 bg-white">
                <button onClick={() => toggle(cat.name)} className="flex w-full items-center justify-between px-4 py-3 text-left">
                  <span className="text-sm font-medium text-slate-800">{cat.name}</span>
                  <span className="font-mono text-sm font-semibold text-slate-700">{fmt(cat.total)}</span>
                </button>
                {expanded.has(cat.name) && (
                  <table className="w-full border-t border-slate-100 text-sm">
                    <tbody>
                      {cat.accounts.sort((a, b) => b.amount - a.amount).map((a) => (
                        <tr key={a.name} className="border-b border-slate-50 last:border-0">
                          <td className="px-4 py-2 pl-8 text-slate-600">{a.name}</td>
                          <td className="px-4 py-2 text-right font-mono text-slate-800">{fmt(a.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
            {categories.length === 0 && <p className="text-center text-sm text-slate-400">No expense categories found.</p>}
          </div>
        </>
      )}
    </div>
  )
}
