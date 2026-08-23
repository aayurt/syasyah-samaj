import { useEffect, useMemo, useState } from 'react'
import { Check, FileText, Search, X } from 'lucide-react'
import { api, fmt } from '../lib/api'
import { useCalendar } from '../lib/calendar'
import { useTenantQuery } from '../lib/tenant'
import { adToBsString, bsToAdString } from '../lib/nepaliDate'
import { effectiveAmount, type Document } from '../lib/types'

interface Props {
  partyId: string
  docType: 'receipt-voucher' | 'payment-voucher'
  selectedInvoiceId: string | null
  onSelect: (invoiceId: string | null, outstanding?: number) => void
}

interface OutstandingInvoice extends Document {
  outstanding: number
  paidAmount: number
}

/** Extract numeric party id from various API shapes: number, string, { id, name } */
function getPartyId(p: unknown): string | null {
  if (p == null) return null
  if (typeof p === 'number' || typeof p === 'string') return String(p)
  if (typeof p === 'object' && 'id' in p) return String((p as { id: unknown }).id)
  return null
}

export default function OutstandingInvoices({
  partyId,
  docType,
  selectedInvoiceId,
  onSelect,
}: Props) {
  const [invoices, setInvoices] = useState<OutstandingInvoice[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [filterMode, setFilterMode] = useState<'and' | 'or'>('and')
  const [showFilters, setShowFilters] = useState(false)
  const { calendarType } = useCalendar()
  const tenantQuery = useTenantQuery()
  const invoiceType = docType === 'receipt-voucher' ? 'sales-invoice' : 'purchase-invoice'

  // Stabilize tenantQuery as a JSON string for the useEffect dependency
  const tqKey = useMemo(() => JSON.stringify(tenantQuery), [tenantQuery])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableTenantQuery = useMemo(() => JSON.parse(tqKey), [tqKey])

  useEffect(() => {
    if (!partyId) { setInvoices([]); return }
    let alive = true
    setLoading(true)

    const fetchAll = async () => {
      try {
        // Fetch documents — simple where clause, filter the rest client-side
        const res = await api<{ docs: Document[] }>('/documents', {
          query: {
            limit: 500,
            depth: 0,
            sort: '-date',
            _t: Date.now(),
            ...stableTenantQuery,
          },
        })
        if (!alive) return

        // Client-side filter: posted only + correct docType + correct party
        const docs = (res.docs || []).filter((d) => {
          if (d.status !== 'posted') return false
          if (d.docType !== invoiceType) return false
          const dPartyId = getPartyId((d as any).party)
          return dPartyId === String(partyId)
        })

        if (docs.length === 0) { setInvoices([]); setLoading(false); return }

        // Fetch receipts/payments
        const linked = await api<{ docs: Document[] }>('/documents', {
          query: {
            limit: 1000,
            depth: 0,
            _t: Date.now(),
            ...stableTenantQuery,
          },
        }).catch(() => ({ docs: [] as Document[] }))

        // Client-side filter: posted only + correct docType + correct party
        const linkedDocs = (linked.docs || []).filter((d: Document) => {
          if (d.status !== 'posted') return false
          if (d.docType !== docType) return false
          const dPartyId = getPartyId((d as any).party)
          return dPartyId === String(partyId)
        })

        // Build paid map from linked receipts (linkedInvoice field)
        // Payload may return relationship as { id } object or plain number
        const paidMap = new Map<number, number>()
        for (const d of linkedDocs) {
          const raw = (d as any).linkedInvoice
          const invId = raw && typeof raw === 'object' ? raw.id : raw
          if (invId) {
            const amt = Number(d.grossTotal) || 0
            paidMap.set(Number(invId), (paidMap.get(Number(invId)) || 0) + amt)
          }
        }

        // Unlinked receipts — pro-rate against oldest invoices first
        const unlinkedTotal = linkedDocs
          .filter((d: Document) => {
            const raw = (d as any).linkedInvoice
            const val = raw && typeof raw === 'object' ? raw.id : raw
            return !val
          })
          .reduce((sum: number, d: Document) => sum + (Number(d.grossTotal) || 0), 0)

        // Sort invoices oldest first for pro-rating
        const sorted = [...docs].sort((a, b) => (a.date || '').localeCompare(b.date || ''))
        let unlinkedRemaining = unlinkedTotal

        // Build results with outstanding amounts
        const results: OutstandingInvoice[] = []
        for (const inv of sorted) {
          const gross = effectiveAmount(inv)
          let paid = paidMap.get(inv.id) || 0

          // Apply unlinked receipts oldest-first
          if (unlinkedRemaining > 0.01) {
            const apply = Math.min(unlinkedRemaining, gross - paid)
            if (apply > 0) { paid += apply; unlinkedRemaining -= apply }
          }

          const outstanding = Math.max(0, gross - paid)
          results.push({ ...inv, outstanding, paidAmount: paid })
        }
        if (alive) { setInvoices(results); setLoading(false) }
      } catch {
        if (alive) setLoading(false)
      }
    }

    fetchAll()
    return () => { alive = false }
  }, [partyId, invoiceType, docType, tqKey, stableTenantQuery]) // eslint-disable-line react-hooks/exhaustive-deps

  // Client-side search + date filtering
  const filtered = useMemo(() => {
    let result = invoices
    const q = search.toLowerCase().trim()

    if (q) {
      result = result.filter((inv) =>
        (inv.number || '').toLowerCase().includes(q) ||
        String(inv.id).includes(q) ||
        (inv.date || '').includes(q)
      )
    }

    if (dateFrom || dateTo) {
      result = result.filter((inv) => {
        const d = (inv.date || '').slice(0, 10)
        if (!d) return false
        const afterFrom = !dateFrom || d >= (calendarType === 'BS' ? bsToAdString(dateFrom) : dateFrom)
        const beforeTo = !dateTo || d <= (calendarType === 'BS' ? bsToAdString(dateTo) : dateTo)
        return filterMode === 'and' ? (afterFrom && beforeTo) : (afterFrom || beforeTo)
      })
    }

    return result
  }, [invoices, search, dateFrom, dateTo, filterMode, calendarType])

  const hasFilters = search || dateFrom || dateTo
  const selectedInv = selectedInvoiceId ? invoices.find((i) => String(i.id) === selectedInvoiceId) : null

  if (!partyId) return null

  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-slate-500" />
          <div className="text-sm font-medium text-slate-700">
            {docType === 'receipt-voucher' ? 'Outstanding Sales Invoices' : 'Outstanding Purchase Invoices'}
          </div>
          {loading && <span className="text-xs text-slate-400">Loading…</span>}
        </div>
        {!loading && invoices.length > 0 && (
          <button
            type="button"
            onClick={() => setShowFilters((f) => !f)}
            className={`flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors ${
              showFilters || hasFilters
                ? 'bg-crimson-50 text-crimson-600'
                : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
            }`}
          >
            <Search size={12} />
            {hasFilters ? 'Filtered' : 'Filter'}
          </button>
        )}
      </div>

      {/* Search + Filters */}
      {!loading && invoices.length > 0 && (
        <div className="mb-3 space-y-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by invoice number or date…"
              className="w-full rounded border border-slate-200 bg-slate-50 py-2 pl-9 pr-8 text-sm outline-none focus:border-slate-400 focus:bg-white"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {showFilters && (
            <div className="flex flex-wrap items-end gap-3 rounded-md border border-slate-100 bg-slate-50 p-3">
              <div>
                <label className="text-[11px] font-medium text-slate-500">From</label>
                <input
                  type="date"
                  value={calendarType === 'BS' && dateFrom ? adToBsString(dateFrom) : dateFrom}
                  onChange={(e) => {
                    const v = e.target.value
                    setDateFrom(calendarType === 'BS' && v ? bsToAdString(v) : v)
                  }}
                  className="mt-0.5 block w-36 rounded border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-slate-400"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-500">To</label>
                <input
                  type="date"
                  value={calendarType === 'BS' && dateTo ? adToBsString(dateTo) : dateTo}
                  onChange={(e) => {
                    const v = e.target.value
                    setDateTo(calendarType === 'BS' && v ? bsToAdString(v) : v)
                  }}
                  className="mt-0.5 block w-36 rounded border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-slate-400"
                />
              </div>
              {(dateFrom || dateTo) && (
                <div className="flex items-center gap-1.5">
                  <label className="text-[11px] font-medium text-slate-500">Match</label>
                  <div className="flex overflow-hidden rounded border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setFilterMode('and')}
                      className={`px-2 py-1 text-[11px] font-medium transition-colors ${
                        filterMode === 'and' ? 'bg-crimson-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'
                      }`}
                    >AND</button>
                    <button
                      type="button"
                      onClick={() => setFilterMode('or')}
                      className={`px-2 py-1 text-[11px] font-medium transition-colors ${
                        filterMode === 'or' ? 'bg-crimson-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'
                      }`}
                    >OR</button>
                  </div>
                </div>
              )}
              {hasFilters && (
                <button type="button" onClick={() => { setSearch(''); setDateFrom(''); setDateTo('') }}
                  className="text-[11px] text-slate-400 hover:text-slate-600">Clear all</button>
              )}
            </div>
          )}
        </div>
      )}

      {!loading && invoices.length > 0 && filtered.length === 0 && hasFilters && (
        <p className="text-sm text-slate-400">No invoices match your filters.</p>
      )}

      {!loading && invoices.length === 0 && (
        <p className="text-sm text-slate-400">
          No {invoiceType.replace('-', ' ')}s found for this party.
        </p>
      )}

      {filtered.length > 0 && (
        <div className="space-y-2">
          {/* General payment option */}
          <button
            type="button"
            onClick={() => onSelect(null)}
            className={`w-full flex items-center gap-3 rounded-md border p-3 text-left transition-colors ${
              selectedInvoiceId === null ? 'border-crimson-300 bg-crimson-50' : 'border-slate-200 hover:bg-slate-50'
            }`}
          >
            <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
              selectedInvoiceId === null ? 'border-crimson-600 bg-crimson-600' : 'border-slate-300'
            }`}>
              {selectedInvoiceId === null && <div className="h-2 w-2 rounded-full bg-white" />}
            </div>
            <div className="text-sm text-slate-700">No specific invoice (general payment)</div>
          </button>

          {filtered.map((inv) => {
            const total = effectiveAmount(inv)
            const paid = inv.paidAmount
            const outstanding = inv.outstanding
            const isPaid = outstanding <= 0.01
            const isPartial = paid > 0.01 && outstanding > 0.01
            const pct = total > 0 ? Math.round((paid / total) * 100) : 0

            return (
              <button
                type="button"
                key={inv.id}
                disabled={isPaid}
                onClick={() => !isPaid && onSelect(String(inv.id), outstanding)}
                className={`w-full flex items-center justify-between rounded-md border p-3 text-left transition-colors ${
                  isPaid
                    ? 'border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed'
                    : selectedInvoiceId === String(inv.id)
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
                    <div className="text-sm font-medium text-slate-700">{inv.number || `#${inv.id}`}</div>
                    <div className="text-xs text-slate-400">{inv.date?.slice(0, 10)}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2 justify-end">
                    <div className="text-sm font-medium text-slate-800">
                      {isPaid ? (
                        <span className="text-emerald-600">Rs. {fmt(total)}</span>
                      ) : (
                        <>Rs. {fmt(outstanding)}</>
                      )}
                    </div>
                    {isPaid && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">Paid</span>
                    )}
                    {isPartial && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">Partial ({pct}%)</span>
                    )}
                    {!isPaid && !isPartial && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">Unpaid</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    of Rs. {fmt(total)}
                    {paid > 0.01 && (
                      <span className="ml-1 text-emerald-600">· Rs. {fmt(paid)} paid</span>
                    )}
                  </div>
                </div>
              </button>
            )
          })}

          {hasFilters && (
            <div className="text-center text-[11px] text-slate-400 pt-1">
              {filtered.length} of {invoices.length} invoices
            </div>
          )}
        </div>
      )}

      {!loading && selectedInv && (
        <div className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <span className="font-medium">Remaining after payment:</span>{' '}
          Rs. {fmt(selectedInv.outstanding)} of Rs. {fmt(Number(selectedInv.grossTotal) || 0)}
          {selectedInv.outstanding < (Number(selectedInv.grossTotal) || 0) && (
            <span className="ml-2 text-emerald-600">
              (Rs. {fmt((Number(selectedInv.grossTotal) || 0) - selectedInv.outstanding)} already paid)
            </span>
          )}
        </div>
      )}
    </div>
  )
}
