import { useEffect, useState } from 'react'
import { FileText, Printer } from 'lucide-react'
import { api } from '../lib/api'
import { exportReportPdf } from '../lib/pdf'
import { ReportSkeleton } from '../components/Skeleton'
import DataStatus from '../components/DataStatus'
import { useTenant, useTenantQuery } from '../lib/tenant'
import type { AgingResponse, AgingRow } from '../lib/types'

const BUCKETS = ['0-30', '31-60', '61-90', '90+'] as const

export default function Aging() {
  const [side, setSide] = useState<'ar' | 'ap'>('ar')
  const [data, setData] = useState<AgingResponse | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { tenantId } = useTenant()
  const tenantQuery = useTenantQuery()

  const load = async (s: 'ar' | 'ap') => {
    setLoading(true)
    setError('')
    setSelected(null)
    try {
      const res = await api<AgingResponse>('/documents/aging', {
        query: { side: s, ...tenantQuery },
      })
      setData(res)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load aging')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(side)
  }, [side, tenantId])

  const sideLabel = side === 'ar' ? 'Accounts Receivable' : 'Accounts Payable'
  const rows: AgingRow[] = data?.rows.filter(
    (r) => r.party.id === selected,
  ) ?? []

  const pdf = () => {
    if (!data) return
    exportReportPdf({
      filename: `aging-${side}.pdf`,
      title: `Aging — ${sideLabel}`,
      meta: [
        ['As of', data.asOf?.slice(0, 10) || '—'],
        ['Generated', new Date().toLocaleString()],
      ],
      tables: [
        {
          columns: ['Party', ...BUCKETS, 'Total'],
          rows: data.parties.map((p) => [
            p.party.name,
            ...BUCKETS.map((b) => p.buckets[b] ?? ''),
            p.total,
          ]),
          totals: [
            'Totals',
            ...BUCKETS.map((b) => data.totals.buckets[b] ?? ''),
            data.totals.total,
          ],
        },
      ],
    })
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">
          Aging — {sideLabel}
        </h1>
        <div className="flex items-center gap-2">
          <div className="flex gap-2">
            {(['ar', 'ap'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSide(s)}
                className={`rounded px-3 py-1.5 text-sm font-medium ${
                  side === s
                    ? 'bg-crimson-600 text-white'
                    : 'border border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {s === 'ar' ? 'Receivables' : 'Payables'}
              </button>
            ))}
          </div>
          <div className="print:hidden flex items-center gap-2">
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
      </div>

      {error && (
        <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <p className="mt-2 text-xs text-slate-400">
        Open balances as of {data ? new Date(data.asOf).toLocaleDateString() : '…'} —
        {side === 'ar'
          ? ' posted sales invoices minus credit notes and receipts'
          : ' posted purchase invoices minus debit notes and payments'}
        . Click a party for its open documents.
      </p>
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
              <th className="px-4 py-2">Party</th>
              {BUCKETS.map((b) => (
                <th key={b} className="px-4 py-2 text-right">
                  {b} days
                </th>
              ))}
              <th className="px-4 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {(!data || data.parties.length === 0) && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  No open {side === 'ar' ? 'receivables' : 'payables'}.
                </td>
              </tr>
            )}
            {data?.parties.map((p) => (
              <tr
                key={p.party.id}
                className={`border-b border-slate-50 hover:bg-slate-50 ${
                  selected === p.party.id ? 'bg-slate-50' : ''
                }`}
              >
                <td className="px-4 py-2">
                  <button
                    onClick={() =>
                      setSelected(selected === p.party.id ? null : p.party.id)
                    }
                    className="text-left font-medium text-slate-800 hover:text-blue-700 hover:underline"
                  >
                    {p.party.name}
                  </button>
                </td>
                {BUCKETS.map((b) => (
                  <td
                    key={b}
                    className={`px-4 py-2 text-right font-mono ${
                      p.buckets[b] ? 'text-slate-700' : 'text-slate-300'
                    }`}
                  >
                    {p.buckets[b] ? fmtAmount(p.buckets[b]) : '—'}
                  </td>
                ))}
                <td
                  className={`px-4 py-2 text-right font-mono font-semibold ${
                    p.total < 0 ? 'text-emerald-700' : 'text-slate-800'
                  }`}
                >
                  {fmtAmount(p.total)}
                </td>
              </tr>
            ))}
          </tbody>
          {data && data.parties.length > 0 && (
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50">
                <td className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Totals
                </td>
                {BUCKETS.map((b) => (
                  <td
                    key={b}
                    className="px-4 py-2 text-right font-mono font-semibold text-amber-700"
                  >
                    {data.totals.buckets[b]
                      ? fmtAmount(data.totals.buckets[b])
                      : '—'}
                  </td>
                ))}
                <td className="px-4 py-2 text-right font-mono font-semibold text-slate-900">
                  {fmtAmount(data.totals.total)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      )}

      {selected !== null && (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div className="text-sm font-medium text-slate-700">
              Open documents — {rows[0]?.party.name ?? ''}
            </div>
            <button
              onClick={() => setSelected(null)}
              className="text-xs text-slate-400 hover:text-slate-700"
            >
              close
            </button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2">Number</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2 text-right">Days</th>
                <th className="px-4 py-2 text-right">Amount</th>
                <th className="px-4 py-2">Bucket</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.docId} className="border-b border-slate-50">
                  <td className="px-4 py-2 font-mono text-slate-700">
                    {r.number || `#${r.docId}`}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{r.docType}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {r.date?.slice(0, 10)}
                  </td>
                  <td className="px-4 py-2 text-right text-slate-600">
                    {r.days}
                  </td>
                  <td
                    className={`px-4 py-2 text-right font-mono ${
                      r.amount < 0 ? 'text-emerald-700' : 'text-slate-800'
                    }`}
                  >
                    {fmtAmount(r.amount)}
                  </td>
                  <td className="px-4 py-2">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                      {r.bucket}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const fmtAmount = (n: number) =>
  n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
