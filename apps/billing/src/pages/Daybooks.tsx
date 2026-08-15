import { useEffect, useState } from 'react'
import { Download, FileText, Printer } from 'lucide-react'
import { api, fmt } from '../lib/api'
import { downloadCsv } from '../lib/csv'
import { exportReportPdf } from '../lib/pdf'
import type { DaybookResponse, DaybookType } from '../lib/types'

const TYPES: { value: DaybookType; label: string }[] = [
  { value: 'cash', label: 'Cash & Bank' },
  { value: 'petty-cash', label: 'Petty Cash' },
  { value: 'sales', label: 'Sales Daybook' },
  { value: 'purchase', label: 'Purchase Daybook' },
  { value: 'journal', label: 'Journal Proper' },
]

export default function Daybooks() {
  const [type, setType] = useState<DaybookType>('cash')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [data, setData] = useState<DaybookResponse | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setData(null)
    setError('')
    api<DaybookResponse>('/journal-entries/daybook', {
      query: {
        type,
        from: from || undefined,
        to: to || undefined,
      },
    })
      .then(setData)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Failed to load daybook'),
      )
  }, [type, from, to])

  const isCash = type === 'cash' || type === 'petty-cash'

  const csv = () => {
    if (!data) return
    const headers = isCash
      ? ['Date', 'Narration', 'Account', 'Debit', 'Credit', 'Running']
      : ['Date', 'Narration', 'Account', 'Debit', 'Credit']
    downloadCsv(
      `daybook-${type}.csv`,
      headers,
      data.rows.map((r) => [
        r.date?.slice(0, 10),
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
    const columns = isCash
      ? ['Date', 'Narration', 'Account', 'Debit', 'Credit', 'Running']
      : ['Date', 'Narration', 'Account', 'Debit', 'Credit']
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
          columns,
          rows: data.rows.map((r) => [
            r.date?.slice(0, 10),
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
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="ml-2 rounded border border-slate-300 px-2 py-1 text-sm outline-none focus:border-slate-500"
            />
          </label>
          <label className="text-sm text-slate-700">
            To
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="ml-2 rounded border border-slate-300 px-2 py-1 text-sm outline-none focus:border-slate-500"
            />
          </label>
        </span>
      </div>

      {error && (
        <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-3 rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2">Date</th>
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
            {!data && (
              <tr>
                <td
                  colSpan={isCash ? 6 : 5}
                  className="px-4 py-6 text-center text-slate-400"
                >
                  Loading…
                </td>
              </tr>
            )}
            {data && data.rows.length === 0 && (
              <tr>
                <td
                  colSpan={isCash ? 6 : 5}
                  className="px-4 py-6 text-center text-slate-400"
                >
                  No postings in this daybook for the selected period.
                </td>
              </tr>
            )}
            {data?.rows.map((r, i) => (
              <tr key={`${r.id}-${i}`} className="border-b border-slate-50">
                <td className="px-4 py-2 text-slate-600">
                  {r.date?.slice(0, 10)}
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
                  colSpan={isCash ? 3 : 3}
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

      <p className="mt-3 text-xs text-slate-400">
        {type === 'cash' &&
          'All postings touching cash or bank accounts, with a running balance.'}
        {type === 'petty-cash' &&
          'Postings to the petty cash account configured in Settings.'}
        {type === 'sales' && 'Postings to income accounts (sales revenue).'}
        {type === 'purchase' && 'Postings to expense accounts (purchases).'}
        {type === 'journal' &&
          'Manual entries not produced by a voucher (depreciation, accruals, corrections).'}
      </p>
    </div>
  )
}
