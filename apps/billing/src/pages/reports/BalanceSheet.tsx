import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Download, FileText, Printer } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import LedgerModal from '../../components/LedgerModal'
import { api, fmt } from '../../lib/api'
import { downloadCsv } from '../../lib/csv'
import { exportReportPdf } from '../../lib/pdf'
import { useCalendar } from '../../lib/calendar'
import { useTenant, useTenantQuery } from '../../lib/tenant'
import { ReportSkeleton } from '../../components/Skeleton'
import DataStatus from '../../components/DataStatus'
import NepaliDateInput from '../../components/NepaliDateInput'

interface BsRow {
  account: { id: number | null; code?: string; name: string }
  balance: number
}

interface BsResponse {
  assets: BsRow[]
  liabilities: BsRow[]
  equity: BsRow[]
  totals: { assets: number; liabilities: number; equity: number; liabilitiesEquity: number }
  balanced: boolean
}

const QUICK_RANGES = [
  { label: 'As of Today', from: () => '', to: () => new Date().toISOString().slice(0, 10) },
  { label: 'End of FY', from: () => '', to: () => fyEnd() },
  { label: 'Last FY End', from: () => '', to: () => lastFyEnd() },
  { label: 'All Time', from: () => '', to: () => '' },
]
function fyEnd(): string { const n = new Date(); return (n.getMonth() >= 6 ? n.getFullYear() + 1 : n.getFullYear()) + '-07-15' }
function lastFyEnd(): string { const n = new Date(); return (n.getMonth() >= 6 ? n.getFullYear() : n.getFullYear() - 1) + '-07-15' }

export default function BalanceSheet() {
  const navigate = useNavigate()
  const { tenantId } = useTenant()
  const tenantQuery = useTenantQuery()
  const { formatDate } = useCalendar()
  const [data, setData] = useState<BsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ledgerAccount, setLedgerAccount] = useState<{ id: string; name: string } | null>(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['assets', 'liabilities', 'equity']))

  const load = useCallback(async () => {
    try {
      const q: any = { ...tenantQuery }
      if (from) q.from = from
      if (to) q.to = to
      const res = await api<BsResponse>('/journal-entries/balance-sheet', { query: q })
      setData(res)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load balance sheet')
    } finally { setLoading(false) }
  }, [from, to, tenantId])

  useEffect(() => { load() }, [load])

  const toggle = (section: string) => setExpanded((prev) => {
    const next = new Set(prev)
    next.has(section) ? next.delete(section) : next.add(section)
    return next
  })

  const csv = () => {
    if (!data) return
    downloadCsv('balance-sheet.csv', ['Section', 'Account', 'Balance'], [
      ...data.assets.map((r) => ['Assets', r.account.name, r.balance]),
      ...data.liabilities.map((r) => ['Liabilities', r.account.name, r.balance]),
      ...data.equity.map((r) => ['Equity', r.account.name, r.balance]),
      ['', 'Total Assets', data.totals.assets],
      ['', 'Total Liabilities', data.totals.liabilities],
      ['', 'Total Equity', data.totals.equity],
      ['', 'Liabilities + Equity', data.totals.liabilitiesEquity],
    ])
  }

  const pdf = () => {
    if (!data) return
    exportReportPdf({
      filename: 'balance-sheet.pdf',
      title: 'Balance Sheet',
      subtitle: data.balanced ? 'Balanced' : 'Out of balance — verify your postings',
      meta: [['As of', to || 'Latest'], ['Generated', new Date().toLocaleString()]],
      tables: [
        {
          title: `Assets (${fmt(data.totals.assets)})`,
          columns: ['Account', 'Balance'],
          rows: data.assets.map((r) => [r.account.name, r.balance]),
        },
        {
          title: `Liabilities (${fmt(data.totals.liabilities)})`,
          columns: ['Account', 'Balance'],
          rows: data.liabilities.map((r) => [r.account.name, r.balance]),
        },
        {
          title: `Equity (${fmt(data.totals.equity)})`,
          columns: ['Account', 'Balance'],
          rows: data.equity.map((r) => [r.account.name, r.balance]),
        },
      ],
      foot: [
        { label: 'Total Assets', value: data.totals.assets },
        { label: 'Total Liabilities + Equity', value: data.totals.liabilitiesEquity },
      ],
    })
  }

  const Section = ({ title, rows, total, sectionKey, onAccountClick }: { title: string; rows: BsRow[]; total: number; sectionKey: string; onAccountClick?: (id: string, name: string) => void }) => (
    <div className="rounded-lg border border-slate-200 bg-white">
      <button onClick={() => toggle(sectionKey)} className="flex w-full items-center justify-between px-4 py-3 text-left">
        <div className="flex items-center gap-2">
          <svg className={`h-4 w-4 text-slate-400 transition-transform ${expanded.has(sectionKey) ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          <span className="text-sm font-semibold text-slate-800">{title}</span>
        </div>
        <span className="font-mono text-sm font-semibold text-slate-800">{fmt(total)}</span>
      </button>
      {expanded.has(sectionKey) && rows.length > 0 && (
        <table className="w-full border-t border-slate-100 text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2">Account</th>
              <th className="px-4 py-2 text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.account.id ?? r.account.name} className="border-b border-slate-50 last:border-0">
                <td className="px-4 py-2">
                  {r.account.id && onAccountClick ? (
                    <button onClick={() => onAccountClick(String(r.account.id), `${r.account.code ? `${r.account.code} · ` : ''}${r.account.name}`)} className="text-left text-slate-700 hover:text-blue-700 hover:underline">
                      {r.account.code ? `${r.account.code} · ` : ''}{r.account.name}
                    </button>
                  ) : (
                    <span className="text-slate-700">{r.account.code ? `${r.account.code} · ` : ''}{r.account.name}</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right font-mono text-slate-800">{fmt(r.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/reports')} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><ArrowLeft size={18} /></button>
          <h1 className="text-lg font-semibold text-slate-900">Balance Sheet</h1>
        </div>
        <div className="print:hidden flex items-center gap-2">
          <button onClick={csv} disabled={loading || !data} className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"><Download size={14} /> CSV</button>
          <button onClick={pdf} disabled={loading || !data} className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"><FileText size={14} /> PDF</button>
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
      {loading && !data ? <ReportSkeleton sections={3} /> : data && (
        <>
          {/* Balance check banner */}
          <div className={`mt-4 rounded-lg border px-4 py-3 text-sm font-medium ${data.balanced ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
            {data.balanced ? '✓ Assets = Liabilities + Equity — balance sheet is balanced.' : `✗ Out of balance — Assets ${fmt(data.totals.assets)} vs Liabilities+Equity ${fmt(data.totals.liabilitiesEquity)}.`}
          </div>

          {/* KPI summary */}
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Total Assets</div>
              <div className="mt-1 font-mono text-xl font-semibold text-emerald-700">{fmt(data.totals.assets)}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Total Liabilities</div>
              <div className="mt-1 font-mono text-xl font-semibold text-red-600">{fmt(data.totals.liabilities)}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Total Equity</div>
              <div className="mt-1 font-mono text-xl font-semibold text-amber-700">{fmt(data.totals.equity)}</div>
            </div>
          </div>

          {/* Sections */}
          <div className="mt-4 space-y-3">
            <Section title="Assets" rows={data.assets} total={data.totals.assets} sectionKey="assets" onAccountClick={(id, name) => setLedgerAccount({ id, name })} />
            <Section title="Liabilities" rows={data.liabilities} total={data.totals.liabilities} sectionKey="liabilities" onAccountClick={(id, name) => setLedgerAccount({ id, name })} />
            <Section title="Equity" rows={data.equity} total={data.totals.equity} sectionKey="equity" onAccountClick={(id, name) => setLedgerAccount({ id, name })} />
          </div>

          {/* Grand totals */}
          <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex justify-between text-sm">
              <span className="font-semibold text-slate-700">Total Assets</span>
              <span className="font-mono font-semibold text-emerald-700">{fmt(data.totals.assets)}</span>
            </div>
            <div className="mt-1 flex justify-between text-sm">
              <span className="font-semibold text-slate-700">Total Liabilities + Equity</span>
              <span className="font-mono font-semibold text-amber-700">{fmt(data.totals.liabilitiesEquity)}</span>
            </div>
          </div>
        </>
      )}

      {ledgerAccount && (
        <LedgerModal
          accountId={ledgerAccount.id}
          accountName={ledgerAccount.name}
          onClose={() => setLedgerAccount(null)}
        />
      )}
    </div>
  )
}
