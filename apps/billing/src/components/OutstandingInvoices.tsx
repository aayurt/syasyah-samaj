import { useEffect, useState } from 'react'
import { Check, FileText } from 'lucide-react'
import { api, fmt } from '../lib/api'
import { useTenantQuery } from '../lib/tenant'
import type { Document } from '../lib/types'

interface Props {
  partyId: string
  docType: 'receipt-voucher' | 'payment-voucher'
  selectedInvoiceId: string | null
  onSelect: (invoiceId: string | null) => void
}

interface OutstandingInvoice extends Document {
  outstanding: number
}

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

    const whereInv = JSON.stringify({
      and: [
        { docType: { equals: invoiceType } },
        { party: { equals: Number(partyId) } },
        { status: { equals: 'posted' } },
      ],
    })

    api<{ docs: Document[] }>('/documents', {
      query: { limit: 100, depth: 0, where: whereInv, sort: '-date', ...tenantQuery },
    })
      .then(async (res) => {
        if (!alive) return
        const docs = res.docs || []
        if (docs.length === 0) { setInvoices([]); setLoading(false); return }

        const whereLinked = JSON.stringify({
          and: [
            { docType: { equals: docType } },
            { status: { equals: 'posted' } },
          ],
        })
        const linked = await api<{ docs: Document[] }>('/documents', {
          query: { limit: 1000, depth: 0, where: whereLinked, ...tenantQuery },
        }).catch(() => ({ docs: [] as Document[] }))

        const paidMap = new Map<number, number>()
        for (const d of linked.docs) {
          const invId = (d as any).linkedInvoice
          if (invId) {
            paidMap.set(Number(invId), (paidMap.get(Number(invId)) || 0) + (d.grossTotal || 0))
          }
        }

        const results: OutstandingInvoice[] = []
        for (const inv of docs) {
          const gross = inv.grossTotal || 0
          const paid = paidMap.get(inv.id) || 0
          const outstanding = gross - paid
          if (outstanding > 0.01) {
            results.push({ ...inv, outstanding })
          }
        }
        if (alive) { setInvoices(results); setLoading(false) }
      })
      .catch(() => { if (alive) setLoading(false) })

    return () => { alive = false }
  }, [partyId, invoiceType, docType]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!partyId) return null

  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 mb-3">
        <FileText size={16} className="text-slate-500" />
        <div className="text-sm font-medium text-slate-700">
          {docType === 'receipt-voucher' ? 'Outstanding Sales Invoices' : 'Outstanding Purchase Invoices'}
        </div>
        {loading && <span className="text-xs text-slate-400">Loading…</span>}
      </div>

      {!loading && invoices.length === 0 && (
        <p className="text-sm text-slate-400">
          No outstanding {invoiceType.replace('-', ' ')}s for this party.
        </p>
      )}

      {invoices.length > 0 && (
        <div className="space-y-2">
          {/* General payment option */}
          <button
            type="button"
            onClick={() => onSelect(null)}
            className={`w-full flex items-center gap-3 rounded-md border p-3 text-left transition-colors ${
              selectedInvoiceId === null
                ? 'border-crimson-300 bg-crimson-50'
                : 'border-slate-200 hover:bg-slate-50'
            }`}
          >
            <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
              selectedInvoiceId === null ? 'border-crimson-600 bg-crimson-600' : 'border-slate-300'
            }`}>
              {selectedInvoiceId === null && <div className="h-2 w-2 rounded-full bg-white" />}
            </div>
            <div className="text-sm text-slate-700">No specific invoice (general payment)</div>
          </button>

          {/* Individual invoices */}
          {invoices.map((inv) => (
            <button
              type="button"
              key={inv.id}
              onClick={() => onSelect(String(inv.id))}
              className={`w-full flex items-center justify-between rounded-md border p-3 text-left transition-colors ${
                selectedInvoiceId === String(inv.id)
                  ? 'border-crimson-300 bg-crimson-50'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
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
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
