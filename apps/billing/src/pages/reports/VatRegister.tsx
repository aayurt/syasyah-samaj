import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Download, FileText, Printer } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { fmt, list } from '../../lib/api'
import { downloadCsv } from '../../lib/csv'
import { exportReportPdf } from '../../lib/pdf'
import { useCalendar } from '../../lib/calendar'
import { useFiscalYear } from '../../lib/fiscalYear'
import { useTenant, useTenantQuery } from '../../lib/tenant'
import { ReportSkeleton } from '../../components/Skeleton'
import DataStatus from '../../components/DataStatus'
import NepaliDateInput from '../../components/NepaliDateInput'
import type { Document, Party } from '../../lib/types'
import {
  buildRegisterRows,
  docMatchesMode,
  hasVatTax,
  modeLabel,
  signed,
  VAT_MODES,
  type VatRegisterMode,
  type VatRow,
} from './vatShared'

const QUICK_RANGES = [
  { label: 'This Month', from: () => monthStart(0), to: () => monthEnd(0) },
  { label: 'Last Month', from: () => monthStart(-1), to: () => monthEnd(-1) },
  { label: 'This FY', from: () => fyStart(), to: () => fyEnd() },
  { label: 'All Time', from: () => '', to: () => '' },
]

function monthStart(offset: number): string {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + offset); return d.toISOString().slice(0, 10)
}
function monthEnd(offset: number): string {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + offset + 1, 0); return d.toISOString().slice(0, 10)
}
function fyStart(): string {
  const now = new Date(); const y = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1; return `${y}-07-16`
}
function fyEnd(): string {
  const now = new Date(); const y = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear(); return `${y}-07-15`
}

const fmtSigned = (n: number) => (n < 0 ? `(${fmt(-n)})` : fmt(n))

export default function VatRegister() {
  const navigate = useNavigate()
  const { tenantId } = useTenant()
  const tenantQuery = useTenantQuery()
  const { formatDate } = useCalendar()
  const { selectedYear } = useFiscalYear()
  const [mode, setMode] = useState<VatRegisterMode>('sales')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [vatOnly, setVatOnly] = useState(true)
  const [rows, setRows] = useState<VatRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Quick range presets + fiscal-year default on first load.
  useEffect(() => {
    if (from || to) return
    if (selectedYear?.startDate && selectedYear?.endDate) {
      setFrom(String(selectedYear.startDate).slice(0, 10))
      setTo(String(selectedYear.endDate).slice(0, 10))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear?.id])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const q: Record<string, string | number> = { sort: 'date', depth: 1, limit: 1000, ...tenantQuery }
      if (from && to) {
        q.where = JSON.stringify({ and: [
          { date: { greater_than_equal: from } },
          { date: { less_than_equal: to + 'T23:59:59' } },
        ]})
      } else if (from) {
        q.where = JSON.stringify({ date: { greater_than_equal: from } })
      } else if (to) {
        q.where = JSON.stringify({ date: { less_than_equal: to + 'T23:59:59' } })
      }
      const [d, p] = await Promise.all([
        list<Document>('documents', q),
        list<Party>('parties', { depth: 0, sort: 'name', limit: 1000, ...tenantQuery }),
      ])
      const partyMap = new Map<number | string, Party>(p.docs.map((x) => [x.id, x]))
      let docs = d.docs.filter((doc) => docMatchesMode(doc, mode))
      if (vatOnly) docs = docs.filter(hasVatTax)
      setRows(buildRegisterRows(docs, mode, partyMap))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load register')
    } finally {
      setLoading(false)
    }
  }, [from, to, mode, vatOnly, tenantId])

  useEffect(() => { load() }, [load])

  const totals = useMemo(() => {
    let taxable = 0, vat = 0, total = 0
    for (const r of rows) {
      const s = signed(r)
      taxable += s.taxable
      vat += s.vat
      total += s.total
    }
    return { taxable, vat, total }
  }, [rows])

  // Net VAT payable on the sales view: output (sales − sales returns) vs
  // input (purchase − purchase returns) computed from this register's data is
  // partial; we show the current view's summary instead.
  const isReturnView = mode === 'sales-return' || mode === 'purchase-return'

  const csv = () => downloadCsv(
    `vat-${mode}.csv`,
    ['Date', 'Register No', 'Party', 'PAN', 'Narration', 'Rate %', 'Taxable', 'VAT', 'Total'],
    rows.map((e) => {
      const s = signed(e)
      return [
        formatDate(e.date), e.number || '', e.partyName, e.partyPan || '',
        e.narration || '', e.rate != null ? `${e.rate}%` : '',
        s.taxable, s.vat, s.total,
      ]
    }),
  )

  const pdf = () => exportReportPdf({
    filename: `vat-${mode}.pdf`,
    title: modeLabel(mode),
    subtitle: from && to ? `${from} → ${to}` : undefined,
    meta: [['From', from || 'Earliest'], ['To', to || 'Latest']],
    tables: [{
      columns: ['Date', 'No', 'Party', 'PAN', 'Taxable', 'VAT', 'Total'],
      rows: rows.map((e) => {
        const s = signed(e)
        return [
          formatDate(e.date), e.number || '—', e.partyName, e.partyPan || '—',
          s.taxable, s.vat, s.total,
        ]
      }),
      totals: ['Totals', '', '', '', totals.taxable, totals.vat, totals.total],
    }],
  })

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/reports')} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><ArrowLeft size={18} /></button>
          <h1 className="text-lg font-semibold text-slate-900">VAT Registers</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={csv} disabled={loading} className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"><Download size={14} /> CSV</button>
          <button onClick={pdf} disabled={loading} className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"><FileText size={14} /> PDF</button>
          <button onClick={() => window.print()} disabled={loading} className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"><Printer size={14} /> Print</button>
        </div>
      </div>
      <div className="mt-2"><DataStatus /></div>

      {/* Mode tabs */}
      <div className="mt-4 flex flex-wrap gap-2">
        {VAT_MODES.map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              mode === m
                ? 'bg-crimson-600 text-white'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {modeLabel(m)}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <NepaliDateInput compact value={from} onChange={(v) => setFrom(v)} />
        <span className="text-xs text-slate-400">to</span>
        <NepaliDateInput compact value={to} onChange={(v) => setTo(v)} />
        {QUICK_RANGES.map((r) => (
          <button
            key={r.label}
            onClick={() => { setFrom(r.from()); setTo(r.to()) }}
            className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            {r.label}
          </button>
        ))}
        <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600">
          <input type="checkbox" checked={vatOnly} onChange={(e) => setVatOnly(e.target.checked)} className="h-3.5 w-3.5 rounded border-slate-300 text-crimson-600 focus:ring-crimson-500" />
          VAT only
        </label>
      </div>

      {error && <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {loading && rows.length === 0 ? <ReportSkeleton sections={1} /> : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Entries</div>
              <div className="mt-1 font-mono text-lg font-semibold text-slate-800">{rows.length}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Taxable</div>
              <div className="mt-1 font-mono text-lg font-semibold text-slate-800">{fmtSigned(totals.taxable)}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">{isReturnView ? 'VAT (returned)' : 'VAT'}</div>
              <div className="mt-1 font-mono text-lg font-semibold text-amber-700">{fmtSigned(totals.vat)}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Grand Total</div>
              <div className="mt-1 font-mono text-lg font-semibold text-emerald-700">{fmtSigned(totals.total)}</div>
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Register No</th>
                  <th className="px-4 py-2">Party</th>
                  <th className="px-4 py-2">PAN</th>
                  <th className="px-4 py-2">Narration</th>
                  <th className="px-4 py-2 text-right">Rate %</th>
                  <th className="px-4 py-2 text-right">Taxable</th>
                  <th className="px-4 py-2 text-right">VAT</th>
                  <th className="px-4 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400">No entries found in this register.</td></tr>}
                {rows.map((e, i) => {
                  const s = signed(e)
                  return (
                    <tr key={`${e.docId}-${i}`} className={`border-b border-slate-50 ${e.isReturn ? 'bg-red-50/40' : ''}`}>
                      <td className="px-4 py-2 text-slate-600">{formatDate(e.date)}</td>
                      <td className="px-4 py-2 font-mono text-slate-700">{e.number || '—'}</td>
                      <td className="px-4 py-2 text-slate-800">{e.partyName}</td>
                      <td className="px-4 py-2 font-mono text-xs text-slate-500">{e.partyPan || '—'}</td>
                      <td className="max-w-[200px] truncate px-4 py-2 text-xs text-slate-400">{e.narration || '—'}</td>
                      <td className="px-4 py-2 text-right font-mono text-slate-600">{e.rate != null ? `${e.rate}%` : '—'}</td>
                      <td className="px-4 py-2 text-right font-mono text-slate-700">{fmtSigned(s.taxable)}</td>
                      <td className="px-4 py-2 text-right font-mono font-medium text-amber-700">{fmtSigned(s.vat)}</td>
                      <td className="px-4 py-2 text-right font-mono font-semibold text-slate-800">{fmtSigned(s.total)}</td>
                    </tr>
                  )
                })}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr className="border-t border-slate-200 bg-slate-50">
                    <td colSpan={6} className="px-4 py-2 text-xs font-semibold uppercase text-slate-600">Totals</td>
                    <td className="px-4 py-2 text-right font-mono font-semibold text-slate-900">{fmtSigned(totals.taxable)}</td>
                    <td className="px-4 py-2 text-right font-mono font-semibold text-slate-900">{fmtSigned(totals.vat)}</td>
                    <td className="px-4 py-2 text-right font-mono font-semibold text-slate-900">{fmtSigned(totals.total)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            {mode === 'sales' && 'Posted sales invoices. Pair with the Sales Return Register for net sales.'}
            {mode === 'purchase' && 'Posted purchase invoices. Pair with the Purchase Return Register for net purchases.'}
            {mode === 'sales-return' && 'Credit notes against sales — shown as negative so net sales reconcile.'}
            {mode === 'purchase-return' && 'Credit notes against purchases — shown as negative so net purchases reconcile.'}
          </p>
        </>
      )}
    </div>
  )
}
