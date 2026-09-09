import { X } from 'lucide-react'
import { fmt } from '../lib/api'
import { useCalendar } from '../lib/calendar'
import { useT } from '../lib/i18n'
import { DOC_TYPE_LABELS } from '../lib/types'
import type { Document } from '../lib/types'

/**
 * Modal that shows a source voucher (document) — used by list pages
 * (Daybooks, Journal) to drill back to the originating voucher.
 */
export default function VoucherViewModal({
  voucher,
  onClose,
}: {
  voucher: Document | null
  onClose: () => void
}) {
  const t = useT()
  const { formatDate } = useCalendar()
  if (!voucher) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
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
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700"
            aria-label={t('voucherView.close')}
          >
            <X size={16} />
          </button>
        </div>
        <div className="mt-3 space-y-1 text-sm text-slate-700">
          <p>
            <span className="text-slate-400">{t('voucherView.status')}</span>{' '}
            <span className="font-medium capitalize">{voucher.status}</span>
          </p>
          {voucher.narration && (
            <p>
              <span className="text-slate-400">{t('voucherView.narration')}</span>{' '}
              {voucher.narration}
            </p>
          )}
          <p className="pt-1 text-slate-400">{t('voucherView.lines')}</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-1 pr-2">{t('voucherView.account')}</th>
                <th className="py-1 pr-2 text-right">{t('voucherView.debit')}</th>
                <th className="py-1 pr-2 text-right">{t('voucherView.credit')}</th>
              </tr>
            </thead>
            <tbody>
              {(voucher.journalLines || []).map((l, i) => (
                <tr key={i} className="border-t border-slate-50">
                  <td className="py-1 pr-2 text-slate-700">
                    {typeof l.account === 'object' && l.account
                      ? (l.account as { name?: string }).name
                      : `${t('voucherView.account')} #${l.account}`}
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
                    {l.description || t('voucherView.itemLine')}
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
            <span>{t('voucherView.net')} {fmt(voucher.netTotal ?? 0)}</span>
            <span>{t('voucherView.tax')} {fmt(voucher.taxTotal ?? 0)}</span>
            <span className="font-medium text-slate-900">
              {t('voucherView.total')} {fmt(voucher.grossTotal ?? 0)}
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}