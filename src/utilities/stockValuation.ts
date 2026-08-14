import type { Payload } from 'payload'
import { round2, toNum } from './journalValidation'

export interface StockLedgerRow {
  id?: number | null
  date: string
  docId?: number | null
  docNumber?: string | null
  qtyIn: number
  qtyOut: number
  unitCost: number
  qtyOnHand: number
  avgCost: number
  balanceValue: number
  location?: string | null
}

type ItemLike = {
  id: number | string
  openingStock?: number | string | null
  purchasePrice?: number | string | null
}

/**
 * Computes the stock ledger for an item using weighted-average (AVCO):
 * opening stock valued at the purchase price, receipts raise the running
 * average, issues consume at the current average. Movements are ordered by
 * date then insertion order.
 */
export async function computeStockLedger(
  payload: Payload,
  item: ItemLike,
): Promise<StockLedgerRow[]> {
  const res = await payload.find({
    collection: 'stock-movements',
    where: { item: { equals: item.id } },
    limit: 1000,
    depth: 0,
    sort: 'date',
  })
  const rows: StockLedgerRow[] = []
  let onHand = toNum(item.openingStock)
  let avgCost = onHand > 0 ? toNum(item.purchasePrice) : 0

  if (onHand > 0) {
    rows.push({
      id: null,
      date: '',
      docId: null,
      docNumber: null,
      qtyIn: onHand,
      qtyOut: 0,
      unitCost: avgCost,
      qtyOnHand: onHand,
      avgCost,
      balanceValue: round2(onHand * avgCost),
      location: 'Opening balance',
    })
  }

  for (const m of res.docs as any[]) {
    const qtyIn = toNum(m.qtyIn)
    const qtyOut = toNum(m.qtyOut)
    if (qtyIn > 0) {
      const cost = toNum(m.unitCost)
      if (onHand + qtyIn > 0) {
        avgCost = (avgCost * onHand + cost * qtyIn) / (onHand + qtyIn)
      }
      onHand += qtyIn
    } else {
      onHand -= qtyOut
    }
    avgCost = round2(avgCost)
    const doc =
      m.doc && typeof m.doc === 'object' ? (m.doc as any) : undefined
    rows.push({
      id: m.id,
      date: m.date,
      docId: m.doc && typeof m.doc === 'object' ? (m.doc as any).id : undefined,
      docNumber: doc?.number || undefined,
      qtyIn,
      qtyOut,
      unitCost: round2(toNum(m.unitCost)),
      qtyOnHand: round2(onHand),
      avgCost,
      balanceValue: round2(onHand * avgCost),
      location: m.location,
    })
  }

  return rows
}

/**
 * Current on-hand quantity and weighted-average cost for an item.
 */
export async function currentAvco(
  payload: Payload,
  item: ItemLike,
): Promise<{ onHand: number; avgCost: number }> {
  const rows = await computeStockLedger(payload, item)
  const last = rows[rows.length - 1]
  return {
    onHand: last?.qtyOnHand ?? 0,
    avgCost: last?.avgCost ?? 0,
  }
}
