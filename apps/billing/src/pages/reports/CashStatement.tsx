import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Download, FileText, Printer } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api, fmt, list } from '../../lib/api'
import { downloadCsv } from '../../lib/csv'
import { exportReportPdf } from '../../lib/pdf'
import { useCalendar } from '../../lib/calendar'
import { useTenant, useTenantQuery } from '../../lib/tenant'
import { ReportSkeleton } from '../../components/Skeleton'
import DataStatus from '../../components/DataStatus'
import type { Account, JournalEntry } from '../../lib/types'
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

interface Row {
  id: number
  date: string
  narration: string
  docNumber: string | null
  accountName: string
  debit: number
  credit: number
  runningBalance: number
}

export default function CashStatement() {
  const navigate = useNavigate()
  const { tenantId } = useTenant()
  const tenantQuery = useTenantQuery()
  const { formatDate } = useCalendar()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const load = useCallback(async () => {
    try {
      const [accts, entries] = await Promise.all([
        list<Account>('gl-accounts', { depth: 0, ...tenantQuery }),
        list<JournalEntry>('journal-entries', { depth: 1, sort: 'date', ...tenantQuery }),
      ])
      // Get cash account IDs
      const cashIds = new Set(accts.docs.filter((a) => a.class === 'cash').map((a) => a.id))
      const cashNames = new Map(accts.docs.filter((a) => a.class === 'cash').map((a) => [a.id, `${a.code ? a.code + ' · ' : ''}${a.name}`]))

      let filtered = entries.docs.filter((e) => {
        const lines = Array.isArray(e.lines) ? e.lines : []
        return lines.some((l) => {
          const accId = typeof l.account === 'object' && l.account ? (l.account as { id: number }).id : l.account
          return cashIds.has(Number(accId))
        })
      })

      // Date filter
      if (from) filtered = filtered.filter((e) => (e.date || '') >= from)
      if (to) filtered = filtered.filter((e) => (e.date || '') <= to + 'T23:59:59')

      // Build rows from cash lines
      const result: Row[] = []
      let running = 0
      for (const e of filtered) {
        const lines = Array.isArray(e.lines) ? e.lines : []
        for (const l of lines) {
          const accId = typeof l.account === 'object' && l.account ? (l.account as { id: number }).id : l.account
          if (!cashIds.has(Number(accId))) continue
          const debit = Number(l.debit) || 0
          const credit = Number(l.credit) || 0
          running += debit - credit
          result.push({
            id: e.id, date: e.date || '', narration: e.narration || '',
            docNumber: null, accountName: cashNames.get(Number(accId)) || 'Cash',
            debit, credit, runningBalance: running,
          })
        }
      }
      setRows(result)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load cash statement')
    } finally { setLoading(false) }
  }, [from, to, tenantId])

  useEffect(() => { load() }, [load])

  const totalDebit = rows.reduce((s, r) => s + r.debit, 0)
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0)
  const closing = rows.length > 0 ? rows[rows.length - 1].runningBalance : 0

  const csv = () => downloadCsv('cash-statement.csv', ['Date', 'Narration', 'Account', 'Debit', 'Credit', 'Running'],
    rows.map((r) => [formatDate(r.date), r.narration, r.accountName, r.debit || '', r.credit || '', r.runningBalance]))

  const pdf = () => exportReportPdf({
    filename: 'cash-statement.pdf', title: 'Cash In Hand Statement',
    meta: [['From', from || 'Earliest'], ['To', to || 'Latest'], ['Closing Balance', fmt(closing)]],
    tables: [{ columns: ['Date', 'Narration', 'Account', 'Debit', 'Credit', 'Running'],
      rows: rows.map((r) => [formatDate(r.date), r.narration, r.accountName, r.debit || '', r.credit || '', r.runningBalance]),
      totals: ['Totals', '', '', totalDebit, totalCredit, closing] }],
  })

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/reports')} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><ArrowLeft size={18} /></button>
          <h1 className="text-lg font-semibold text-slate-900">Cash In Hand Statement</h1>
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
          {QUICK_RANGES.map((r) => (
            <button key={r.label} onClick={() => { setFrom(r.from()); setTo(r.to()) }} className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50">{r.label}</button>
          ))}
        </div>
      </div>
      {error && <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {loading && rows.length === 0 ? <ReportSkeleton sections={1} /> : (
        <>
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Total Receipts</div>
              <div className="mt-1 font-mono text-lg font-semibold text-emerald-700">{fmt(totalDebit)}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Total Payments</div>
              <div className="mt-1 font-mono text-lg font-semibold text-red-600">{fmt(totalCredit)}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Closing Balance</div>
              <div className="mt-1 font-mono text-lg font-semibold text-amber-700">{fmt(closing)}</div>
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Narration</th>
                  <th className="px-4 py-2">Account</th>
                  <th className="px-4 py-2 text-right">Debit</th>
                  <th className="px-4 py-2 text-right">Credit</th>
                  <th className="px-4 py-2 text-right">Running</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No cash transactions found.</td></tr>}
                {rows.map((r, i) => (
                  <tr key={`${r.id}-${i}`} className="border-b border-slate-50">
                    <td className="px-4 py-2 text-slate-600">{formatDate(r.date)}</td>
                    <td className="px-4 py-2 text-slate-800">{r.narration || '—'}</td>
                    <td className="px-4 py-2 text-slate-500">{r.accountName}</td>
                    <td className="px-4 py-2 text-right font-mono text-emerald-700">{r.debit ? fmt(r.debit) : ''}</td>
                    <td className="px-4 py-2 text-right font-mono text-red-600">{r.credit ? fmt(r.credit) : ''}</td>
                    <td className="px-4 py-2 text-right font-mono font-medium text-slate-800">{fmt(r.runningBalance)}</td>
                  </tr>
                ))}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr className="border-t border-slate-200 bg-slate-50">
                    <td colSpan={3} className="px-4 py-2 text-xs font-semibold uppercase text-slate-600">Totals</td>
                    <td className="px-4 py-2 text-right font-mono font-semibold text-emerald-700">{fmt(totalDebit)}</td>
                    <td className="px-4 py-2 text-right font-mono font-semibold text-red-600">{fmt(totalCredit)}</td>
                    <td className="px-4 py-2 text-right font-mono font-semibold text-slate-900">{fmt(closing)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}
    </div>
  )
}
