/* ================================================================
 * Donation Summary — donation receipts with party, amount, date, and status.
 *
 * Data from GET /documents filtered by docType = 'donation-receipt'.
 * ================================================================ */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { downloadCsv } from '../../lib/csv'
import { exportReportPdf } from '../../lib/pdf'
import { useTenant, useTenantQuery } from '../../lib/tenant'
import ReportLayout from '../../components/ReportLayout'
import { ReportSkeleton } from '../../components/Skeleton'
import DataStatus from '../../components/DataStatus'
import { useT } from '../../lib/i18n'
import SearchBox from '../../components/SearchBox'

interface DonationRow {
  id: string
  number: string
  date: string
  party: { id: string; name: string } | null
  amount: number
  status: string
  narration: string
}

export default function DonationSummary() {
  const navigate = useNavigate()
  const { tenantId } = useTenant()
  const tenantQuery = useTenantQuery()
  const t = useT()
  const [rows, setRows] = useState<DonationRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api<any[]>('/documents', {
        query: {
          ...tenantQuery,
          where: JSON.stringify({ docType: { equals: 'donation-receipt' } }),
          sort: '-date',
          limit: 1000,
          depth: 1,
        },
      })
      const donationRows: DonationRow[] = (res as any[]).map((d) => ({
        id: d.id,
        number: d.number || '',
        date: d.date || '',
        party: d.party ? { id: String(d.party.id), name: d.party.name || '' } : null,
        amount: Number(d.gross_total || d.net_total || 0),
        status: d.status || 'draft',
        narration: d.narration || '',
      }))
      setRows(donationRows)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load donations')
    } finally { setLoading(false) }
  }, [tenantQuery])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() =>
    rows.filter((r) => !query || `${r.number} ${r.party?.name} ${r.narration}`.toLowerCase().includes(query.toLowerCase())),
    [rows, query]
  )

  const totals = useMemo(() => ({
    total: filtered.reduce((s, r) => s + r.amount, 0),
    posted: filtered.filter((r) => r.status === 'posted').reduce((s, r) => s + r.amount, 0),
    draft: filtered.filter((r) => r.status === 'draft').reduce((s, r) => s + r.amount, 0),
  }), [filtered])

  const exportCsv = () => {
    downloadCsv('donation-summary.csv',
      ['Receipt Number', 'Date', 'Party', 'Amount', 'Status', 'Narration'],
      filtered.map((r) => [r.number, r.date, r.party?.name || '—', r.amount.toFixed(2), r.status, r.narration]),
    )
  }

  const exportPdf = () => {
    exportReportPdf({
      filename: 'donation-summary.pdf',
      title: t('reports.donationSummary', 'Donation Summary'),
      subtitle: t('reports.donationSummaryDesc', 'Donation receipts with party, amount, and status'),
      meta: [['Generated', new Date().toLocaleString()]],
      tables: [{
        columns: ['Receipt Number', 'Date', 'Party', 'Amount', 'Status'],
        rows: filtered.map((r) => [r.number, r.date, r.party?.name || '—', r.amount.toFixed(2), r.status]),
        totals: ['TOTAL', '', '', totals.total.toFixed(2), ''],
      }],
    })
  }

  return (
    <ReportLayout
      title={t('reports.donationSummary', 'Donation Summary')}
      titleKey="reports.donationSummary"
      description={t('reports.donationSummaryDesc', 'Donation receipts with party, amount, and status')}
      descriptionKey="reports.donationSummaryDesc"
      backTo="/reports"
      loading={loading}
      error={error}
      hasData={rows.length > 0}
      onExportCsv={exportCsv}
      onExportPdf={exportPdf}
      pdfTitle={t('reports.donationSummary', 'Donation Summary')}
      pdfMeta={[['Generated', new Date().toLocaleString()]]}
    >
      <div className="mt-4 px-2">
        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-xs text-slate-500">{t('reports.totalDonations', 'Total Donations')}</p>
            <p className="text-lg font-mono font-semibold text-slate-900">{totals.total.toFixed(2)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-xs text-slate-500">{t('reports.posted', 'Posted')}</p>
            <p className="text-lg font-mono font-semibold text-emerald-700">{totals.posted.toFixed(2)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-xs text-slate-500">{t('reports.draft', 'Draft')}</p>
            <p className="text-lg font-mono font-semibold text-amber-700">{totals.draft.toFixed(2)}</p>
          </div>
        </div>

        <div className="mt-4 px-2">
          <SearchBox value={query} onChange={setQuery} placeholder={t('common.search', 'Search donations...')} />
        </div>

        {loading && <ReportSkeleton sections={1} />}

        {!loading && filtered.length === 0 && !error && (
          <div className="mt-6 rounded-lg border border-slate-200 bg-white px-6 py-12 text-center">
            <Search size={18} className="mx-auto mb-2 text-slate-400" />
            <p className="text-sm text-slate-500">{t('reports.noDonations', 'No donations found.')}</p>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="mt-6 rounded-lg border border-slate-200 bg-white overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-3">{t('reports.receiptNumber', 'Receipt Number')}</th>
                  <th className="px-3 py-3">{t('reports.date', 'Date')}</th>
                  <th className="px-3 py-3">{t('common.party', 'Party')}</th>
                  <th className="px-3 py-3 text-right">{t('reports.amount', 'Amount')}</th>
                  <th className="px-3 py-3">{t('common.status', 'Status')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.id || i} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-3 py-2 text-left text-sm font-medium text-slate-700">{r.number}</td>
                    <td className="px-3 py-2 text-sm font-mono text-slate-600">{r.date}</td>
                    <td className="px-3 py-2 text-left text-sm text-slate-700">{r.party?.name || '—'}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-slate-700">{r.amount.toFixed(2)}</td>
                    <td className="px-3 py-2 text-sm">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                        r.status === 'posted' ? 'bg-emerald-50 text-emerald-700' :
                        'bg-slate-50 text-slate-700'
                      }`}>{r.status}</span>
                    </td>
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
