/* ================================================================
 * Fixed Asset Summary — register of all fixed assets with cost,
 * accumulated depreciation, net book value, and status.
 *
 * Data from GET /fixed-assets/register (Fixed Assets collection).
 * ================================================================ */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { downloadCsv } from '../lib/csv'
import { exportReportPdf } from '../lib/pdf'
import { useTenant, useTenantQuery } from '../lib/tenant'
import { ReportLayout } from '../components/ReportLayout'
import { ReportSkeleton } from '../components/Skeleton'
import DataStatus from '../components/DataStatus'
import { useT } from '../lib/i18n'

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

  const exportCsv = () => {
    downloadCsv('fixed-asset-summary.csv',
      ['Code', 'Name', 'Category', 'Location', 'Status', 'Purchase Date', 'Cost', 'Salvage Value', 'Useful Life (Years)', 'Accumulated Depreciation', 'Net Book Value', 'Depreciated %'],
      rows.map((r) => [
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
        rows: rows.map((r) => [
          r.code, r.name, r.category, r.location, r.status,
          r.purchaseCost.toFixed(2), r.accumulatedDepreciation.toFixed(2),
          r.netBookValue.toFixed(2), r.depreciatedPct + '%',
        ]),
        totals: totals ? ['TOTAL', '', '', '', '', totals.cost.toFixed(2), totals.accumulatedDepreciation.toFixed(2), totals.netBookValue.toFixed(2), ''] : [],
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
        {totals && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-xs text-slate-500">{t('reports.totalAssetCost', 'Total Asset Cost')}</p>
              <p className="text-lg font-mono font-semibold text-slate-900">{totals.cost.toFixed(2)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-xs text-slate-500">{t('reports.totalAccumulatedDepreciation', 'Total Accumulated Depreciation')}</p>
              <p className="text-lg font-mono font-semibold text-slate-700">{totals.accumulatedDepreciation.toFixed(2)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-xs text-slate-500">{t('reports.totalNetBookValue', 'Total Net Book Value')}</p>
              <p className="text-lg font-mono font-semibold text-slate-900">{totals.netBookValue.toFixed(2)}</p>
            </div>
          </div>
        )}

        {loading && <ReportSkeleton sections={1} />}

        {!loading && rows.length === 0 && !error && (
          <div className="mt-6 rounded-lg border border-slate-200 bg-white px-6 py-12 text-center">
            <p className="text-sm text-slate-500">{t('reports.noFixedAssets', 'No fixed assets found.')}</p>
          </div>
        )}

        {rows.length > 0 && (
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
                {rows.map((r, i) => (
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
