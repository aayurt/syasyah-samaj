import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Download, FileText, Printer } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api, fmt } from '../../lib/api'
import { downloadCsv } from '../../lib/csv'
import { exportReportPdf } from '../../lib/pdf'
import { useTenant, useTenantQuery } from '../../lib/tenant'
import { ReportSkeleton } from '../../components/Skeleton'
import DataStatus from '../../components/DataStatus'
import { useT } from '../../lib/i18n'
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

interface ValuationRow {
  item: { id: number; code: string; name: string; unit: string }
  valuationMethod: string
  openingQty: number
  openingValue: number
  receiptsQty: number
  receiptsValue: number
  issuesQty: number
  issuesValue: number
  closingQty: number
  closingValue: number
  avgCost: number
  belowReorder: boolean
}

export default function InventoryValuation() {
  const t = useT()
  const navigate = useNavigate()
  const { tenantId } = useTenant()
  const tenantQuery = useTenantQuery()
  const [rows, setRows] = useState<ValuationRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api<{ docs: ValuationRow[] }>('/items/valuation', { query: { ...tenantQuery, from, to } })
      setRows(res.docs)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load inventory valuation')
    } finally { setLoading(false) }
  }, [from, to, tenantId])

  useEffect(() => { load() }, [load])

  const totals = rows.reduce((s, r) => ({
    openingValue: s.openingValue + r.openingValue,
    receiptsValue: s.receiptsValue + r.receiptsValue,
    issuesValue: s.issuesValue + r.issuesValue,
    closingValue: s.closingValue + r.closingValue,
    closingQty: s.closingQty + r.closingQty,
    openingQty: s.openingQty + r.openingQty,
  }), { openingValue: 0, receiptsValue: 0, issuesValue: 0, closingValue: 0, closingQty: 0, openingQty: 0 })

  const csv = () => downloadCsv('inventory-valuation.csv',
    ['Code', 'Name', 'Unit', 'Opening Qty', 'Opening Value', 'Receipts Qty', 'Receipts Value', 'Issues Qty', 'Issues Value', 'Closing Qty', 'Closing Value', 'Avg Cost', 'Status'],
    rows.map((r) => [r.item.code, r.item.name, r.item.unit, r.openingQty, r.openingValue, r.receiptsQty, r.receiptsValue, r.issuesQty, r.issuesValue, r.closingQty, r.closingValue, r.avgCost, r.belowReorder ? 'Low' : 'OK']))
  const pdf = () => exportReportPdf({
    filename: 'inventory-valuation.pdf', title: 'Inventory Valuation Report',
    meta: [['Items', String(rows.length)], ['Closing Value', fmt(totals.closingValue)]],
    tables: [{ columns: ['Code', 'Name', 'Opening', 'Receipts', 'Issues', 'Closing', 'Avg Cost', 'Value', 'Status'],
      rows: rows.map((r) => [r.item.code || '—', r.item.name, r.openingQty, r.receiptsQty, r.issuesQty, r.closingQty, fmt(r.avgCost), fmt(r.closingValue), r.belowReorder ? 'Low' : 'OK']),
      totals: ['Total', '', totals.openingQty, '', '', totals.closingQty, '', fmt(totals.closingValue), ''] }],
  })

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/reports')} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><ArrowLeft size={18} /></button>
          <h1 className="text-lg font-semibold text-slate-900">{t('reports.inventoryValuation', 'Inventory Valuation')}</h1>
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
      {loading && rows.length === 0 ? <ReportSkeleton sections={1} /> : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-5">
            {[
              { label: 'Items', value: String(rows.length) },
              { label: 'Opening Value', value: fmt(totals.openingValue) },
              { label: 'Receipts', value: fmt(totals.receiptsValue) },
              { label: 'Issues', value: fmt(totals.issuesValue) },
              { label: 'Closing Value', value: fmt(totals.closingValue) },
            ].map((k) => (
              <div key={k.label} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">{k.label}</div>
                <div className="mt-1 font-mono text-lg font-semibold text-amber-700">{k.value}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2">Code</th><th className="px-4 py-2">Name</th><th className="px-4 py-2">Unit</th>
                  <th className="px-4 py-2 text-right">Opening Qty</th><th className="px-4 py-2 text-right">Opening Value</th>
                  <th className="px-4 py-2 text-right">Receipts Qty</th><th className="px-4 py-2 text-right">Issues Qty</th>
                  <th className="px-4 py-2 text-right">Closing Qty</th><th className="px-4 py-2 text-right">Closing Value</th>
                  <th className="px-4 py-2 text-right">Avg Cost</th><th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={11} className="px-4 py-8 text-center text-slate-400">No stock items found.</td></tr>}
                {rows.map((r) => (
                  <tr key={r.item.id} className="border-b border-slate-50">
                    <td className="px-4 py-2 font-mono text-slate-500">{r.item.code || '—'}</td>
                    <td className="px-4 py-2 text-slate-800">{r.item.name}</td>
                    <td className="px-4 py-2 text-slate-500">{r.item.unit}</td>
                    <td className="px-4 py-2 text-right font-mono text-slate-600">{r.openingQty || ''}</td>
                    <td className="px-4 py-2 text-right font-mono text-slate-500">{fmt(r.openingValue)}</td>
                    <td className="px-4 py-2 text-right font-mono text-emerald-700">{r.receiptsQty || ''}</td>
                    <td className="px-4 py-2 text-right font-mono text-red-600">{r.issuesQty || ''}</td>
                    <td className="px-4 py-2 text-right font-mono font-medium text-slate-800">{r.closingQty}</td>
                    <td className="px-4 py-2 text-right font-mono font-medium text-slate-800">{fmt(r.closingValue)}</td>
                    <td className="px-4 py-2 text-right font-mono text-slate-500">{fmt(r.avgCost)}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${r.belowReorder ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>{r.belowReorder ? 'Below Reorder' : 'OK'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              {rows.length > 0 && (
                <tfoot><tr className="border-t border-slate-200 bg-slate-50">
                  <td colSpan={3} className="px-4 py-2 text-xs font-semibold uppercase text-slate-600">Totals</td>
                  <td className="px-4 py-2 text-right font-mono font-semibold text-slate-900">{totals.openingQty}</td>
                  <td className="px-4 py-2 text-right font-mono font-semibold text-slate-900">{fmt(totals.openingValue)}</td>
                  <td colSpan={2}></td>
                  <td className="px-4 py-2 text-right font-mono font-semibold text-slate-900">{totals.closingQty}</td>
                  <td className="px-4 py-2 text-right font-mono font-semibold text-amber-700">{fmt(totals.closingValue)}</td>
                  <td colSpan={2}></td>
                </tr></tfoot>
              )}
            </table>
          </div>
        </>
      )}
    </div>
  )
}