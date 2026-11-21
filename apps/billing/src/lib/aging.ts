/* ================================================================
 * Receivables / Payables aging calculation.
 *
 * Built from posted documents (sales/purchase invoices + allocations).
 * Runs entirely on frontend using existing documents endpoint.
 * ================================================================ */

import type { Document, Party } from '../lib/types'

interface AgingBucket {
  current: number
  d1_30: number
  d31_60: number
  d61_90: number
  over90: number
  total: number
}

interface PartyAging {
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

/**
 * Calculate aging for a party based on their documents.
 * Positive balance = they owe us (receivable)
 * Negative balance = we owe them (payable)
 */
export function calculatePartyAging(
  party: Party,
  docs: Document[],
  asOfDate: string, // ISO date string
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

  // We need to track each invoice's outstanding amount
  // For simplicity, we'll calculate running balance per invoice
  // and age based on invoice date

  for (const doc of docs) {
    if (!doc.date) continue
    const docDate = new Date(doc.date)
    const daysDiff = Math.floor((asOf.getTime() - docDate.getTime()) / (1000 * 60 * 60 * 24))

    let amount = 0
    const total = getDocTotal(doc)
    // Sales invoices increase receivable (customer owes us)
    if (doc.docType === 'sales-invoice') {
      amount = total
    }
    // Receipts decrease receivable
    else if (doc.docType === 'receipt-voucher') {
      amount = -total
    }
    // Credit notes decrease receivable
    else if (doc.docType === 'credit-note') {
      amount = -total
    }
    // Debit notes increase receivable
    else if (doc.docType === 'debit-note') {
      amount = total
    }
    // Purchase invoices increase payable (we owe vendor)
    else if (doc.docType === 'purchase-invoice') {
      amount = total
    }
    // Payments decrease payable
    else if (doc.docType === 'payment-voucher') {
      amount = -total
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
 * Get all receivables (parties with positive outstanding balance)
 */
export function getReceivables(
  parties: Party[],
  docs: Document[],
  asOfDate: string,
): PartyAging[] {
  return parties
    .map((party) => ({
      party,
      buckets: calculatePartyAging(party, docs.filter((d) => d.party === party.id), asOfDate),
      documents: docs.filter((d) => d.party === party.id),
    }))
    .filter((p) => p.buckets.total > 0) // Positive = they owe us
    .sort((a, b) => b.buckets.total - a.buckets.total)
}

/**
 * Get all payables (parties with negative outstanding balance - we owe them)
 */
export function getPayables(
  parties: Party[],
  docs: Document[],
  asOfDate: string,
): PartyAging[] {
  return parties
    .map((party) => ({
      party,
      buckets: calculatePartyAging(party, docs.filter((d) => d.party === party.id), asOfDate),
      documents: docs.filter((d) => d.party === party.id),
    }))
    .filter((p) => p.buckets.total < 0) // Negative = we owe them
    .sort((a, b) => a.buckets.total - b.buckets.total) // Most negative first
}