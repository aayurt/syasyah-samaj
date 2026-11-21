/* ================================================================
 * Depreciation Schedule — monthly depreciation postings per asset.
 *
 * Data from GET /fixed-assets/register (asset list) +
 * GET /fixed-assets/:id (full asset with depreciationRows schedule).
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
import { ReportMetricGauge } from '../../components/ReportCharts'

interface ScheduleRow {
  assetId: string
  assetCode: string
  assetName: string
  date: string
  amount: number
  journalEntry: string | number | null
}

export default function DepreciationSchedule() {
  const navigate = useNavigate()
  const { tenantId } = useTenant()
  const tenantQuery = useTenantQuery()
  const t = useT()
  const [schedule, setSchedule] = useState<ScheduleRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api<{ docs: any[] }>(
        '/fixed-assets/register', { query: { ...tenantQuery } }
      )
      const assetIds = res.docs.map((a) => a.id)
      const scheduleRows: ScheduleRow[] = []

      // Fetch each asset to get its depreciationRows schedule
      for (const id of assetIds) {
        const detail = await api<any>(`/fixed-assets/${id}`, { query: { ...tenantQuery } })
        const rows = detail.depreciationRows || []
        for (const row of rows) {
          scheduleRows.push({
            assetId: id,
            assetCode: detail.code,
            assetName: detail.name,
            date: row.date,
            amount: row.amount,
            journalEntry: row.journalEntry,
          })
        }
      }

      scheduleRows.sort((a, b) => a.date.localeCompare(b.date))
      setSchedule(scheduleRows)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load depreciation schedule')
    } finally { setLoading(false) }
  }, [tenantQuery])

  useEffect(() => { load() }, [load])

  const filteredSchedule = useMemo(() => {
    return schedule.filter((r) => {
      if (from && r.date && r.date < from) return false
      if (to && r.date && r.date > to) return false
      return true
    })
  }, [schedule, from, to])

  const total = filteredSchedule.reduce((s, r) => s + r.amount, 0)

  const exportCsv = () => {
    downloadCsv('depreciation-schedule.csv',
      ['Asset Code', 'Asset Name', 'Date', 'Amount', 'Journal Entry'],
      filteredSchedule.map((r) => [r.assetCode, r.assetName, r.date, r.amount.toFixed(2), r.journalEntry ?? '']),
    )
  }

  const exportPdf = () => {
    exportReportPdf({
      filename: 'depreciation-schedule.pdf',
      title: t('reports.depreciationSchedule', 'Depreciation Schedule'),
      subtitle: t('reports.depreciationScheduleDesc', 'Monthly depreciation postings per fixed asset'),
      meta: [['Generated', new Date().toLocaleString()]],
      tables: [{
        columns: ['Asset Code', 'Asset Name', 'Date', 'Amount', 'Journal Entry'],
        rows: filteredSchedule.map((r) => [r.assetCode, r.assetName, r.date, r.amount.toFixed(2), r.journalEntry ?? '']),
        totals: ['TOTAL', '', '', total.toFixed(2), ''],
      }],
    })
  }

  return (
    <ReportLayout
      title={t('reports.depreciationSchedule', 'Depreciation Schedule')}
      titleKey="reports.depreciationSchedule"
      description={t('reports.depreciationScheduleDesc', 'Monthly depreciation postings per fixed asset')}
      descriptionKey="reports.depreciationScheduleDesc"
      backTo="/reports"
      loading={loading}
      error={error}
      hasData={schedule.length > 0}
      onExportCsv={exportCsv}
      onExportPdf={exportPdf}
      pdfTitle={t('reports.depreciationSchedule', 'Depreciation Schedule')}
      pdfMeta={[['Generated', new Date().toLocaleString()]]}
    >
      <div className="mt-4 px-2">
        <ReportFilterBar
          from={from}
          to={to}
          onFromChange={setFrom}
          onToChange={setTo}
          className="mb-4"
        />

        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-xs text-slate-500">{t('reports.totalDepreciation', 'Total Depreciation Posted')}</p>
          <p className="text-lg font-mono font-semibold text-slate-900">{total.toFixed(2)}</p>
        </div>

        {loading && <ReportSkeleton sections={1} />}

        {!loading && filteredSchedule.length === 0 && !error && (
          <div className="mt-6 rounded-lg border border-slate-200 bg-white px-6 py-12 text-center">
            <p className="text-sm text-slate-500">{t('reports.noDepreciationSchedule', 'No depreciation schedule entries found.')}</p>
          </div>
        )}

        {filteredSchedule.length > 0 && (
          <div className="mt-6 rounded-lg border border-slate-200 bg-white overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-3">{t('reports.code', 'Code')}</th>
                  <th className="px-3 py-3">{t('reports.name', 'Name')}</th>
                  <th className="px-3 py-3">{t('reports.date', 'Date')}</th>
                  <th className="px-3 py-3 text-right">{t('reports.amount', 'Amount')}</th>
                  <th className="px-3 py-3">{t('reports.journalEntry', 'Journal Entry')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredSchedule.map((r, i) => (
                  <tr key={r.assetId + '|' + r.date + '|' + i} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-3 py-2 text-left text-sm text-slate-700">{r.assetCode}</td>
                    <td className="px-3 py-2 text-left text-sm text-slate-700">{r.assetName}</td>
                    <td className="px-3 py-2 text-sm font-mono text-slate-600">{r.date}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-slate-700">{r.amount.toFixed(2)}</td>
                    <td className="px-3 py-2 text-sm font-mono text-slate-500">{r.journalEntry ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-2"><DataStatus /></div>
    </ReportLayout>
  )
}
