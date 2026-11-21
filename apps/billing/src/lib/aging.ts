/* ================================================================
 * Receivables / Payables aging calculation.
 *
 * Built from posted documents (sales/purchase invoices + allocations).
 * Runs entirely on frontend using existing documents endpoint.
 * ================================================================ */

import type { Document, Party } from '../lib/types'

export interface AgingBucket {
  current: number
  d1_30: number
  d31_60: number
  d61_90: number
  over90: number
  total: number
}

export interface PartyAging {
  party: Party
  buckets: AgingBucket
  documents: Document[]
}

/**
 * Get document total amount (gross total including tax).
 */
function getDocTotal(doc: Document): number {
  return doc.grossTotal ?? doc.netTotal ?? doc.taxTotal ?? doc.discountTotal ?? 0
}

function partyMatches(doc: Document, partyId: number | string | undefined): boolean {
  if (doc.party == null || partyId == null) return false
  const docPartyId =
    typeof doc.party === 'object' && 'id' in doc.party
      ? (doc.party as { id: unknown }).id
      : doc.party
  return String(docPartyId) === String(partyId)
}

/**
 * Calculate receivable aging for a customer based on their documents.
 * Positive balance = customer owes us money.
 */
export function calculateReceivableAging(
  party: Party,
  docs: Document[],
  asOfDate: string,
): AgingBucket {
  const asOf = new Date(asOfDate)
  const buckets: AgingBucket = {
    current: 0,
    d1_30: 0,
    d31_60: 0,
    d61_90: 0,
    over90: 0,
    total: 0,
  }

  const partyDocs = docs.filter((d) => partyMatches(d, party.id))

  for (const doc of partyDocs) {
    if (!doc.date) continue
    const docDate = new Date(doc.date)
    const daysDiff = Math.floor((asOf.getTime() - docDate.getTime()) / (1000 * 60 * 60 * 24))

    let amount = 0
    const total = getDocTotal(doc)

    // Sales invoices increase receivable (customer owes us)
    if (doc.docType === 'sales-invoice') {
      amount = total
    }
    // Receipts decrease receivable (customer paid us)
    else if (doc.docType === 'receipt-voucher') {
      amount = -total
    }
    // Credit notes decrease receivable (we credited customer)
    else if (doc.docType === 'credit-note') {
      amount = -total
    }
    // Debit notes increase receivable (additional customer charge)
    else if (doc.docType === 'debit-note') {
      amount = total
    }

    if (amount !== 0) {
      if (daysDiff <= 0) buckets.current += amount
      else if (daysDiff <= 30) buckets.d1_30 += amount
      else if (daysDiff <= 60) buckets.d31_60 += amount
      else if (daysDiff <= 90) buckets.d61_90 += amount
      else buckets.over90 += amount
    }
  }

  buckets.total = buckets.current + buckets.d1_30 + buckets.d31_60 + buckets.d61_90 + buckets.over90
  return buckets
}

/**
 * Calculate payable aging for a vendor based on their documents.
 * Positive balance = we owe the vendor money.
 */
export function calculatePayableAging(
  party: Party,
  docs: Document[],
  asOfDate: string,
): AgingBucket {
  const asOf = new Date(asOfDate)
  const buckets: AgingBucket = {
    current: 0,
    d1_30: 0,
    d31_60: 0,
    d61_90: 0,
    over90: 0,
    total: 0,
  }

  const partyDocs = docs.filter((d) => partyMatches(d, party.id))

  for (const doc of partyDocs) {
    if (!doc.date) continue
    const docDate = new Date(doc.date)
    const daysDiff = Math.floor((asOf.getTime() - docDate.getTime()) / (1000 * 60 * 60 * 24))

    let amount = 0
    const total = getDocTotal(doc)

    // Purchase invoices increase payable (we owe vendor)
    if (doc.docType === 'purchase-invoice') {
      amount = total
    }
    // Payments decrease payable (we paid vendor)
    else if (doc.docType === 'payment-voucher') {
      amount = -total
    }
    // Purchase return / debit note to vendor decreases payable
    else if (doc.docType === 'debit-note') {
      amount = -total
    }
    // Vendor credit note increases payable (or adjustments)
    else if (doc.docType === 'credit-note') {
      amount = total
    }

    if (amount !== 0) {
      if (daysDiff <= 0) buckets.current += amount
      else if (daysDiff <= 30) buckets.d1_30 += amount
      else if (daysDiff <= 60) buckets.d31_60 += amount
      else if (daysDiff <= 90) buckets.d61_90 += amount
      else buckets.over90 += amount
    }
  }

  buckets.total = buckets.current + buckets.d1_30 + buckets.d31_60 + buckets.d61_90 + buckets.over90
  return buckets
}

/** Legacy signature alias */
export const calculatePartyAging = calculateReceivableAging

/**
 * Get all receivables (customers with positive outstanding balance).
 */
export function getReceivables(
  parties: Party[],
  docs: Document[],
  asOfDate: string,
): PartyAging[] {
  return parties
    .filter((party) => party.type !== 'vendor')
    .map((party) => ({
      party,
      buckets: calculateReceivableAging(party, docs, asOfDate),
      documents: docs.filter((d) => partyMatches(d, party.id)),
    }))
    .filter((p) => p.buckets.total > 0.001) // Positive = they owe us
    .sort((a, b) => b.buckets.total - a.buckets.total)
}

/**
 * Get all payables (vendors with positive outstanding balance - we owe them).
 */
export function getPayables(
  parties: Party[],
  docs: Document[],
  asOfDate: string,
): PartyAging[] {
  return parties
    .filter((party) => party.type !== 'customer')
    .map((party) => ({
      party,
      buckets: calculatePayableAging(party, docs, asOfDate),
      documents: docs.filter((d) => partyMatches(d, party.id)),
    }))
    .filter((p) => p.buckets.total > 0.001) // Positive = we owe them
    .sort((a, b) => b.buckets.total - a.buckets.total)
}
