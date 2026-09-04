import { useState } from 'react'
import { api, fmt } from '../lib/api'
import { useCalendar } from '../lib/calendar'
import { useTenant, useTenantQuery } from '../lib/tenant'
import type { Account, Document, LedgerRow } from '../lib/types'
import VoucherViewModal from './VoucherViewModal'

type Props = {
  accountId: string
  accountName: string
  onClose: () => void
}

export default function LedgerModal({ accountId, accountName, onClose }: Props) {
  const tenantQuery = useTenantQuery()
  const { formatDate } = useCalendar()
  const [ledger, setLedger] = useState<LedgerRow[] | null>(null)
  const [voucher, setVoucher] = useState<Document | null>(null)
  const [error, setError] = useState('')

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

  useState(() => {
    (async () => {
      try {
        const res = await api<{ docs: LedgerRow[]; closingBalance: number }>(
          '/journal-entries/ledger',
          { query: { account: accountId, ...tenantQuery } },
        )
        setLedger(res.docs)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load ledger')
      }
    })()
  })

  return (
    <div className="mt-6 rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="text-sm font-medium text-slate-700">
          Ledger — {accountName}
        </div>
        <button
          onClick={onClose}
          className="text-xs text-slate-400 hover:text-slate-700"
        >
          close
        </button>
      </div>
      {error ? (
        <p className="px-4 py-6 text-center text-sm text-red-600">{error}</p>
      ) : ledger === null ? (
        <p className="px-4 py-6 text-center text-sm text-slate-400">
          Loading…
        </p>
      ) : ledger.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-slate-400">
          No postings for this account.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2">Number</th>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Narration</th>
              <th className="px-4 py-2 text-right">Debit</th>
              <th className="px-4 py-2 text-right">Credit</th>
              <th className="px-4 py-2 text-right">Running</th>
            </tr>
          </thead>
          <tbody>
            {ledger.map((l) => (
              <tr key={l.id} className="border-b border-slate-50">
                <td className="px-4 py-2 font-mono text-xs text-slate-500">
                  {l.docNumber ? (
                    <button
                      type="button"
                      onClick={() => openVoucher(l.docId)}
                      className="text-blue-600 hover:underline"
                      title="Open source voucher"
                    >
                      {l.docNumber}
                    </button>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-4 py-2 text-slate-600">
                  {formatDate(l.date)}
                </td>
                <td className="px-4 py-2 text-slate-800">
                  {l.narration || '—'}
                </td>
                <td className="px-4 py-2 text-right font-mono text-slate-700">
                  {l.debit ? fmt(l.debit) : ''}
                </td>
                <td className="px-4 py-2 text-right font-mono text-slate-700">
                  {l.credit ? fmt(l.credit) : ''}
                </td>
                <td className="px-4 py-2 text-right font-mono text-slate-800">
                  {fmt(l.runningBalance)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <VoucherViewModal voucher={voucher} onClose={() => setVoucher(null)} />
    </div>
  )
}
