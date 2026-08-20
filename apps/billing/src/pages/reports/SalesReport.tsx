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
import SearchBox from '../../components/SearchBox'
import { StatusPill } from '../Dashboard'
import type { Document, Party } from '../../lib/types'

type DocTypeFilter = 'all' | 'sales-invoice' | 'credit-note'
type StatusFilter = 'all' | 'draft' | 'posted' | 'void'

const QUICK_RANGES = [
  { label: 'This Month', from: () => monthStart(0), to: () => monthEnd(0) },
  { label: 'Last Month', from: () => monthStart(-1), to: () => monthEnd(-1) },
  { label: 'This FY', from: () => fyStart(), to: () => fyEnd() },
  { label: 'All Time', from: () => '', to: () => '' },
]

function monthStart(offset: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() + offset, 1)
  return d.toISOString().slice(0, 10)
}
function monthEnd(offset: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() + offset + 1, 0)
  return d.toISOString().slice(0, 10)
}
function fyStart(): string {
  const now = new Date()
  const year = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1
  return `${year}-07-16`
}
function fyEnd(): string {
  const now = new Date()
  const year = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear()
  return `${year}-07-15`
}

export default function SalesReport() {
  const navigate = useNavigate()
  const { tenantId } = useTenant()
  const tenantQuery = useTenantQuery()
  const { formatDate } = useCalendar()
  const [docs, setDocs] = useState<Document[]>([])
  const [parties, setParties] = useState<Party[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const q: Record<string, string> = {
        sort: '-date',
        depth: 1,
        ...tenantQuery,
      }
      if (from) q.where = JSON.stringify({ date: { greater_than_equal: from } })
      if (to) q.where = JSON.stringify({ and: [
        { date: { greater_than_equal: from || '0000-00-00' } },
        { date: { less_than_equal: to + 'T23:59:59' } },
      ]})

      const [d, p] = await Promise.all([
        list<Document>('documents', q),
        list<Party>('parties', { depth: 0, sort: 'name', ...tenantQuery }),
      ])
      // Filter to sales-invoice + credit-note only
      const filtered = d.docs.filter(
        (doc) => doc.docType === 'sales-invoice' || doc.docType === 'credit-note',
      )
      setDocs(filtered)
      setParties(p.docs)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load sales report')
    } finally {
      setLoading(false)
    }
  }, [from, to, tenantId])

  useEffect(() => { load() }, [load])

  const partyName = (d: Document) =>
    d.party && typeof d.party === 'object'
      ? (d.party as Party).name
      : parties.find((p) => p.id === d.party)?.name || '—'

  const filtered = useMemo(() => {
    return docs.filter((d) => {
      if (statusFilter !== 'all' && d.status !== statusFilter) return false
      if (query) {
        const s = `${d.number || ''} ${d.narration || ''} ${partyName(d)}`.toLowerCase()
        if (!s.includes(query.toLowerCase())) return false
      }
      return true
    })
  }, [docs, statusFilter, query, parties])

  const invoices = filtered.filter((d) => d.docType === 'sales-invoice')
  const returns = filtered.filter((d) => d.docType === 'credit-note')

  const kpis = [
    {
      label: 'Total Entries',
      value: String(invoices.length),
      sub: `${returns.length} return${returns.length !== 1 ? 's' : ''}`,
    },
    {
      label: 'Total Sales',
      value: fmt(invoices.reduce((s, d) => s + (Number(d.grossTotal) || 0), 0)),
    },
    {
      label: 'Posted',
      value: String(invoices.filter((d) => d.status === 'posted').length),
    },
    {
      label: 'Drafts',
      value: String(invoices.filter((d) => d.status === 'draft').length),
      alert: invoices.some((d) => d.status === 'draft'),
    },
  ]

  const csv = () =>
    downloadCsv(
      'sales-report.csv',
      ['Date', 'Invoice No', 'Party', 'Status', 'Amount', 'Type'],
      filtered.map((d) => [
        formatDate(d.date),
        d.number || '',
        partyName(d),
        d.status,
        d.grossTotal || 0,
        d.docType === 'credit-note' ? 'Return' : 'Sale',
      ]),
    )

  const pdf = () =>
    exportReportPdf({
      filename: 'sales-report.pdf',
      title: 'Sales Report',
      meta: [
        ['From', from || 'Earliest'],
        ['To', to || 'Latest'],
        ['Generated', formatDate(new Date().toISOString())],
      ],
      tables: [
        {
          columns: ['Date', 'Invoice No', 'Party', 'Status', 'Amount'],
          rows: filtered.map((d) => [
            formatDate(d.date),
            d.number || '—',
            partyName(d),
            d.status,
            Number(d.grossTotal) || 0,
          ]),
          totals: ['Total', '', '', '', invoices.reduce((s, d) => s + (Number(d.grossTotal) || 0), 0)],
        },
      ],
    })

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/reports')}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-lg font-semibold text-slate-900">Sales Report</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={csv}
            disabled={loading}
            className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            <Download size={14} /> CSV
          </button>
          <button
            onClick={pdf}
            disabled={loading}
            className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            <FileText size={14} /> PDF
          </button>
          <button
            onClick={() => window.print()}
            disabled={loading}
            className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            <Printer size={14} /> Print
          </button>
        </div>
      </div>

      <div className="mt-2"><DataStatus /></div>

      {/* Filters */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <SearchBox value={query} onChange={setQuery} placeholder="Search invoices…" />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="rounded border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-slate-500"
        >
          <option value="all">All Status</option>
          <option value="posted">Posted</option>
          <option value="draft">Draft</option>
          <option value="void">Void</option>
        </select>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-slate-500"
          />
          <span className="text-xs text-slate-400">to</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-slate-500"
          />
        </div>
        <div className="flex gap-1">
          {QUICK_RANGES.map((r) => (
            <button
              key={r.label}
              onClick={() => { setFrom(r.from()); setTo(r.to()) }}
              className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {loading ? (
        <ReportSkeleton sections={1} />
      ) : (
        <>
          {/* KPI cards */}
          <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {kpis.map((k) => (
              <div key={k.label} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">{k.label}</div>
                <div className="mt-1 font-mono text-lg font-semibold text-amber-700">{k.value}</div>
                {k.sub && <div className="mt-0.5 text-xs text-slate-400">{k.sub}</div>}
              </div>
            ))}
          </div>

          {/* Table */}
          <div className="mt-4 rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Invoice No</th>
                  <th className="px-4 py-2">Party</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      No sales entries found.
                    </td>
                  </tr>
                )}
                {filtered.map((d) => (
                  <tr key={d.id} className="border-b border-slate-50">
                    <td className="px-4 py-2 text-slate-600">{formatDate(d.date)}</td>
                    <td className="px-4 py-2 font-mono text-slate-700">{d.number || '—'}</td>
                    <td className="px-4 py-2 text-slate-800">{partyName(d)}</td>
                    <td className="px-4 py-2"><StatusPill status={d.status} /></td>
                    <td className="px-4 py-2 text-slate-500">
                      {d.docType === 'credit-note' ? (
                        <span className="text-xs font-medium text-amber-600">Return</span>
                      ) : 'Sale'}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-slate-800">
                      {fmt(Number(d.grossTotal) || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
              {filtered.length > 0 && (
                <tfoot>
                  <tr className="border-t border-slate-200 bg-slate-50">
                    <td colSpan={5} className="px-4 py-2 text-xs font-semibold uppercase text-slate-600">
                      Totals ({filtered.length} entries)
                    </td>
                    <td className="px-4 py-2 text-right font-mono font-semibold text-slate-900">
                      {fmt(invoices.reduce((s, d) => s + (Number(d.grossTotal) || 0), 0))}
                    </td>
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
