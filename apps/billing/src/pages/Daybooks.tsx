import { useEffect, useState } from 'react'
import { Download, FileText, Printer, X } from 'lucide-react'
import { api, fmt } from '../lib/api'
import { downloadCsv } from '../lib/csv'
import { exportReportPdf } from '../lib/pdf'
import { ReportSkeleton } from '../components/Skeleton'
import DataStatus from '../components/DataStatus'
import { useCalendar } from '../lib/calendar'
import { useTenant, useTenantQuery } from '../lib/tenant'
import { useFiscalYear } from '../lib/fiscalYear'
import { DOC_TYPE_LABELS } from '../lib/types'
import type { DaybookResponse, DaybookType, Document } from '../lib/types'
import NepaliDateInput from '../components/NepaliDateInput'

const TYPES: { value: DaybookType; label: string }[] = [
  { value: 'all', label: 'All Vouchers' },
  { value: 'cash', label: 'Cash & Bank' },
  { value: 'petty-cash', label: 'Petty Cash' },
  { value: 'sales', label: 'Sales Daybook' },
  { value: 'purchase', label: 'Purchase Daybook' },
  { value: 'journal', label: 'Journal Proper' },
]

const HEADERS = ['Date', 'Voucher', 'Narration', 'Account', 'Debit', 'Credit', 'Running']

export default function Daybooks() {
  const [type, setType] = useState<DaybookType>('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [data, setData] = useState<DaybookResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [voucher, setVoucher] = useState<Document | null>(null)
  const { formatDate } = useCalendar()
  const { tenantId } = useTenant()
  const tenantQuery = useTenantQuery()
  const { selectedYear } = useFiscalYear()

  const openVoucher = async (docId: number | string | null | undefined) => {
    if (!docId) return
    try {
      const d = await api<Document>(`/documents/${docId}`, {
        query: { ...tenantQuery },
      })
      setVoucher(d)
    } catch {
      setError('Could not load the source voucher.')
    }
  }

  // Fiscal year range defaults when no manual from/to are set.
  const fyFrom = !from && selectedYear?.startDate ? String(selectedYear.startDate).slice(0, 10) : from
  const fyTo = !to && selectedYear?.endDate ? String(selectedYear.endDate).slice(0, 10) : to

  useEffect(() => {
    let alive = true
    setLoading(true)
    setData(null)
    setError('')
    api<DaybookResponse>('/journal-entries/daybook', {
      query: {
        type,
        from: fyFrom || undefined,
        to: fyTo || undefined,
        ...tenantQuery,
      },
    })
      .then((res) => {
        if (alive) setData(res)
      })
      .catch((err: unknown) => {
        if (alive)
          setError(err instanceof Error ? err.message : 'Failed to load daybook')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [type, from, to, tenantId])

  const isCash = type === 'cash' || type === 'petty-cash'

  const csv = () => {
    if (!data) return
    downloadCsv(
      `daybook-${type}.csv`,
      HEADERS,
      data.rows.map((r) => [
        r.date?.slice(0, 10),
        r.docNumber || '',
        r.narration,
        r.accountName,
        r.debit,
        r.credit,
        r.runningBalance ?? '',
      ]),
    )
  }

  const label =
    TYPES.find((t) => t.value === type)?.label ?? type

  const pdf = () => {
    if (!data) return
    exportReportPdf({
      filename: `daybook-${type}.pdf`,
      title: label,
      meta: [
        ['From', from || 'Earliest'],
        ['To', to || 'Latest'],
        ['Generated', new Date().toLocaleString()],
      ],
      tables: [
        {
          columns: HEADERS,
          rows: data.rows.map((r) => [
            r.date?.slice(0, 10),
            r.docNumber || '',
            r.narration,
            r.accountName,
            r.debit,
            r.credit,
            r.runningBalance ?? '',
          ]),
          totals: [
            'Totals',
            '',
            '',
            '',
            data.totals.debit,
            data.totals.credit,
            isCash ? data.closingBalance : '',
          ],
        },
      ],
      foot: isCash ? [{ label: 'Closing balance', value: data.closingBalance }] : undefined,
    })
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-slate-900">Daybooks</h1>
        <div className="print:hidden flex items-center gap-2">
          <button
            onClick={csv}
            disabled={!data}
            className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            <Download size={14} />
            CSV
          </button>
          <button
            onClick={pdf}
            disabled={!data}
            className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            <FileText size={14} />
            PDF
          </button>
          <button
            onClick={() => window.print()}
            disabled={!data}
            className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            <Printer size={14} />
            Print
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => setType(t.value)}
            className={`rounded px-3 py-1.5 text-sm font-medium ${
              type === t.value
                ? 'bg-crimson-600 text-white'
                : 'border border-slate-300 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {t.label}
          </button>
        ))}
        <span className="ml-auto flex items-center gap-3">
          <label className="text-sm text-slate-700">
            From
            <NepaliDateInput compact value={from} onChange={(v) => setFrom(v)} />
          </label>
          <label className="text-sm text-slate-700">
            To
            <NepaliDateInput compact value={to} onChange={(v) => setTo(v)} />
          </label>
        </span>
      </div>

      {error && (
        <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-2">
        <DataStatus />
      </div>

      {loading && !data ? (
        <ReportSkeleton sections={2} />
      ) : (
      <div className="mt-3 rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Voucher</th>
              <th className="px-4 py-2">Narration</th>
              <th className="px-4 py-2">Account</th>
              <th className="px-4 py-2 text-right">Debit</th>
              <th className="px-4 py-2 text-right">Credit</th>
              {isCash && (
                <th className="px-4 py-2 text-right">Running</th>
              )}
            </tr>
          </thead>
          <tbody>
            {data && data.rows.length === 0 && (
              <tr>
                <td
                  colSpan={isCash ? 7 : 6}
                  className="px-4 py-6 text-center text-slate-400"
                >
                  No postings in this daybook for the selected period.
                </td>
              </tr>
            )}
            {data?.rows.map((r, i) => (
              <tr
                key={`${r.id}-${i}`}
                className={`border-b border-slate-50 ${r.docId ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                onClick={() => r.docId && openVoucher(r.docId)}
              >
                <td className="px-4 py-2 text-slate-600">
                  {formatDate(r.date)}
                </td>
                <td className="px-4 py-2">
                  {r.docNumber ? (
                    <span className="inline-flex items-center gap-1.5 font-mono text-xs text-slate-700">
                      <FileText size={12} className="text-slate-400" />
                      {r.docNumber}
                      {r.docType && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-500">
                          {DOC_TYPE_LABELS[r.docType] || r.docType}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="px-4 py-2 text-slate-800">
                  {r.narration || '—'}
                </td>
                <td className="px-4 py-2 text-slate-600">{r.accountName}</td>
                <td className="px-4 py-2 text-right font-mono text-slate-700">
                  {r.debit ? fmt(r.debit) : ''}
                </td>
                <td className="px-4 py-2 text-right font-mono text-slate-700">
                  {r.credit ? fmt(r.credit) : ''}
                </td>
                {isCash && (
                  <td className="px-4 py-2 text-right font-mono text-slate-800">
                    {fmt(r.runningBalance ?? 0)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          {data && data.rows.length > 0 && (
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50">
                <td
                  colSpan={4}
                  className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600"
                >
                  Totals
                </td>
                <td className="px-4 py-2 text-right font-mono font-semibold text-slate-800">
                  {fmt(data.totals.debit)}
                </td>
                <td className="px-4 py-2 text-right font-mono font-semibold text-slate-800">
                  {fmt(data.totals.credit)}
                </td>
                {isCash && (
                  <td className="px-4 py-2 text-right font-mono font-semibold text-slate-900">
                    {fmt(data.closingBalance)}
                  </td>
                )}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      )}

      <p className="mt-3 text-xs text-slate-400">
        {type === 'all' &&
          'Every posted voucher line, in date order (Tally Day Book). Click a voucher number to open the source entry.'}
        {type === 'cash' &&
          'All postings touching cash or bank accounts, with a running balance. Click a voucher number to open the source entry.'}
        {type === 'petty-cash' &&
          'Postings to the petty cash account configured in Settings.'}
        {type === 'sales' && 'Postings to income accounts (sales revenue).'}
        {type === 'purchase' && 'Postings to expense accounts (purchases).'}
        {type === 'journal' &&
          'The Journal Proper register: free-form journal and journal-voucher entries.'}
      </p>

      {voucher && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setVoucher(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {DOC_TYPE_LABELS[voucher.docType] || voucher.docType}
                </h2>
                <p className="font-mono text-sm text-slate-500">
                  {voucher.number || `#${voucher.id}`} · {formatDate(voucher.date)}
                </p>
              </div>
              <button
                onClick={() => setVoucher(null)}
                className="text-slate-400 hover:text-slate-700"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <div className="mt-3 space-y-1 text-sm text-slate-700">
              <p>
                <span className="text-slate-400">Status:</span>{' '}
                <span className="font-medium capitalize">{voucher.status}</span>
              </p>
              {voucher.narration && (
                <p>
                  <span className="text-slate-400">Narration:</span>{' '}
                  {voucher.narration}
                </p>
              )}
              <p className="pt-1 text-slate-400">Lines</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-1 pr-2">Account</th>
                    <th className="py-1 pr-2 text-right">Debit</th>
                    <th className="py-1 pr-2 text-right">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {(voucher.journalLines || []).map((l, i) => (
                    <tr key={i} className="border-t border-slate-50">
                      <td className="py-1 pr-2 text-slate-700">
                        {typeof l.account === 'object' && l.account
                          ? (l.account as { name?: string }).name
                          : `Account #${l.account}`}
                      </td>
                      <td className="py-1 pr-2 text-right font-mono text-slate-700">
                        {l.debit ? fmt(l.debit) : ''}
                      </td>
                      <td className="py-1 pr-2 text-right font-mono text-slate-700">
                        {l.credit ? fmt(l.credit) : ''}
                      </td>
                    </tr>
                  ))}
                  {(voucher.lines || []).map((l, i) => (
                    <tr key={`l-${i}`} className="border-t border-slate-50">
                      <td className="py-1 pr-2 text-slate-700">
                        {l.description || 'Item line'}
                      </td>
                      <td className="py-1 pr-2 text-right font-mono text-slate-700">
                        {l.amount ? fmt(l.amount) : ''}
                      </td>
                      <td className="py-1 pr-2 text-right font-mono text-slate-700"></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="flex justify-between pt-1 text-slate-500">
                <span>Net {fmt(voucher.netTotal ?? 0)}</span>
                <span>Tax {fmt(voucher.taxTotal ?? 0)}</span>
                <span className="font-medium text-slate-900">
                  Total {fmt(voucher.grossTotal ?? 0)}
                </span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
