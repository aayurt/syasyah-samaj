import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Download, FileText, Printer } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api, fmt } from '../../lib/api'
import { downloadCsv } from '../../lib/csv'
import { exportReportPdf } from '../../lib/pdf'
import { useCalendar } from '../../lib/calendar'
import { useTenant, useTenantQuery } from '../../lib/tenant'
import { ReportSkeleton } from '../../components/Skeleton'
import DataStatus from '../../components/DataStatus'
import type { PnlResponse, PnlRow } from '../../lib/types'

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

export default function ProfitLoss() {
  const navigate = useNavigate()
  const { tenantId } = useTenant()
  const tenantQuery = useTenantQuery()
  const { formatDate } = useCalendar()
  const [data, setData] = useState<PnlResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const load = useCallback(async () => {
    try {
      const q: any = { ...tenantQuery }
      if (from) q.from = from
      if (to) q.to = to
      const res = await api<PnlResponse>('/journal-entries/profit-loss', { query: q })
      setData(res)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load P&L')
    } finally { setLoading(false) }
  }, [from, to, tenantId])

  useEffect(() => { load() }, [load])

  const csv = () => {
    if (!data) return
    downloadCsv('profit-loss.csv', ['Section', 'Account', 'Amount'], [
      ...data.income.map((r) => ['Income', r.account.name, r.amount]),
      ['', 'Total Income', data.totals.income],
      ...data.expense.map((r) => ['Expense', r.account.name, r.amount]),
      ['', 'Total Expenses', data.totals.expense],
      ['', 'Net Profit/Loss', data.totals.netProfit],
    ])
  }

  const pdf = () => {
    if (!data) return
    exportReportPdf({
      filename: 'profit-loss.pdf',
      title: 'Profit & Loss Statement',
      subtitle: data.totals.netProfit >= 0 ? `Net Profit: ${fmt(data.totals.netProfit)}` : `Net Loss: ${fmt(Math.abs(data.totals.netProfit))}`,
      meta: [['Period', `${from || 'Earliest'} to ${to || 'Latest'}`], ['Generated', new Date().toLocaleString()]],
      tables: [
        {
          title: `Income (${fmt(data.totals.income)})`,
          columns: ['Account', 'Amount'],
          rows: data.income.map((r) => [r.account.name, r.amount]),
          totals: ['Total Income', data.totals.income],
        },
        {
          title: `Expenses (${fmt(data.totals.expense)})`,
          columns: ['Account', 'Amount'],
          rows: data.expense.map((r) => [r.account.name, r.amount]),
          totals: ['Total Expenses', data.totals.expense],
        },
      ],
      foot: [
        { label: data.totals.netProfit >= 0 ? 'Net Profit' : 'Net Loss', value: data.totals.netProfit },
      ],
    })
  }

  const RowList = ({ title, rows, total, color }: { title: string; rows: PnlRow[]; total: number; color: string }) => (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-sm font-semibold text-slate-800">{title}</span>
        <span className={`font-mono text-sm font-semibold ${color}`}>{fmt(total)}</span>
      </div>
      {rows.length > 0 ? (
        <table className="w-full border-t border-slate-100 text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2">Account</th>
              <th className="px-4 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.sort((a, b) => b.amount - a.amount).map((r) => (
              <tr key={r.account.id ?? r.account.name} className="border-b border-slate-50 last:border-0">
                <td className="px-4 py-2 text-slate-700">{r.account.code ? `${r.account.code} · ` : ''}{r.account.name}</td>
                <td className="px-4 py-2 text-right font-mono text-slate-800">{fmt(r.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="px-4 py-4 text-center text-sm text-slate-400">No {title.toLowerCase()} found.</p>
      )}
    </div>
  )

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/reports')} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><ArrowLeft size={18} /></button>
          <h1 className="text-lg font-semibold text-slate-900">Profit & Loss Statement</h1>
        </div>
        <div className="print:hidden flex items-center gap-2">
          <button onClick={csv} disabled={loading || !data} className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"><Download size={14} /> CSV</button>
          <button onClick={pdf} disabled={loading || !data} className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"><FileText size={14} /> PDF</button>
          <button onClick={() => window.print()} disabled={loading} className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"><Printer size={14} /> Print</button>
        </div>
      </div>
      <div className="mt-2"><DataStatus /></div>
      <div className="mt-4 flex items-center gap-3">
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-slate-500" />
        <span className="text-xs text-slate-400">to</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-slate-500" />
        <div className="flex gap-1">
          {QUICK_RANGES.map((r) => (<button key={r.label} onClick={() => { setFrom(r.from()); setTo(r.to()) }} className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50">{r.label}</button>))}
        </div>
      </div>
      {error && <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {loading && !data ? <ReportSkeleton sections={2} /> : data && (
        <>
          {/* Net Profit/Loss banner */}
          <div className={`mt-4 rounded-lg border px-4 py-3 text-sm font-medium ${data.totals.netProfit >= 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
            {data.totals.netProfit >= 0
              ? `✓ Net Profit: ${fmt(data.totals.netProfit)}`
              : `✗ Net Loss: ${fmt(Math.abs(data.totals.netProfit))}`}
          </div>

          {/* KPI summary */}
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Total Income</div>
              <div className="mt-1 font-mono text-xl font-semibold text-emerald-700">{fmt(data.totals.income)}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Total Expenses</div>
              <div className="mt-1 font-mono text-xl font-semibold text-red-600">{fmt(data.totals.expense)}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Net Profit / Loss</div>
              <div className={`mt-1 font-mono text-xl font-semibold ${data.totals.netProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                {data.totals.netProfit >= 0 ? '+' : ''}{fmt(data.totals.netProfit)}
              </div>
            </div>
          </div>

          {/* Income */}
          <div className="mt-4">
            <RowList title="Income" rows={data.income} total={data.totals.income} color="text-emerald-700" />
          </div>

          {/* Expenses */}
          <div className="mt-4">
            <RowList title="Expenses" rows={data.expense} total={data.totals.expense} color="text-red-600" />
          </div>

          {/* Final summary */}
          <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex justify-between text-sm">
              <span className="font-semibold text-slate-700">Total Income</span>
              <span className="font-mono font-semibold text-emerald-700">{fmt(data.totals.income)}</span>
            </div>
            <div className="mt-1 flex justify-between text-sm">
              <span className="font-semibold text-slate-700">Total Expenses</span>
              <span className="font-mono font-semibold text-red-600">({fmt(data.totals.expense)})</span>
            </div>
            <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-sm">
              <span className="font-bold text-slate-900">{data.totals.netProfit >= 0 ? 'Net Profit' : 'Net Loss'}</span>
              <span className={`font-mono font-bold ${data.totals.netProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                {data.totals.netProfit >= 0 ? '+' : ''}{fmt(data.totals.netProfit)}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
