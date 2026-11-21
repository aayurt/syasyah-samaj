/* ================================================================
 * Taxable Sales per Customer — detailed tax breakdown by customer.
 *
 * Lists each customer with their taxable sales, tax amounts by tax type.
 * ================================================================ */

import React from 'react'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api, fmt, list } from '../lib/api'
import { downloadCsv } from '../lib/csv'
import { exportReportPdf } from '../lib/pdf'
import { useCalendar } from '../lib/calendar'
import { useTenant, useTenantQuery } from '../lib/tenant'
import ReportLayout, { DateFilter } from '../components/ReportLayout'
import { ReportSkeleton } from '../components/Skeleton'
import DataStatus from '../components/DataStatus'
import { useT } from '../lib/i18n'
import type { Document, Party, TaxType } from '../lib/types'
import SearchBox from '../components/SearchBox'

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

interface CustomerTaxRow {
  party: Party
  taxBreakdown: Map<number, { taxType: TaxType; base: number; tax: number }>
  totalBase: number
  totalTax: number
}

export default function TaxableSalesPerCustomer() {
  const navigate = useNavigate()
  const { tenantId } = useTenant()
  const tenantQuery = useTenantQuery()
  const t = useT()
  const { formatDate } = useCalendar()
  const [rows, setRows] = useState<CustomerTaxRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [query, setQuery] = useState('')

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
      const [d, tx, p] = await Promise.all([
        list<Document>('documents', q),
        list<TaxType>('tax-types', { depth: 0, ...tenantQuery }),
        list<Party>('parties', { depth: 0, sort: 'name', ...tenantQuery }),
      ])
      const taxTypeMap = new Map<number, TaxType>(tx.docs.map((t) => [t.id, t]))
      const partyMap = new Map<number, Party>(p.docs.map((p) => [p.id, p]))
      const customerTax = new Map<number, CustomerTaxRow>()

      for (const doc of d.docs) {
        if (doc.status !== 'posted') continue
        if (doc.docType !== 'sales-invoice' && doc.docType !== 'receipt-voucher') continue
        if (!doc.taxLines?.length) continue
        const partyId = typeof doc.party === 'number' ? doc.party : (doc.party?.id ?? 0)
        if (!partyId) continue
        const party = partyMap.get(partyId)
        if (!party) continue
        let row = customerTax.get(partyId)
        if (!row) {
          row = { party, taxBreakdown: new Map(), totalBase: 0, totalTax: 0 }
          customerTax.set(partyId, row)
        }
        for (const tl of doc.taxLines) {
          const taxTypeId = getTaxTypeId(tl.taxType)
          if (!taxTypeId) continue
          const tt = taxTypeMap.get(taxTypeId)
          if (!tt) continue
          const rate = Number(tl.rate) || Number(tt.rate) || 0
          const lineSum = doc.netTotal || 0
          const taxAmt = (lineSum * rate) / 100
          const existing = row.taxBreakdown.get(taxTypeId) || { taxType: tt, base: 0, tax: 0 }
          existing.base += lineSum
          existing.tax += taxAmt
          row.taxBreakdown.set(taxTypeId, existing)
          row.totalBase += lineSum
          row.totalTax += taxAmt
        }
      }
      setRows(Array.from(customerTax.values()).sort((a, b) => b.totalTax - a.totalTax))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load taxable sales per customer')
    } finally { setLoading(false) }
  }, [from, to, tenantId])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() =>
    rows.filter((r) => !query || `${r.party.name} ${r.party.email || ''} ${r.party.phone || ''}`.toLowerCase().includes(query.toLowerCase())),
    [rows, query]
  )

  const totals = useMemo(() => filtered.reduce((s, r) => ({
    totalBase: s.totalBase + r.totalBase,
    totalTax: s.totalTax + r.totalTax,
  }), { totalBase: 0, totalTax: 0 }), [filtered])

  const allTaxTypes = useMemo(() => {
    const set = new Set<number>()
    filtered.forEach((r) => r.taxBreakdown.forEach((_, id) => set.add(id)))
    return Array.from(set).map((id) => filtered[0]?.taxBreakdown.get(id)?.taxType).filter(Boolean) as TaxType[]
  }, [filtered])

  const csv = () => {
    const headers = ['Customer', 'Total Base', 'Total Tax', ...allTaxTypes.flatMap((tt) => [`${tt.code} Base`, `${tt.code} Tax`])]
    const data = filtered.map((r) => [
      r.party.name, r.totalBase.toFixed(2), r.totalTax.toFixed(2),
      ...allTaxTypes.flatMap((tt) => {
        const b = r.taxBreakdown.get(tt.id)
        return [b?.base.toFixed(2) || '0.00', b?.tax.toFixed(2) || '0.00']
      }),
    ])
    data.push(['TOTAL', totals.totalBase.toFixed(2), totals.totalTax.toFixed(2), ...allTaxTypes.flatMap(() => ['', ''])])
    downloadCsv(`taxable-sales-customer-${from || 'all'}-${to || 'all'}.csv`, headers, data)
  }

  const pdf = () => exportReportPdf({
    filename: `taxable-sales-customer-${from || 'all'}-${to || 'all'}.pdf`,
    title: t('reports.taxableSalesPerCustomer', 'Taxable Sales per Customer'),
    subtitle: t('reports.taxableSalesPerCustomerDesc', 'Taxable sales and tax amounts broken down by customer and tax type'),
    meta: [['Period', `${from || 'Earliest'} to ${to || 'Latest'}`], ['Generated', new Date().toLocaleString()]],
    tables: [{
      columns: ['Customer', 'Total Base', 'Total Tax', ...allTaxTypes.flatMap((tt) => [`${tt.code} Base`, `${tt.code} Tax`])],
      rows: filtered.map((r) => [
        r.party.name, fmt(r.totalBase), fmt(r.totalTax),
        ...allTaxTypes.flatMap((tt) => {
          const b = r.taxBreakdown.get(tt.id)
          return [b ? fmt(b.base) : '0.00', b ? fmt(b.tax) : '0.00']
        }),
      ]),
      totals: ['TOTAL', fmt(totals.totalBase), fmt(totals.totalTax), ...allTaxTypes.flatMap(() => ['', ''])],
    }],
  })

  return (
    <ReportLayout
      title={t('reports.taxableSalesPerCustomer', 'Taxable Sales per Customer')}
      titleKey="reports.taxableSalesPerCustomer"
      description={t('reports.taxableSalesPerCustomerDesc', 'Taxable sales and tax amounts broken down by customer and tax type')}
      descriptionKey="reports.taxableSalesPerCustomerDesc"
      backTo="/reports"
      loading={loading}
      error={error}
      hasData={filtered.length > 0}
      onExportCsv={csv}
      onExportPdf={pdf}
      pdfTitle={t('reports.taxableSalesPerCustomer', 'Taxable Sales per Customer')}
      pdfMeta={[['Period', `${from || 'Earliest'} to ${to || 'Latest'}`], ['Generated', new Date().toLocaleString()]]}
    >
      <div className="mt-4">
        <DateFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} quickRanges={QUICK_RANGES} />

        <div className="mt-4 px-2">
          <SearchBox value={query} onChange={setQuery} placeholder={t('common.search', 'Search customers...')} />
        </div>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 px-2">
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-xs text-slate-500">{t('reports.customers', 'Customers')}</p>
            <p className="text-lg font-mono font-semibold text-slate-900">{filtered.length}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-xs text-slate-500">{t('reports.totalTaxable', 'Total Taxable')}</p>
            <p className="text-lg font-mono font-semibold text-slate-900">{fmt(totals.totalBase)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-xs text-slate-500">{t('reports.totalTax', 'Total Tax')}</p>
            <p className="text-lg font-mono font-semibold text-slate-900">{fmt(totals.totalTax)}</p>
          </div>
        </div>

        {loading && <ReportSkeleton sections={1} />}

        {!loading && filtered.length === 0 && !error && (
          <div className="mt-6 rounded-lg border border-slate-200 bg-white px-6 py-12 text-center">
            <Search size={18} className="mx-auto mb-2 text-slate-400" />
            <p className="text-sm text-slate-500">{t('reports.noData', 'No data for the selected period.')}</p>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="mt-6 rounded-lg border border-slate-200 bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-3">{t('common.customer', 'Customer')}</th>
                  <th className="px-3 py-3 text-right">{t('reports.totalTaxable', 'Total Taxable')}</th>
                  <th className="px-3 py-3 text-right">{t('reports.totalTax', 'Total Tax')}</th>
                  {allTaxTypes.map((tt) => (
                    <React.Fragment key={tt.id}>
                      <th className="px-3 py-3 text-right">{tt.code} Base</th>
                      <th className="px-3 py-3 text-right">{tt.code} Tax</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-3 py-2">{r.party.name}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmt(r.totalBase)}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmt(r.totalTax)}</td>
                    {allTaxTypes.map((tt) => {
                      const b = r.taxBreakdown.get(tt.id)
                      return (
                        <React.Fragment key={tt.id}>
                          <td className="px-3 py-2 text-right font-mono">{b ? fmt(b.base) : '0.00'}</td>
                          <td className="px-3 py-2 text-right font-mono">{b ? fmt(b.tax) : '0.00'}</td>
                        </React.Fragment>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-slate-200 bg-slate-50">
                <tr>
                  <td className="px-3 py-2 font-semibold text-right" colSpan={2}>{t('common.total', 'Total')}</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold">{fmt(totals.totalBase)}</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold">{fmt(totals.totalTax)}</td>
                  {allTaxTypes.map(() => (
                    <React.Fragment>
                      <td className="px-3 py-2 text-right font-mono font-semibold"></td>
                      <td className="px-3 py-2 text-right font-mono font-semibold"></td>
                    </React.Fragment>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <div className="mt-2"><DataStatus /></div>
    </ReportLayout>
  )
}
