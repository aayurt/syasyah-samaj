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

type StatusFilter = 'all' | 'draft' | 'posted' | 'void'

const QUICK_RANGES = [
  { label: 'This Month', from: () => monthStart(0), to: () => monthEnd(0) },
  { label: 'Last Month', from: () => monthStart(-1), to: () => monthEnd(-1) },
  { label: 'This FY', from: () => fyStart(), to: () => fyEnd() },
  { label: 'All Time', from: () => '', to: () => '' },
]

function monthStart(offset: number): string {
  const d = new Date(); d.setMonth(d.getMonth() + offset, 1); return d.toISOString().slice(0, 10)
}
function monthEnd(offset: number): string {
  const d = new Date(); d.setMonth(d.getMonth() + offset + 1, 0); return d.toISOString().slice(0, 10)
}
function fyStart(): string {
  const now = new Date(); const y = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1; return `${y}-07-16`
}
function fyEnd(): string {
  const now = new Date(); const y = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear(); return `${y}-07-15`
}

function computePayments(invoices: Document[], payments: Document[]): Map<number, number> {
  const payByParty = new Map<number | null, Document[]>()
  for (const p of payments) {
    const pid = p.party && typeof p.party === 'object' ? (p.party as Party).id : (p.party as number || null)
    const arr = payByParty.get(pid) || []
    arr.push(p)
    payByParty.set(pid, arr)
  }
  const result = new Map<number, number>()
  for (const inv of invoices) {
    const invParty = inv.party && typeof inv.party === 'object' ? (inv.party as Party).id : (inv.party as number || null)
    const invDate = inv.date || ''
    const invAmount = Number(inv.grossTotal) || 0
    const partyPayments = payByParty.get(invParty) || []
    let remaining = invAmount
    let paid = 0
    const sorted = [...partyPayments].sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    for (const p of sorted) {
      if (remaining <= 0) break
      if ((p.date || '') < invDate) continue
      const amt = Math.min(Number(p.grossTotal) || 0, remaining)
      paid += amt
      remaining -= amt
    }
    result.set(inv.id, paid)
  }
  return result
}

interface Row {
  doc: Document
  partyName: string
  amount: number
  paid: number
  balance: number
  type: 'purchase' | 'return'
}

export default function PurchaseReport() {
  const navigate = useNavigate()
  const { tenantId } = useTenant()
  const tenantQuery = useTenantQuery()
  const { formatDate } = useCalendar()
  const [invoices, setInvoices] = useState<Document[]>([])
  const [debitNotes, setDebitNotes] = useState<Document[]>([])
  const [payments, setPayments] = useState<Document[]>([])
  const [parties, setParties] = useState<Party[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const q: Record<string, string | number> = { sort: '-date', depth: 1, ...tenantQuery }
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
      const [docs, p] = await Promise.all([
        list<Document>('documents', q),
        list<Party>('parties', { depth: 0, sort: 'name', ...tenantQuery }),
      ])
      // Fetch payment vouchers for matching
      const pQuery: Record<string, string | number> = { sort: 'date', depth: 0, ...tenantQuery }
      if (from && to) {
        pQuery.where = JSON.stringify({ and: [
          { docType: { equals: 'payment-voucher' } },
          { date: { greater_than_equal: from } },
          { date: { less_than_equal: to + 'T23:59:59' } },
        ]})
      } else {
        pQuery.where = JSON.stringify({ docType: { equals: 'payment-voucher' } })
      }
      const pDocs = await list<Document>('documents', pQuery)

      setInvoices(docs.docs.filter((d) => d.docType === 'purchase-invoice'))
      setDebitNotes(docs.docs.filter((d) => d.docType === 'debit-note'))
      setPayments(pDocs.docs)
      setParties(p.docs)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load purchase report')
    } finally { setLoading(false) }
  }, [from, to, tenantId])

  useEffect(() => { load() }, [load])

  const partyName = (d: Document) =>
    d.party && typeof d.party === 'object' ? (d.party as Party).name : parties.find((p) => p.id === d.party)?.name || '—'

  const paymentMap = useMemo(() => computePayments(invoices, payments), [invoices, payments])

  const rows: Row[] = useMemo(() => {
    const all = [
      ...invoices.map((d) => ({ doc: d, partyName: partyName(d), amount: Number(d.grossTotal) || 0, paid: paymentMap.get(d.id) || 0, balance: (Number(d.grossTotal) || 0) - (paymentMap.get(d.id) || 0), type: 'purchase' as const })),
      ...debitNotes.map((d) => ({ doc: d, partyName: partyName(d), amount: Number(d.grossTotal) || 0, paid: 0, balance: 0, type: 'return' as const })),
    ]
    return all.filter((r) => {
      if (statusFilter !== 'all' && r.doc.status !== statusFilter) return false
      if (query) {
        const s = `${r.doc.number || ''} ${r.doc.narration || ''} ${r.partyName}`.toLowerCase()
        if (!s.includes(query.toLowerCase())) return false
      }
      return true
    })
  }, [invoices, debitNotes, paymentMap, statusFilter, query, parties])

  const totalPurchases = invoices.reduce((s, d) => s + (Number(d.grossTotal) || 0), 0)
  const totalPaid = invoices.reduce((s, d) => s + (paymentMap.get(d.id) || 0), 0)
  const totalUnpaid = totalPurchases - totalPaid

  const kpis = [
    { label: 'Total Entries', value: String(invoices.length), sub: `${debitNotes.length} return${debitNotes.length !== 1 ? 's' : ''}` },
    { label: 'Total Purchases', value: fmt(totalPurchases) },
    { label: 'Paid', value: fmt(totalPaid) },
    { label: 'Unpaid', value: fmt(totalUnpaid), alert: totalUnpaid > 0 },
  ]

  const csv = () => downloadCsv('purchase-report.csv',
    ['Date', 'Invoice No', 'Party', 'Status', 'Type', 'Amount', 'Paid', 'Balance'],
    rows.map((r) => [formatDate(r.doc.date), r.doc.number || '', r.partyName, r.doc.status, r.type === 'return' ? 'Return' : 'Purchase', r.amount, r.paid, r.balance]))

  const pdf = () => exportReportPdf({
    filename: 'purchase-report.pdf', title: 'Purchase Report',
    meta: [['From', from || 'Earliest'], ['To', to || 'Latest'], ['Generated', formatDate(new Date().toISOString())]],
    tables: [{ columns: ['Date', 'Invoice', 'Party', 'Status', 'Amount', 'Paid', 'Balance'],
      rows: rows.map((r) => [formatDate(r.doc.date), r.doc.number || '—', r.partyName, r.doc.status, r.amount, r.paid, r.balance]),
      totals: ['Total', '', '', '', totalPurchases, totalPaid, totalUnpaid] }],
  })

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/reports')} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><ArrowLeft size={18} /></button>
          <h1 className="text-lg font-semibold text-slate-900">Purchase Report</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={csv} disabled={loading} className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"><Download size={14} /> CSV</button>
          <button onClick={pdf} disabled={loading} className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"><FileText size={14} /> PDF</button>
          <button onClick={() => window.print()} disabled={loading} className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"><Printer size={14} /> Print</button>
        </div>
      </div>
      <div className="mt-2"><DataStatus /></div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <SearchBox value={query} onChange={setQuery} placeholder="Search purchases…" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} className="rounded border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-slate-500">
          <option value="all">All Status</option>
          <option value="posted">Posted</option>
          <option value="draft">Draft</option>
          <option value="void">Void</option>
        </select>
        <div className="flex items-center gap-2">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-slate-500" />
          <span className="text-xs text-slate-400">to</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-slate-500" />
        </div>
        <div className="flex gap-1">
          {QUICK_RANGES.map((r) => (
            <button key={r.label} onClick={() => { setFrom(r.from()); setTo(r.to()) }} className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50">{r.label}</button>
          ))}
        </div>
      </div>
      {error && <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {loading ? <ReportSkeleton sections={1} /> : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {kpis.map((k) => (
              <div key={k.label} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">{k.label}</div>
                <div className={`mt-1 font-mono text-lg font-semibold ${k.alert ? 'text-red-600' : 'text-amber-700'}`}>{k.value}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Invoice No</th>
                  <th className="px-4 py-2">Party</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                  <th className="px-4 py-2 text-right">Paid</th>
                  <th className="px-4 py-2 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No purchase entries found.</td></tr>}
                {rows.map((r) => (
                  <tr key={r.doc.id} className="border-b border-slate-50">
                    <td className="px-4 py-2 text-slate-600">{formatDate(r.doc.date)}</td>
                    <td className="px-4 py-2 font-mono text-slate-700">{r.doc.number || '—'}</td>
                    <td className="px-4 py-2 text-slate-800">{r.partyName}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <StatusPill status={r.doc.status} />
                        {r.type === 'return' && <span className="text-xs font-medium text-amber-600">Return</span>}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-slate-800">{fmt(r.amount)}</td>
                    <td className="px-4 py-2 text-right font-mono text-emerald-700">{r.type === 'purchase' ? fmt(r.paid) : '—'}</td>
                    <td className={`px-4 py-2 text-right font-mono ${r.balance > 0 ? 'text-red-600 font-medium' : 'text-slate-500'}`}>
                      {r.type === 'purchase' ? fmt(r.balance) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr className="border-t border-slate-200 bg-slate-50">
                    <td colSpan={4} className="px-4 py-2 text-xs font-semibold uppercase text-slate-600">Totals</td>
                    <td className="px-4 py-2 text-right font-mono font-semibold text-slate-900">{fmt(totalPurchases)}</td>
                    <td className="px-4 py-2 text-right font-mono font-semibold text-emerald-700">{fmt(totalPaid)}</td>
                    <td className="px-4 py-2 text-right font-mono font-semibold text-red-600">{fmt(totalUnpaid)}</td>
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
