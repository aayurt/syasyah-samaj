/* ================================================================
 * Tax Summary — combined view of sales & purchase tax by tax type.
 *
 * Uses existing /items/valuation endpoint logic pattern.
 * ================================================================ */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Download, FileText, Printer } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api, fmt, list } from '../lib/api'
import { downloadCsv } from '../lib/csv'
import { exportReportPdf } from '../lib/pdf'
import { useCalendar } from '../lib/calendar'
import { useTenant, useTenantQuery } from '../lib/tenant'
import { ReportSkeleton } from '../components/Skeleton'
import DataStatus from '../components/DataStatus'
import { useT } from '../lib/i18n'
import type { Document, Party, TaxType } from '../lib/types'
import NepaliDateInput from '../components/NepaliDateInput'

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

function getTaxTypeId(taxType: number | string | { id?: number } | null): number {
  if (typeof taxType === 'number') return taxType
  if (typeof taxType === 'string') {
    const parsed = parseInt(taxType, 10)
    return isNaN(parsed) ? 0 : parsed
  }
  return taxType?.id ?? 0
}

interface TaxSummaryRow {
  taxType: { id: number; code: string; name: string; rate: number; nature: string }
  salesBase: number
  salesTax: number
  purchaseBase: number
  purchaseTax: number
  netBase: number
  netTax: number
}

export default function TaxSummary() {
  const navigate = useNavigate()
  const { tenantId } = useTenant()
  const tenantQuery = useTenantQuery()
  const t = useT()
  const { formatDate } = useCalendar()
  const [rows, setRows] = useState<TaxSummaryRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
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
      const [d, tx] = await Promise.all([
        list<Document>('documents', q),
        list<TaxType>('tax-types', { depth: 0, ...tenantQuery }),
      ])
      const taxTypeMap = new Map<number, TaxType>(tx.docs.map((t) => [t.id, t]))
      const summary = new Map<number, TaxSummaryRow>()
      for (const doc of d.docs) {
        if (doc.status !== 'posted') continue
        if (!doc.taxLines?.length) continue
        for (const tl of doc.taxLines) {
          const taxTypeId = getTaxTypeId(tl.taxType)
          if (!taxTypeId) continue
          const tt = taxTypeMap.get(taxTypeId)
          if (!tt) continue
          const rate = Number(tl.rate) || Number(tt.rate) || 0
          const lineSum = doc.netTotal || 0
          const taxAmt = (lineSum * rate) / 100
          const existing = summary.get(taxTypeId) || {
            taxType: { id: tt.id, code: tt.code, name: tt.name, rate: Number(tt.rate), nature: tt.nature },
            salesBase: 0, salesTax: 0, purchaseBase: 0, purchaseTax: 0, netBase: 0, netTax: 0,
          }
          if (doc.docType === 'sales-invoice' || doc.docType === 'receipt-voucher') {
            existing.salesBase += lineSum
            existing.salesTax += taxAmt
          } else if (doc.docType === 'purchase-invoice' || doc.docType === 'payment-voucher') {
            existing.purchaseBase += lineSum
            existing.purchaseTax += taxAmt
          }
          existing.netBase = existing.salesBase - existing.purchaseBase
          existing.netTax = existing.salesTax - existing.purchaseTax
          summary.set(taxTypeId, existing)
        }
      }
      setRows(Array.from(summary.values()).sort((a, b) => a.taxType.code.localeCompare(b.taxType.code)))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load tax summary')
    } finally { setLoading(false) }
  }, [from, to, tenantId])

  useEffect(() => { load() }, [load])

  const totals = useMemo(() => rows.reduce((s, r) => ({
    salesBase: s.salesBase + r.salesBase,
    salesTax: s.salesTax + r.salesTax,
    purchaseBase: s.purchaseBase + r.purchaseBase,
    purchaseTax: s.purchaseTax + r.purchaseTax,
    netBase: s.netBase + r.netBase,
    netTax: s.netTax + r.netTax,
  }), { salesBase: 0, salesTax: 0, purchaseBase: 0, purchaseTax: 0, netBase: 0, netTax: 0 }), [rows])

  const csv = () => downloadCsv(`tax-summary-${from || 'all'}-${to || 'all'}.csv`,
    ['Tax Code', 'Tax Name', 'Rate', 'Nature', 'Sales Base', 'Sales Tax', 'Purchase Base', 'Purchase Tax', 'Net Base', 'Net Tax'],
    rows.map((r) => [r.taxType.code, r.taxType.name, r.taxType.rate, r.taxType.nature, r.salesBase.toFixed(2), r.salesTax.toFixed(2), r.purchaseBase.toFixed(2), r.purchaseTax.toFixed(2), r.netBase.toFixed(2), r.netTax.toFixed(2)]),
  )

  const pdf = () => exportReportPdf({
    filename: `tax-summary-${from || 'all'}-${to || 'all'}.pdf`,
    title: t('reports.taxSummary', 'Tax Summary'),
    subtitle: t('reports.taxSummaryDesc', 'Consolidated tax by type for sales and purchases'),
    meta: [['Period', `${from || 'Earliest'} to ${to || 'Latest'}`], ['Generated', new Date().toLocaleString()]],
    tables: [{
      columns: ['Tax Code', 'Tax Name', 'Rate', 'Nature', 'Sales Base', 'Sales Tax', 'Purchase Base', 'Purchase Tax', 'Net Base', 'Net Tax'],
      rows: rows.map((r) => [r.taxType.code, r.taxType.name, `${r.taxType.rate}%`, r.taxType.nature, fmt(r.salesBase), fmt(r.salesTax), fmt(r.purchaseBase), fmt(r.purchaseTax), fmt(r.netBase), fmt(r.netTax)]),
      totals: ['TOTAL', '', '', '', fmt(totals.salesBase), fmt(totals.salesTax), fmt(totals.purchaseBase), fmt(totals.purchaseTax), fmt(totals.netBase), fmt(totals.netTax)],
    }],
  })

  return (
    <div className="w-full pb-28">
      <div className="flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/reports')} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">{t('reports.taxSummary', 'Tax Summary')}</h1>
            <p className="text-sm text-slate-500">{t('reports.taxSummaryDesc', 'Consolidated tax by type for sales and purchases')}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {rows.length > 0 && (
            <>
              <button onClick={csv} className="flex items-center gap-1.5 rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                <Download size={14} /> {t('common.export', 'Export')}
              </button>
              <button onClick={pdf} className="flex items-center gap-1.5 rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                <FileText size={14} /> {t('common.pdf', 'PDF')}
              </button>
              <button onClick={() => window.print()} className="flex items-center gap-1.5 rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                <Printer size={14} /> {t('common.print', 'Print')}
              </button>
            </>
          )}
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">{error}</div>}

      <div className="mt-4 flex flex-wrap items-end gap-4 px-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">{t('reports.from', 'From Date')}</label>
          <NepaliDateInput value={from} onChange={(v) => setFrom(v)} disabled={loading} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">{t('reports.to', 'To Date')}</label>
          <NepaliDateInput value={to} onChange={(v) => setTo(v)} disabled={loading} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">{t('reports.quick', 'Quick')}</label>
          <div className="flex gap-1">
            {QUICK_RANGES.map((r) => (
              <button key={r.label} type="button" onClick={() => { setFrom(r.from()); setTo(r.to()); }} disabled={loading} className="rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-40">
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && <ReportSkeleton sections={1} />}

      {!loading && rows.length === 0 && !error && (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white px-6 py-12 text-center">
          <p className="text-sm text-slate-500">{t('reports.noTaxData', 'No tax data for the selected period.')}</p>
        </div>
      )}

      {rows.length > 0 && (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-3">{t('reports.taxCode', 'Tax Code')}</th>
                <th className="px-3 py-3">{t('reports.taxName', 'Tax Name')}</th>
                <th className="px-3 py-3 text-right">{t('reports.rate', 'Rate')}</th>
                <th className="px-3 py-3">{t('reports.nature', 'Nature')}</th>
                <th className="px-3 py-3 text-right">{t('reports.salesBase', 'Sales Base')}</th>
                <th className="px-3 py-3 text-right">{t('reports.salesTax', 'Sales Tax')}</th>
                <th className="px-3 py-3 text-right">{t('reports.purchaseBase', 'Purchase Base')}</th>
                <th className="px-3 py-3 text-right">{t('reports.purchaseTax', 'Purchase Tax')}</th>
                <th className="px-3 py-3 text-right">{t('reports.netBase', 'Net Base')}</th>
                <th className="px-3 py-3 text-right">{t('reports.netTax', 'Net Tax')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-3 py-2">{r.taxType.code}</td>
                  <td className="px-3 py-2">{r.taxType.name}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.taxType.rate}%</td>
                  <td className="px-3 py-2 capitalize">{r.taxType.nature}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmt(r.salesBase)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmt(r.salesTax)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmt(r.purchaseBase)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmt(r.purchaseTax)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmt(r.netBase)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmt(r.netTax)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-slate-200 bg-slate-50">
              <tr>
                <td className="px-3 py-2 font-semibold" colSpan={4}>{t('common.total', 'Total')}</td>
                <td className="px-3 py-2 text-right font-mono font-semibold">{fmt(totals.salesBase)}</td>
                <td className="px-3 py-2 text-right font-mono font-semibold">{fmt(totals.salesTax)}</td>
                <td className="px-3 py-2 text-right font-mono font-semibold">{fmt(totals.purchaseBase)}</td>
                <td className="px-3 py-2 text-right font-mono font-semibold">{fmt(totals.purchaseTax)}</td>
                <td className="px-3 py-2 text-right font-mono font-semibold">{fmt(totals.netBase)}</td>
                <td className="px-3 py-2 text-right font-mono font-semibold">{fmt(totals.netTax)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <div className="mt-2"><DataStatus /></div>
    </div>
  )
}