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
import { effectiveNet, type Document, type Party, type TaxType } from '../../lib/types'

interface TaxEntry {
  docId: number
  date: string
  number: string | null
  partyName: string
  taxTypeName: string
  rate: number
  baseAmount: number
  taxAmount: number
  nature: string
}

export default function TaxSales() {
  const navigate = useNavigate()
  const { tenantId } = useTenant()
  const tenantQuery = useTenantQuery()
  const { formatDate } = useCalendar()
  const [entries, setEntries] = useState<TaxEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

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
      }
      const [d, tx, p] = await Promise.all([
        list<Document>('documents', q),
        list<TaxType>('tax-types', { depth: 0, ...tenantQuery }),
        list<Party>('parties', { depth: 0, sort: 'name', ...tenantQuery }),
      ])
      const taxTypeMap = new Map(tx.docs.map((t) => [t.id, t]))
      const partyMap = new Map(p.docs.map((p) => [p.id, p.name]))
      const rows: TaxEntry[] = []
      for (const doc of d.docs) {
        if (doc.docType !== 'sales-invoice' && doc.docType !== 'receipt-voucher') continue
        if (doc.status !== 'posted') continue
        if (!doc.taxLines?.length) continue
        const pName = doc.party && typeof doc.party === 'object'
          ? (doc.party as Party).name
          : partyMap.get(Number(doc.party)) || '—'
        for (const tl of doc.taxLines) {
          const tt = tl.taxType && typeof tl.taxType === 'object' ? tl.taxType as TaxType : taxTypeMap.get(Number(tl.taxType))
          if (!tt) continue
          if (tt.nature === 'withholding') continue // skip TDS for tax-sales
          const rate = Number(tl.rate) || Number(tt.rate) || 0
          const lineSum = effectiveNet(doc)
          const taxAmt = (lineSum * rate) / 100
          rows.push({
            docId: doc.id, date: doc.date || '', number: doc.number || null,
            partyName: pName, taxTypeName: tt.name, rate,
            baseAmount: lineSum, taxAmount: taxAmt, nature: tt.nature,
          })
        }
      }
      setEntries(rows)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load tax sales')
    } finally { setLoading(false) }
  }, [from, to, tenantId])

  useEffect(() => { load() }, [load])

  const totals = useMemo(() => ({
    base: entries.reduce((s, e) => s + e.baseAmount, 0),
    tax: entries.reduce((s, e) => s + e.taxAmount, 0),
  }), [entries])

  const csv = () => downloadCsv('tax-sales.csv', ['Date', 'Invoice', 'Party', 'Tax Type', 'Rate', 'Base', 'Tax'],
    entries.map((e) => [formatDate(e.date), e.number || '', e.partyName, e.taxTypeName, e.rate, e.baseAmount, e.taxAmount]))

  const pdf = () => exportReportPdf({
    filename: 'tax-sales.pdf', title: 'Tax Sales Report',
    meta: [['From', from || 'Earliest'], ['To', to || 'Latest']],
    tables: [{ columns: ['Date', 'Invoice', 'Party', 'Tax', 'Rate %', 'Base', 'Tax Amt'],
      rows: entries.map((e) => [formatDate(e.date), e.number || '—', e.partyName, e.taxTypeName, e.rate, e.baseAmount, e.taxAmount]),
      totals: ['Totals', '', '', '', '', totals.base, totals.tax] }],
  })

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/reports')} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><ArrowLeft size={18} /></button>
          <h1 className="text-lg font-semibold text-slate-900">Tax Sales</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={csv} disabled={loading} className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"><Download size={14} /> CSV</button>
          <button onClick={pdf} disabled={loading} className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"><FileText size={14} /> PDF</button>
          <button onClick={() => window.print()} disabled={loading} className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"><Printer size={14} /> Print</button>
        </div>
      </div>
      <div className="mt-2"><DataStatus /></div>
      <div className="mt-4 flex items-center gap-3">
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-slate-500" />
        <span className="text-xs text-slate-400">to</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-slate-500" />
      </div>
      {error && <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {loading ? <ReportSkeleton sections={1} /> : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Total Entries</div>
              <div className="mt-1 font-mono text-lg font-semibold text-amber-700">{entries.length}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Total Base</div>
              <div className="mt-1 font-mono text-lg font-semibold text-amber-700">{fmt(totals.base)}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Total Tax Collected</div>
              <div className="mt-1 font-mono text-lg font-semibold text-emerald-700">{fmt(totals.tax)}</div>
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Invoice</th>
                  <th className="px-4 py-2">Party</th>
                  <th className="px-4 py-2">Tax</th>
                  <th className="px-4 py-2 text-right">Rate %</th>
                  <th className="px-4 py-2 text-right">Base</th>
                  <th className="px-4 py-2 text-right">Tax</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No tax entries found.</td></tr>}
                {entries.map((e, i) => (
                  <tr key={`${e.docId}-${i}`} className="border-b border-slate-50">
                    <td className="px-4 py-2 text-slate-600">{formatDate(e.date)}</td>
                    <td className="px-4 py-2 font-mono text-slate-700">{e.number || '—'}</td>
                    <td className="px-4 py-2 text-slate-800">{e.partyName}</td>
                    <td className="px-4 py-2 text-slate-600">{e.taxTypeName}</td>
                    <td className="px-4 py-2 text-right font-mono text-slate-700">{e.rate}%</td>
                    <td className="px-4 py-2 text-right font-mono text-slate-700">{fmt(e.baseAmount)}</td>
                    <td className="px-4 py-2 text-right font-mono font-medium text-slate-800">{fmt(e.taxAmount)}</td>
                  </tr>
                ))}
              </tbody>
              {entries.length > 0 && (
                <tfoot>
                  <tr className="border-t border-slate-200 bg-slate-50">
                    <td colSpan={5} className="px-4 py-2 text-xs font-semibold uppercase text-slate-600">Totals</td>
                    <td className="px-4 py-2 text-right font-mono font-semibold text-slate-900">{fmt(totals.base)}</td>
                    <td className="px-4 py-2 text-right font-mono font-semibold text-slate-900">{fmt(totals.tax)}</td>
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
