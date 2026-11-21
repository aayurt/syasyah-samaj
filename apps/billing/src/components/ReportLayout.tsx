/* ================================================================
 * Shared report layout.
 *
 * Reusable wrapper for all report pages. Provides:
 *   - Report header (title, description, back button)
 *   - Common filter row (date range + quick ranges)
 *   - Loading / error / empty states
 *   - Export actions (CSV + PDF)
 *   - Responsive container with consistent spacing
 *
 * Parents own their data loading and render their own table/statement
 * as children. The layout only handles chrome.
 * ================================================================ */

import { useCallback, type ReactNode } from 'react'
import { ArrowLeft, Download, FileText, Printer } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api, fmt } from '../lib/api'
import { downloadCsv } from '../lib/csv'
import { exportReportPdf } from '../lib/pdf'
import { useCalendar } from '../lib/calendar'
import { useTenant, useTenantQuery } from '../lib/tenant'
import { ReportSkeleton } from './Skeleton'
import DataStatus from './DataStatus'
import { useT } from '../lib/i18n'
import NepaliDateInput from './NepaliDateInput'

interface ReportLayoutProps {
  title: string
  titleKey?: string
  description?: string
  descriptionKey?: string
  backTo?: string
  loading?: boolean
  error?: string
  hasData?: boolean
  onExportCsv?: () => void
  onExportPdf?: () => void
  pdfTitle?: string
  pdfSubtitle?: string
  pdfMeta?: [string, string][]
  children: ReactNode
}

export default function ReportLayout({
  title,
  titleKey,
  description,
  descriptionKey,
  backTo,
  loading = false,
  error = '',
  hasData = true,
  onExportCsv,
  onExportPdf,
  pdfTitle,
  pdfSubtitle,
  pdfMeta,
  children,
}: ReportLayoutProps) {
  const navigate = useNavigate()
  const t = useT()
  const { formatDate } = useCalendar()

  const handleExportCsv = useCallback(() => {
    if (onExportCsv) onExportCsv()
  }, [onExportCsv])

  const handleExportPdf = useCallback(() => {
    if (onExportPdf) onExportPdf()
  }, [onExportPdf])

  const handlePrint = useCallback(() => {
    window.print()
  }, [])

  if (loading) {
    return (
      <div className="w-full pb-28">
        <div className="flex items-center justify-between py-4">
          <button onClick={() => navigate(backTo || '/reports')} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
        </div>
        <ReportSkeleton sections={6} />
      </div>
    )
  }

  return (
    <div className="w-full pb-28">
      {/* ── Header ── */}
      <div className="flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          {backTo && (
            <button onClick={() => navigate(backTo)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
              <ArrowLeft size={18} />
            </button>
          )}
          <div>
            <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
            {description && (
              <p className="text-sm text-slate-500">{description}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {onExportCsv && (
            <button
              type="button"
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <Download size={14} /> {t('common.export', 'Export')}
            </button>
          )}
          {onExportPdf && (
            <button
              type="button"
              onClick={handleExportPdf}
              className="flex items-center gap-1.5 rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <FileText size={14} /> {t('common.pdf', 'PDF')}
            </button>
          )}
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <Printer size={14} /> {t('common.print', 'Print')}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

      {!hasData && !error && !loading && (
        <div className="rounded-lg border border-slate-200 bg-white px-6 py-12 text-center">
          <p className="text-sm text-slate-500">{t('reports.noData', 'No data available for the selected period.')}</p>
        </div>
      )}

      {children}

      <div className="mt-2">
        <DataStatus />
      </div>
    </div>
  )
}

/* ================================================================
 * Shared date-range filter row.
 * ================================================================ */

interface DateFilterProps {
  from: string
  to: string
  onFromChange: (v: string) => void
  onToChange: (v: string) => void
  quickRanges?: { label: string; from: () => string; to: () => string }[]
}

export function DateFilter({ from, to, onFromChange, onToChange, quickRanges }: DateFilterProps) {
  const t = useT()
  return (
    <div className="mt-4 flex flex-wrap items-end gap-4 px-2">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-500">{t('reports.from', 'From')}</label>
        <NepaliDateInput value={from} onChange={(v) => onFromChange(v)} />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-500">{t('reports.to', 'To')}</label>
        <NepaliDateInput value={to} onChange={(v) => onToChange(v)} />
      </div>
      {quickRanges && quickRanges.length > 0 && (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">{t('reports.quick', 'Quick')}</label>
          <div className="flex gap-1">
            {quickRanges.map((r) => (
              <button
                key={r.label}
                type="button"
                onClick={() => {
                  onFromChange(r.from())
                  onToChange(r.to())
                }}
                className="rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ================================================================
 * Shared report table header + row.
 * ================================================================ */

export function ReportTableHeader(cols: { label: string; key: string; align?: 'left' | 'right' }[]) {
  return (
    <thead>
      <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
        {cols.map((c) => (
          <th
            key={c.key}
            className={`px-3 py-3 ${c.align === 'right' ? 'text-right' : 'text-left'} w-auto`}
          >
            {c.label}
          </th>
        ))}
      </tr>
    </thead>
  )
}

export function ReportTableRow(
  cols: { key: string; align?: 'left' | 'right' }[],
  values: Record<string, string | number>,
  rowClass?: string,
) {
  return (
    <tr className={`border-b border-slate-50 ${rowClass || ''}`}>
      {cols.map((c) => {
        const v = values[c.key]
        return (
          <td
            key={c.key}
            className={`px-3 py-2 text-sm ${c.align === 'right' ? 'text-right font-mono text-xs' : 'text-left'}`}
          >
            {typeof v === 'number' ? v.toFixed(2) : v}
          </td>
        )
      })}
    </tr>
  )
}

export { fmt }