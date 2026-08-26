import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Download, FileText, Printer } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api, fmt, list } from '../../lib/api'
import { downloadCsv } from '../../lib/csv'
import { exportReportPdf } from '../../lib/pdf'
import { useCalendar } from '../../lib/calendar'
import { useTenant, useTenantQuery } from '../../lib/tenant'
import { ReportSkeleton } from '../../components/Skeleton'
import DataStatus from '../../components/DataStatus'
import type { Item, StockLevel } from '../../lib/types'
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

interface StockRow {
  id: number
  code: string
  name: string
  unit: string
  opening: number
  purchased: number
  sold: number
  closing: number
  reorderLevel: number | null
  status: 'ok' | 'low' | 'below'
  purchasePrice: number
  salePrice: number
}

export default function StockQuantity() {
  const navigate = useNavigate()
  const { tenantId } = useTenant()
  const tenantQuery = useTenantQuery()
  const { formatDate } = useCalendar()
  const [rows, setRows] = useState<StockRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const load = useCallback(async () => {
    try {
      const [items, stockLevels, movements] = await Promise.all([
        list<Item>('items', { depth: 0, sort: 'name', ...tenantQuery }),
        api<{ docs: StockLevel[] }>('/items/stock-levels', { query: { ...tenantQuery } }),
        list<{ item: number | { id: number }; qtyIn: number; qtyOut: number; date: string; docType: string }>('stock-movements', { depth: 0, sort: 'date', ...tenantQuery }),
      ])
      const stockMap = new Map(stockLevels.docs.map((s) => [s.item.id, s]))
      // Filter movements by date range
      let filteredMovements = movements.docs
      if (from) filteredMovements = filteredMovements.filter((m) => (m.date || '') >= from)
      if (to) filteredMovements = filteredMovements.filter((m) => (m.date || '') <= to + 'T23:59:59')

      // Aggregate movements per item
      const mvByItem = new Map<number, { purchased: number; sold: number }>()
      for (const m of filteredMovements) {
        const itemId = typeof m.item === 'object' ? m.item.id : m.item
        const entry = mvByItem.get(itemId) || { purchased: 0, sold: 0 }
        entry.purchased += Number(m.qtyIn) || 0
        entry.sold += Number(m.qtyOut) || 0
        mvByItem.set(itemId, entry)
      }

      const result: StockRow[] = items.docs.map((it) => {
        const mv = mvByItem.get(it.id) || { purchased: 0, sold: 0 }
        const opening = Number(it.openingStock) || 0
        const closing = Number(stockMap.get(it.id)?.onHand) || (opening + mv.purchased - mv.sold)
        const reorderLevel = it.reorderLevel != null ? Number(it.reorderLevel) : null
        let status: 'ok' | 'low' | 'below' = 'ok'
        if (reorderLevel && reorderLevel > 0) {
          if (closing <= 0) status = 'below'
          else if (closing <= reorderLevel) status = 'low'
        }
        return {
          id: it.id, code: it.code || '', name: it.name, unit: it.unit || '',
          opening, purchased: mv.purchased, sold: mv.sold, closing,
          reorderLevel, status,
          purchasePrice: Number(it.purchasePrice) || 0, salePrice: Number(it.salePrice) || 0,
        }
      }).filter((r) => r.opening > 0 || r.purchased > 0 || r.sold > 0 || r.closing !== 0)

      setRows(result)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load stock quantities')
    } finally { setLoading(false) }
  }, [from, to, tenantId])

  useEffect(() => { load() }, [load])

  const totalOpening = rows.reduce((s, r) => s + r.opening, 0)
  const totalPurchased = rows.reduce((s, r) => s + r.purchased, 0)
  const totalSold = rows.reduce((s, r) => s + r.sold, 0)
  const totalClosing = rows.reduce((s, r) => s + r.closing, 0)
  const totalValue = rows.reduce((s, r) => s + r.closing * r.purchasePrice, 0)

  const csv = () => downloadCsv('stock-quantity.csv', ['Code', 'Name', 'Unit', 'Opening', 'Purchased', 'Sold', 'Closing', 'Reorder', 'Status', 'Purchase Price', 'Sale Price'],
    rows.map((r) => [r.code, r.name, r.unit, r.opening, r.purchased, r.sold, r.closing, r.reorderLevel || '', r.status, r.purchasePrice, r.salePrice]))
  const pdf = () => exportReportPdf({
    filename: 'stock-quantity.pdf', title: 'Stock Quantity Report',
    meta: [['Items', String(rows.length)], ['Stock Value', fmt(totalValue)]],
    tables: [{ columns: ['Code', 'Name', 'Opening', 'In', 'Out', 'Closing', 'Reorder', 'Status'],
      rows: rows.map((r) => [r.code || '—', r.name, r.opening, r.purchased, r.sold, r.closing, r.reorderLevel || '—', r.status]),
      totals: ['Total', '', totalOpening, totalPurchased, totalSold, totalClosing, '', ''] }],
  })

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/reports')} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><ArrowLeft size={18} /></button>
          <h1 className="text-lg font-semibold text-slate-900">Stock Quantity Report</h1>
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
              { label: 'Opening', value: fmt(totalOpening) },
              { label: 'Purchased', value: fmt(totalPurchased) },
              { label: 'Sold', value: fmt(totalSold) },
              { label: 'Closing Value', value: fmt(totalValue) },
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
                  <th className="px-4 py-2 text-right">Opening</th><th className="px-4 py-2 text-right">Purchased</th>
                  <th className="px-4 py-2 text-right">Sold</th><th className="px-4 py-2 text-right">Closing</th>
                  <th className="px-4 py-2 text-right">Reorder</th><th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400">No stock items found.</td></tr>}
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-50">
                    <td className="px-4 py-2 font-mono text-slate-500">{r.code || '—'}</td>
                    <td className="px-4 py-2 text-slate-800">{r.name}</td>
                    <td className="px-4 py-2 text-slate-500">{r.unit}</td>
                    <td className="px-4 py-2 text-right font-mono text-slate-600">{r.opening}</td>
                    <td className="px-4 py-2 text-right font-mono text-emerald-700">{r.purchased || ''}</td>
                    <td className="px-4 py-2 text-right font-mono text-red-600">{r.sold || ''}</td>
                    <td className="px-4 py-2 text-right font-mono font-medium text-slate-800">{r.closing}</td>
                    <td className="px-4 py-2 text-right font-mono text-slate-500">{r.reorderLevel ?? '—'}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                        r.status === 'ok' ? 'bg-emerald-100 text-emerald-700' :
                        r.status === 'low' ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>{r.status === 'ok' ? 'OK' : r.status === 'low' ? 'Low' : 'Below'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              {rows.length > 0 && (
                <tfoot><tr className="border-t border-slate-200 bg-slate-50">
                  <td colSpan={3} className="px-4 py-2 text-xs font-semibold uppercase text-slate-600">Totals</td>
                  <td className="px-4 py-2 text-right font-mono font-semibold text-slate-900">{totalOpening}</td>
                  <td className="px-4 py-2 text-right font-mono font-semibold text-emerald-700">{totalPurchased}</td>
                  <td className="px-4 py-2 text-right font-mono font-semibold text-red-600">{totalSold}</td>
                  <td className="px-4 py-2 text-right font-mono font-semibold text-slate-900">{totalClosing}</td>
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
