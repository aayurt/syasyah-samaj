import { useEffect, useState } from 'react'
import { Check, FileText } from 'lucide-react'
import { api, fmt } from '../lib/api'
import { useTenantQuery } from '../lib/tenant'
import type { Document } from '../lib/types'

interface Props {
  partyId: string
  /** 'receipt-voucher' links to sales-invoice, 'payment-voucher' links to purchase-invoice */
  docType: 'receipt-voucher' | 'payment-voucher'
  selectedInvoiceId: string | null
  onSelect: (invoiceId: string | null) => void
}

interface OutstandingInvoice extends Document {
  outstanding: number
}

/**
 * Shows outstanding (unpaid) invoices for a party and lets the user
 * link a receipt/payment to a specific invoice.
 */
export default function OutstandingInvoices({
  partyId,
  docType,
  selectedInvoiceId,
  onSelect,
}: Props) {
  const [invoices, setInvoices] = useState<OutstandingInvoice[]>([])
  const [loading, setLoading] = useState(false)
  const tenantQuery = useTenantQuery()

  const invoiceType = docType === 'receipt-voucher' ? 'sales-invoice' : 'purchase-invoice'

  useEffect(() => {
    if (!partyId) { setInvoices([]); return }
    let alive = true
    setLoading(true)

    api<{ docs: Document[] }>('/documents', {
      query: {
        limit: 100,
        depth: 0,
        where: JSON.stringify({ and: [{ docType: { equals: invoiceType } }, { party: { equals: Number(partyId) } }, { status: { equals: 'posted' } }] }),
        sort: '-date',
        ...tenantQuery,
      },
    })
      .then(async (res) => {
        if (!alive) return
        // Calculate outstanding for each invoice
        const results: OutstandingInvoice[] = []
        for (const inv of res.docs) {
          const gross = inv.grossTotal || 0
          // Fetch linked receipts/payments for this invoice
          const linked = await api<{ docs: Document[] }>('/documents', {
            query: {
              limit: 100,
              depth: 0,
              where: JSON.stringify({
                and: [
                  { docType: { equals: docType } },
                  { linkedInvoice: { equals: inv.id } },
                  { status: { equals: 'posted' } },
                ],
              }),
              ...tenantQuery,
            },
          }).catch(() => ({ docs: [] }))

          const paid = linked.docs.reduce((sum, d) => sum + (d.grossTotal || 0), 0)
          const outstanding = gross - paid
          if (outstanding > 0.01) {
            results.push({ ...inv, outstanding })
          }
        }
        if (alive) {
          setInvoices(results)
          setLoading(false)
        }
      })
      .catch(() => { if (alive) setLoading(false) })

    return () => { alive = false }
  }, [partyId, invoiceType, docType, tenantQuery])

  if (!partyId) return null

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 mb-3">
        <FileText size={16} className="text-slate-500" />
        <div className="text-sm font-medium text-slate-700">
          {docType === 'receipt-voucher' ? 'Outstanding Sales Invoices' : 'Outstanding Purchase Invoices'}
        </div>
        {loading && <span className="text-xs text-slate-400">Loading…</span>}
      </div>

      {invoices.length === 0 && !loading && (
        <p className="text-sm text-slate-400">
          No outstanding {invoiceType.replace('-', ' ')}s for this party.
        </p>
      )}

      {invoices.length > 0 && (
        <div className="space-y-2">
          <label
            className={`flex items-center gap-3 rounded-md border p-3 cursor-pointer transition-colors ${
              selectedInvoiceId === null
                ? 'border-crimson-300 bg-crimson-50'
                : 'border-slate-200 hover:bg-slate-50'
            }`}
          >
            <div className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
              selectedInvoiceId === null ? 'border-crimson-600 bg-crimson-600' : 'border-slate-300'
            }`}>
              {selectedInvoiceId === null && <div className="h-2 w-2 rounded-full bg-white" />}
            </div>
            <div className="text-sm text-slate-700">No specific invoice (general payment)</div>
          </label>

          {invoices.map((inv) => (
            <label
              key={inv.id}
              className={`flex items-center justify-between rounded-md border p-3 cursor-pointer transition-colors ${
                selectedInvoiceId === String(inv.id)
                  ? 'border-crimson-300 bg-crimson-50'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                  selectedInvoiceId === String(inv.id) ? 'border-crimson-600 bg-crimson-600' : 'border-slate-300'
                }`}>
                  {selectedInvoiceId === String(inv.id) && <Check size={12} className="text-white" />}
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-700">
                    {inv.number || `#${inv.id}`}
                  </div>
                  <div className="text-xs text-slate-400">{inv.date?.slice(0, 10)}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-slate-800">Rs. {fmt(inv.outstanding)}</div>
                <div className="text-xs text-slate-400">of Rs. {fmt(inv.grossTotal || 0)}</div>
              </div>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
