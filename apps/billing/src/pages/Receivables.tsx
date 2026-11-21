/* ================================================================
 * Receivables — aging report for customer outstanding balances.
 *
 * Built from posted documents (sales invoices + receipts + credit/debit notes).
 * ================================================================ */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api, list } from '../lib/api'
import { downloadCsv } from '../lib/csv'
import { exportReportPdf } from '../lib/pdf'
import { useCalendar } from '../lib/calendar'
import { useTenant, useTenantQuery } from '../lib/tenant'
import { ReportLayout } from '../components/ReportLayout'
import { ReportSkeleton } from '../components/Skeleton'
import DataStatus from '../components/DataStatus'
import { useT } from '../lib/i18n'
import type { Party, Document } from '../lib/types'
import SearchBox from '../components/SearchBox'
import { getReceivables } from '../lib/aging'

const QUICK_RANGES = [
  { label: 'Today', from: () => '', to: () => todayISO() },
  { label: 'End of FY', from: () => '', to: () => fyEnd() },
  { label: 'All Time', from: () => '', to: () => '' },
]
function todayISO(): string { return new Date().toISOString().slice(0, 10) }
function fyEnd(): string { const n = new Date(); return (n.getMonth() >= 6 ? n.getFullYear() + 1 : n.getFullYear()) + '-07-15' }

interface AgingRow {
  party: Party
  buckets: { current: number; d1_30: number; d31_60: number; d61_90: number; over90: number; total: number }
}

export default function Receivables() {
  const navigate = useNavigate()
  const { tenantId } = useTenant()
  const tenantQuery = useTenantQuery()
  const t = useT()
  const { formatDate } = useCalendar()
  const [parties, setParties] = useState<Party[]>([])
  const [docs, setDocs] = useState<Document[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [asOf, setAsOf] = useState(todayISO())
  const [query, setQuery] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const [pRes, dRes] = await Promise.all([
          list<Party>('parties', { depth: 0, sort: 'name', limit: 1000, ...tenantQuery }),
          list<Document>('documents', { depth: 0, sort: 'date', limit: 5000, ...tenantQuery }),
        ])
        setParties(pRes.docs)
        setDocs(dRes.docs.filter((d) => d.status === 'posted'))
      } catch {
        // Non-fatal
      }
    })()
  }, [tenantId])

  const receivables = useMemo(() => getReceivables(parties, docs, asOf), [parties, docs, asOf])

  const totals = useMemo(() => ({
    current: receivables.reduce((s, r) => s + r.buckets.current, 0),
    d1_30: receivables.reduce((s, r) => s + r.buckets.d1_30, 0),
    d31_60: receivables.reduce((s, r) => s + r.buckets.d31_60, 0),
    d61_90: receivables.reduce((s, r) => s + r.buckets.d61_90, 0),
    over90: receivables.reduce((s, r) => s + r.buckets.over90, 0),
    total: receivables.reduce((s, r) => s + r.buckets.total, 0),
  }), [receivables])

  const filtered = useMemo(() =>
    receivables.filter((r) => {
      if (!query) return true
      return `${r.party.name || ''} ${r.party.email || ''} ${r.party.phone || ''}`.toLowerCase().includes(query.toLowerCase())
    }), [receivables, query])

  const exportCsv = () => {
    const headers = ['Party', 'Current', '1-30 Days', '31-60 Days', '61-90 Days', 'Over 90 Days', 'Total']
    const rows = filtered.map((r) => [
      r.party.name,
      r.buckets.current.toFixed(2),
      r.buckets.d1_30.toFixed(2),
      r.buckets.d31_60.toFixed(2),
      r.buckets.d61_90.toFixed(2),
      r.buckets.over90.toFixed(2),
      r.buckets.total.toFixed(2),
    ])
    rows.push(['TOTAL', totals.current.toFixed(2), totals.d1_30.toFixed(2), totals.d31_60.toFixed(2), totals.d61_90.toFixed(2), totals.over90.toFixed(2), totals.total.toFixed(2)])
    downloadCsv(`receivables-${asOf}.csv`, headers, rows)
  }

  const exportPdf = () => {
    exportReportPdf({
      filename: `receivables-${asOf}.pdf`,
      title: t('reports.receivables', 'Receivables'),
      subtitle: t('reports.receivablesDesc', 'Customer outstanding balances by aging period'),
      meta: [
        ['As of Date', asOf],
        ['Generated', new Date().toLocaleString()],
        ['Total Receivables', totals.total.toFixed(2)],
      ],
      tables: [
        {
          title: 'Receivables Aging',
          columns: ['Party', 'Current', '1-30 Days', '31-60 Days', '61-90 Days', 'Over 90 Days', 'Total'],
          rows: filtered.map((r) => [
            r.party.name,
            r.buckets.current.toFixed(2),
            r.buckets.d1_30.toFixed(2),
            r.buckets.d31_60.toFixed(2),
            r.buckets.d61_90.toFixed(2),
            r.buckets.over90.toFixed(2),
            r.buckets.total.toFixed(2),
          ]),
          totals: ['TOTAL', totals.current.toFixed(2), totals.d1_30.toFixed(2), totals.d31_60.toFixed(2), totals.d61_90.toFixed(2), totals.over90.toFixed(2), totals.total.toFixed(2)],
        },
      ],
    })
  }

  return (
    <ReportLayout
      title={t('reports.receivables', 'Receivables')}
      titleKey="reports.receivables"
      description={t('reports.receivablesDesc', 'Customer outstanding balances by aging period')}
      descriptionKey="reports.receivablesDesc"
      backTo="/reports"
      loading={loading}
      error={error}
      hasData={filtered.length > 0}
      onExportCsv={exportCsv}
      onExportPdf={exportPdf}
      pdfTitle={t('reports.receivables', 'Receivables')}
      pdfMeta={[
        ['As of Date', asOf],
        ['Generated', new Date().toLocaleString()],
        ['Total Receivables', totals.total.toFixed(2)],
      ]}
    >
      <div className="mt-4">
        {/* ── Filters ── */}
        <div className="flex flex-wrap items-end gap-4 px-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">{t('reports.asOf', 'As of Date')}</label>
            <input
              type="date"
              value={asOf}
              onChange={(e) => setAsOf(e.target.value)}
              disabled={loading}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">{t('reports.quick', 'Quick')}</label>
            <div className="flex gap-1">
              {QUICK_RANGES.map((r) => (
                <button key={r.label} type="button" onClick={() => { if (r.to()) setAsOf(r.to()); }} disabled={loading} className="rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-40">
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="mt-4 px-2">
          <SearchBox
            value={query}
            onChange={setQuery}
            placeholder={t('common.search', 'Search parties...')}
          />
        </div>

        {/* Summary cards */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 px-2">
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-xs text-slate-500">{t('reports.current', 'Current')}</p>
            <p className="text-lg font-mono font-semibold text-emerald-700">{totals.current.toFixed(2)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-xs text-slate-500">{t('reports.d1_30', '1-30 Days')}</p>
            <p className="text-lg font-mono font-semibold text-blue-700">{totals.d1_30.toFixed(2)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-xs text-slate-500">{t('reports.d31_60', '31-60 Days')}</p>
            <p className="text-lg font-mono font-semibold text-amber-700">{totals.d31_60.toFixed(2)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-xs text-slate-500">{t('reports.d61_90', '61-90 Days')}</p>
            <p className="text-lg font-mono font-semibold text-orange-700">{totals.d61_90.toFixed(2)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-xs text-slate-500">{t('reports.over90', 'Over 90 Days')}</p>
            <p className="text-lg font-mono font-semibold text-red-700">{totals.over90.toFixed(2)}</p>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <p className="text-xs text-slate-700">{t('reports.totalReceivables', 'Total Receivables')}</p>
            <p className="text-lg font-mono font-semibold text-slate-900">{totals.total.toFixed(2)}</p>
          </div>
        </div>

        {loading && <ReportSkeleton sections={1} />}

        {!loading && filtered.length === 0 && !error && (
          <div className="mt-6 rounded-lg border border-slate-200 bg-white px-6 py-12 text-center">
            <Search size={18} className="mx-auto mb-2 text-slate-400" />
            <p className="text-sm text-slate-500">{t('reports.noReceivables', 'No outstanding receivables for the selected date.')}</p>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="mt-6 rounded-lg border border-slate-200 bg-white overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-3 text-left">{t('common.party', 'Party')}</th>
                  <th className="px-3 py-3 text-right w-24 font-mono">{t('reports.current', 'Current')}</th>
                  <th className="px-3 py-3 text-right w-24 font-mono">{t('reports.d1_30', '1-30')}</th>
                  <th className="px-3 py-3 text-right w-24 font-mono">{t('reports.d31_60', '31-60')}</th>
                  <th className="px-3 py-3 text-right w-24 font-mono">{t('reports.d61_90', '61-90')}</th>
                  <th className="px-3 py-3 text-right w-24 font-mono">{t('reports.over90', 'Over 90')}</th>
                  <th className="px-3 py-3 text-right w-24 font-mono">{t('common.total', 'Total')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, idx) => (
                  <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-3 py-2 text-left text-sm text-slate-700">{r.party.name}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-emerald-700">{r.buckets.current.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-blue-700">{r.buckets.d1_30.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-amber-700">{r.buckets.d31_60.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-orange-700">{r.buckets.d61_90.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-red-700">{r.buckets.over90.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs font-semibold text-slate-900">{r.buckets.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-slate-200 bg-slate-50">
                <tr>
                  <td className="px-3 py-2 text-right text-sm font-semibold text-slate-800">{t('common.total', 'Total')}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs font-semibold text-emerald-700">{totals.current.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs font-semibold text-blue-700">{totals.d1_30.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs font-semibold text-amber-700">{totals.d31_60.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs font-semibold text-orange-700">{totals.d61_90.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs font-semibold text-red-700">{totals.over90.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs font-semibold text-slate-900">{totals.total.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <div className="mt-2">
        <DataStatus />
      </div>
    </ReportLayout>
  )
}
