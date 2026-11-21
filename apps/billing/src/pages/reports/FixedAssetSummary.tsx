/* ================================================================
 * Fixed Asset Summary — register of all fixed assets with cost,
 * accumulated depreciation, net book value, and status.
 *
 * Data from GET /fixed-assets/register (Fixed Assets collection).
 * ================================================================ */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { downloadCsv } from '../../lib/csv'
import { exportReportPdf } from '../../lib/pdf'
import { useTenant, useTenantQuery } from '../../lib/tenant'
import ReportLayout from '../../components/ReportLayout'
import { ReportSkeleton } from '../../components/Skeleton'
import DataStatus from '../../components/DataStatus'
import { useT } from '../../lib/i18n'
import ReportFilterBar from '../../components/ReportFilterBar'
import { ReportBreakdownBar, ReportMetricGauge } from '../../components/ReportCharts'
import SearchBox from '../../components/SearchBox'

export default function FixedAssetSummary() {
  const navigate = useNavigate()
  const { tenantId } = useTenant()
  const tenantQuery = useTenantQuery()
  const t = useT()
  const [rows, setRows] = useState<{
    id: string
    code: string
    name: string
    category: string
    location: string
    status: string
    purchaseDate: string
    purchaseCost: number
    salvageValue: number
    usefulLifeYears: number
    accumulatedDepreciation: number
    netBookValue: number
    depreciatedPct: number
  }[]>([])
  const [totals, setTotals] = useState<{ cost: number; accumulatedDepreciation: number; netBookValue: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api<{ docs: any[]; totals: { cost: number; accumulatedDepreciation: number; netBookValue: number } }>(
        '/fixed-assets/register', { query: { ...tenantQuery } }
      )
      setRows(res.docs)
      setTotals(res.totals)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load fixed asset register')
    } finally { setLoading(false) }
  }, [tenantQuery])

  useEffect(() => { load() }, [load])

  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const r of rows) {
      if (r.category) set.add(r.category)
    }
    return Array.from(set).sort()
  }, [rows])

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (from && r.purchaseDate && r.purchaseDate < from) return false
      if (to && r.purchaseDate && r.purchaseDate > to) return false
      if (categoryFilter !== 'all' && r.category !== categoryFilter) return false
      if (query) {
        const q = query.toLowerCase()
        const code = (r.code || '').toLowerCase()
        const name = (r.name || '').toLowerCase()
        const loc = (r.location || '').toLowerCase()
        if (!code.includes(q) && !name.includes(q) && !loc.includes(q)) return false
      }
      return true
    })
  }, [rows, from, to, categoryFilter, query])

  const computedTotals = useMemo(() => {
    const cost = filteredRows.reduce((s, r) => s + (r.purchaseCost || 0), 0)
    const accumulatedDepreciation = filteredRows.reduce((s, r) => s + (r.accumulatedDepreciation || 0), 0)
    const netBookValue = filteredRows.reduce((s, r) => s + (r.netBookValue || 0), 0)
    return { cost, accumulatedDepreciation, netBookValue }
  }, [filteredRows])

  const exportCsv = () => {
    downloadCsv('fixed-asset-summary.csv',
      ['Code', 'Name', 'Category', 'Location', 'Status', 'Purchase Date', 'Cost', 'Salvage Value', 'Useful Life (Years)', 'Accumulated Depreciation', 'Net Book Value', 'Depreciated %'],
      filteredRows.map((r) => [
        r.code, r.name, r.category, r.location, r.status, r.purchaseDate,
        r.purchaseCost.toFixed(2), r.salvageValue.toFixed(2), r.usefulLifeYears,
        r.accumulatedDepreciation.toFixed(2), r.netBookValue.toFixed(2), r.depreciatedPct,
      ]),
    )
  }

  const exportPdf = () => {
    exportReportPdf({
      filename: 'fixed-asset-summary.pdf',
      title: t('reports.fixedAssetSummary', 'Fixed Asset Summary'),
      subtitle: t('reports.fixedAssetSummaryDesc', 'All fixed assets with cost, depreciation, and net book value'),
      meta: [['Generated', new Date().toLocaleString()]],
      tables: [{
        columns: ['Code', 'Name', 'Category', 'Location', 'Status', 'Cost', 'Accumulated Depn', 'Net Book Value', 'Depreciated %'],
        rows: filteredRows.map((r) => [
          r.code, r.name, r.category, r.location, r.status,
          r.purchaseCost.toFixed(2), r.accumulatedDepreciation.toFixed(2),
          r.netBookValue.toFixed(2), r.depreciatedPct + '%',
        ]),
        totals: ['TOTAL', '', '', '', '', computedTotals.cost.toFixed(2), computedTotals.accumulatedDepreciation.toFixed(2), computedTotals.netBookValue.toFixed(2), ''],
      }],
    })
  }

  return (
    <ReportLayout
      title={t('reports.fixedAssetSummary', 'Fixed Asset Summary')}
      titleKey="reports.fixedAssetSummary"
      description={t('reports.fixedAssetSummaryDesc', 'All fixed assets with cost, depreciation, and net book value')}
      descriptionKey="reports.fixedAssetSummaryDesc"
      backTo="/reports"
      loading={loading}
      error={error}
      hasData={rows.length > 0}
      onExportCsv={exportCsv}
      onExportPdf={exportPdf}
      pdfTitle={t('reports.fixedAssetSummary', 'Fixed Asset Summary')}
      pdfMeta={[['Generated', new Date().toLocaleString()]]}
    >
      <div className="mt-4 px-2">
        <ReportFilterBar
          from={from}
          to={to}
          onFromChange={setFrom}
          onToChange={setTo}
          className="mb-4"
          extraControls={
            <div className="flex flex-wrap items-center gap-2">
              <SearchBox value={query} onChange={setQuery} placeholder="Search assets…" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-700 hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:outline-hidden"
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          }
        />

        {/* Visual Valuation & Depreciation Chart */}
        {computedTotals.cost > 0 && (
          <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <ReportBreakdownBar
                title={t('reports.assetCarryingValue', 'Asset Carrying Value & Amortization')}
                totalLabel={t('reports.grossAssetCost', 'Historical Acquisition Cost')}
                segments={[
                  { label: t('reports.netBookValue', 'Net Book Value (Remaining)'), value: computedTotals.netBookValue, color: 'bg-emerald-500' },
                  { label: t('reports.accumulatedDepreciation', 'Accumulated Depreciation'), value: computedTotals.accumulatedDepreciation, color: 'bg-amber-500' },
                ]}
              />
            </div>
            <div>
              <ReportMetricGauge
                label={t('reports.depreciationRate', 'Overall Depreciation')}
                value={computedTotals.accumulatedDepreciation}
                percentage={computedTotals.cost > 0 ? (computedTotals.accumulatedDepreciation / computedTotals.cost) * 100 : 0}
                statusColor="text-amber-700"
                barColor="bg-amber-500"
                description={`${t('reports.depreciatedPctOfCost', 'Portion of total asset base amortized to date')}`}
              />
            </div>
          </div>
        )}

        {computedTotals && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-xs text-slate-500">{t('reports.totalAssetCost', 'Total Asset Cost')}</p>
              <p className="text-lg font-mono font-semibold text-slate-900">{computedTotals.cost.toFixed(2)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-xs text-slate-500">{t('reports.totalAccumulatedDepreciation', 'Total Accumulated Depreciation')}</p>
              <p className="text-lg font-mono font-semibold text-slate-700">{computedTotals.accumulatedDepreciation.toFixed(2)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-xs text-slate-500">{t('reports.totalNetBookValue', 'Total Net Book Value')}</p>
              <p className="text-lg font-mono font-semibold text-slate-900">{computedTotals.netBookValue.toFixed(2)}</p>
            </div>
          </div>
        )}

        {loading && <ReportSkeleton sections={1} />}

        {!loading && filteredRows.length === 0 && !error && (
          <div className="mt-6 rounded-lg border border-slate-200 bg-white px-6 py-12 text-center">
            <p className="text-sm text-slate-500">{t('reports.noFixedAssets', 'No fixed assets found matching filter.')}</p>
          </div>
        )}

        {filteredRows.length > 0 && (
          <div className="mt-6 rounded-lg border border-slate-200 bg-white overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-3">{t('reports.code', 'Code')}</th>
                  <th className="px-3 py-3">{t('reports.name', 'Name')}</th>
                  <th className="px-3 py-3">{t('reports.category', 'Category')}</th>
                  <th className="px-3 py-3">{t('reports.location', 'Location')}</th>
                  <th className="px-3 py-3">{t('reports.status', 'Status')}</th>
                  <th className="px-3 py-3">{t('reports.purchaseDate', 'Purchase Date')}</th>
                  <th className="px-3 py-3 text-right">{t('reports.purchaseCost', 'Cost')}</th>
                  <th className="px-3 py-3 text-right">{t('reports.accumulatedDepreciation', 'Accumulated Depn')}</th>
                  <th className="px-3 py-3 text-right">{t('reports.netBookValue', 'Net Book Value')}</th>
                  <th className="px-3 py-3 text-right">{t('reports.depreciatedPct', 'Depreciated %')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r, i) => (
                  <tr key={r.id || i} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-3 py-2 text-left text-sm font-medium text-slate-700">{r.code}</td>
                    <td className="px-3 py-2 text-left text-sm text-slate-700">{r.name}</td>
                    <td className="px-3 py-2 text-sm text-slate-600">{r.category}</td>
                    <td className="px-3 py-2 text-sm text-slate-600">{r.location}</td>
                    <td className="px-3 py-2 text-sm">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                        r.status === 'disposed' ? 'bg-red-50 text-red-700' :
                        r.status === 'active' ? 'bg-emerald-50 text-emerald-700' :
                        'bg-slate-50 text-slate-700'
                      }`}>{r.status}</span>
                    </td>
                    <td className="px-3 py-2 text-sm font-mono text-slate-600">{r.purchaseDate}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-slate-700">{r.purchaseCost.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-slate-700">{r.accumulatedDepreciation.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs font-semibold text-slate-900">{r.netBookValue.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-slate-600">{r.depreciatedPct}%</td>
                  </tr>
                ))}
              </tbody>
              {totals && (
                <tfoot className="border-t border-slate-200 bg-slate-50">
                  <tr>
                    <td className="px-3 py-2 text-right font-semibold text-slate-800" colSpan={6}>{t('common.total', 'Total')}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs font-semibold text-slate-800">{totals.cost.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs font-semibold text-slate-800">{totals.accumulatedDepreciation.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs font-semibold text-slate-800">{totals.netBookValue.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-slate-600"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      <div className="mt-2"><DataStatus /></div>
    </ReportLayout>
  )
}
