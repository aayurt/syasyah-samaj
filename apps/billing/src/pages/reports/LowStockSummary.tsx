import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Download, FileText, Printer, TriangleAlert } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api, fmt, list } from '../../lib/api'
import { downloadCsv } from '../../lib/csv'
import { exportReportPdf } from '../../lib/pdf'
import { useTenant, useTenantQuery } from '../../lib/tenant'
import { ReportSkeleton } from '../../components/Skeleton'
import DataStatus from '../../components/DataStatus'
import type { Item, StockLevel } from '../../lib/types'

export default function LowStockSummary() {
  const navigate = useNavigate()
  const { tenantId } = useTenant()
  const tenantQuery = useTenantQuery()
  const [items, setItems] = useState<(Item & { stock?: StockLevel })[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [i, s] = await Promise.all([
        list<Item>('items', { depth: 0, sort: 'name', ...tenantQuery }),
        api<{ docs: StockLevel[] }>('/items/stock-levels', { query: { ...tenantQuery } }),
      ])
      const stockMap = new Map(s.docs.map((sl) => [sl.item.id, sl]))
      const lowStock = i.docs.filter((it) => {
        const sl = stockMap.get(it.id)
        if (!sl || it.reorderLevel == null || it.reorderLevel <= 0) return false
        return (sl.onHand || 0) <= it.reorderLevel
      }).map((it) => ({ ...it, stock: stockMap.get(it.id) }))
      setItems(lowStock)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load low stock summary')
    } finally { setLoading(false) }
  }, [tenantId])

  useEffect(() => { load() }, [load])

  const csv = () => downloadCsv('low-stock.csv', ['Code', 'Name', 'Current Qty', 'Reorder Level', 'Shortage'],
    items.map((it) => [it.code || '', it.name, it.stock?.onHand || 0, it.reorderLevel || 0, (it.reorderLevel || 0) - (it.stock?.onHand || 0)]))

  const pdf = () => exportReportPdf({
    filename: 'low-stock.pdf', title: 'Low Stock Summary',
    meta: [['Items below reorder level', String(items.length)]],
    tables: [{ columns: ['Code', 'Name', 'Current Qty', 'Reorder Level', 'Shortage'],
      rows: items.map((it) => [it.code || '—', it.name, it.stock?.onHand || 0, it.reorderLevel || 0, (it.reorderLevel || 0) - (it.stock?.onHand || 0)]) }],
  })

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/reports')} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><ArrowLeft size={18} /></button>
          <h1 className="text-lg font-semibold text-slate-900">Low Stock Summary</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={csv} disabled={loading || items.length === 0} className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"><Download size={14} /> CSV</button>
          <button onClick={pdf} disabled={loading || items.length === 0} className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"><FileText size={14} /> PDF</button>
          <button onClick={() => window.print()} disabled={loading || items.length === 0} className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"><Printer size={14} /> Print</button>
        </div>
      </div>
      <div className="mt-2"><DataStatus /></div>
      {error && <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {loading ? <ReportSkeleton sections={1} /> : (
        <>
          {items.length > 0 && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              <TriangleAlert size={16} />
              {items.length} item{items.length !== 1 ? 's' : ''} below reorder level — consider restocking.
            </div>
          )}
          <div className="mt-4 rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2">Code</th>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2 text-right">Current Qty</th>
                  <th className="px-4 py-2 text-right">Reorder Level</th>
                  <th className="px-4 py-2 text-right">Shortage</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">All items are above reorder levels.</td></tr>
                )}
                {items.map((it) => {
                  const qty = it.stock?.onHand || 0
                  const shortage = (it.reorderLevel || 0) - qty
                  return (
                    <tr key={it.id} className="border-b border-slate-50">
                      <td className="px-4 py-2 font-mono text-slate-500">{it.code || '—'}</td>
                      <td className="px-4 py-2 text-slate-800">{it.name}</td>
                      <td className="px-4 py-2 text-right font-mono text-red-600">{qty}</td>
                      <td className="px-4 py-2 text-right font-mono text-slate-700">{it.reorderLevel}</td>
                      <td className="px-4 py-2 text-right font-mono font-medium text-red-700">{shortage}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {items.length === 0 && !error && (
            <p className="mt-8 text-center text-sm text-slate-400">All items are above reorder levels. Nothing to restock.</p>
          )}
        </>
      )}
    </div>
  )
}
