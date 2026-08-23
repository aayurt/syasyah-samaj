import {
  isBillingUser,
  resolveScopedTenant,
  scopedCreate,
  scopedDelete,
  scopedRead,
  scopedUpdate,
} from '@/access/tenantScoped'
import type { CollectionConfig, PayloadRequest } from 'payload'
import { ValidationError } from 'payload'
import { round2, toNum, validateJournalLines } from '@/utilities/journalValidation'
import { currentAvco } from '@/utilities/stockValuation'
import { assignTenant } from '@/utilities/tenantScope'
import { paginate, parsePagination } from '@/utilities/pagination'

const DOC_TYPES = [
  { label: 'Sales Order', value: 'sales-order' },
  { label: 'Sales Invoice', value: 'sales-invoice' },
  { label: 'Purchase Order', value: 'purchase-order' },
  { label: 'Purchase Invoice', value: 'purchase-invoice' },
  { label: 'Payment Voucher', value: 'payment-voucher' },
  { label: 'Receipt Voucher', value: 'receipt-voucher' },
  { label: 'Credit Note', value: 'credit-note' },
  { label: 'Debit Note', value: 'debit-note' },
  { label: 'Petty Cash Voucher', value: 'petty-cash-voucher' },
  { label: 'Goods Received Note', value: 'grn' },
  { label: 'Delivery Challan', value: 'delivery-challan' },
  { label: 'Journal Voucher', value: 'journal-voucher' },
  { label: 'Contra Voucher', value: 'contra' },
  { label: 'Membership Receipt', value: 'membership-receipt' },
  { label: 'Donation Receipt', value: 'donation-receipt' },
]

const DOC_PREFIXES: Record<string, string> = {
  'sales-order': 'SO',
  'sales-invoice': 'SI',
  'purchase-order': 'PO',
  'purchase-invoice': 'PI',
  'payment-voucher': 'PV',
  'receipt-voucher': 'RV',
  'credit-note': 'CN',
  'debit-note': 'DN',
  'petty-cash-voucher': 'PC',
  grn: 'GRN',
  'delivery-challan': 'DC',
  'journal-voucher': 'JV',
  contra: 'CT',
  'membership-receipt': 'MR',
  'donation-receipt': 'DON',
}

const ITEM_LINE_TYPES = DOC_TYPES.map((t) => t.value).filter(
  (v) => v !== 'journal-voucher',
)

function isOrderType(t: string | null | undefined): boolean {
  return t === 'sales-order' || t === 'purchase-order'
}

function vErr(message: string): ValidationError {
  return new ValidationError({
    collection: 'documents',
    errors: [{ message, path: 'lines' }],
  })
}

type DocLine = {
  description?: string | null
  qty?: number | string | null
  rate?: number | string | null
  amount?: number | string | null
}

function recomputeTotals(d: any) {
  const lines: DocLine[] = d.lines || []
  if (lines.length === 0) {
    // When called from the local API (req.payload.create()), Payload 3.x
    // stores array data in a separate table and does not flatten it into
    // the data object before hooks. Skip if totals are pre-supplied.
    if (d.netTotal != null && d.grossTotal != null) return
    throw vErr('A document needs at least one line.')
  }
  let net = 0
  for (const line of lines) {
    const qty = toNum(line.qty)
    const rate = toNum(line.rate)
    const explicit =
      line.amount !== undefined && line.amount !== null && line.amount !== ''
    const amt = explicit ? toNum(line.amount) : qty * rate
    if (amt <= 0) {
      throw vErr('Every document line needs a positive amount.')
    }
    line.amount = round2(amt)
    net += amt
  }
  const lineSum = round2(net)

  const taxLines: any[] = d.taxLines || []
  if (taxLines.length === 0) {
    // Legacy single-rate path (additive VAT).
    const taxRate = Math.max(0, toNum(d.taxRate))
    const netTotal = lineSum
    const taxTotal = round2((netTotal * taxRate) / 100)
    d.netTotal = netTotal
    d.taxRate = taxRate
    d.taxTotal = taxTotal
    d.grossTotal = round2(netTotal + taxTotal)
    return
  }

  // Multiple tax system (VAT/GST/TDS). Semantics:
  //  - additive:    amount = base × rate, added on top of the net total.
  //  - inclusive:   the line value already contains the tax; strip it out.
  //  - withholding: amount = base × rate, deducted (TDS) from the payment.
  let inclusiveAmount = 0
  for (const tl of taxLines) {
    const rate = Math.max(0, toNum(tl.rate))
    if (tl.nature === 'inclusive') {
      const amount = lineSum - lineSum / (1 + rate / 100)
      tl.baseAmount = round2(lineSum / (1 + rate / 100))
      tl.amount = round2(amount)
      inclusiveAmount += amount
    }
  }
  const base = round2(lineSum - inclusiveAmount)
  let addInc = inclusiveAmount
  let withheld = 0
  for (const tl of taxLines) {
    const rate = Math.max(0, toNum(tl.rate))
    if (tl.nature === 'inclusive') continue
    tl.baseAmount = base
    tl.amount = round2((base * rate) / 100)
    if (tl.nature === 'withholding') withheld += tl.amount
    else addInc += tl.amount
  }
  const netTotal = base
  const taxTotal = round2(addInc - withheld)
  d.taxLines = taxLines
  d.netTotal = netTotal
  d.taxTotal = taxTotal
  d.grossTotal = round2(netTotal + addInc - withheld)
}

/**
 * Sums a document's tax lines into the aggregate used by the posting engine:
 *  - addInc:  additive + inclusive taxes that are added to (or embedded in)
 *             the gross, credited/debited to the tax ledger on the tax side.
 *  - withheld: withholding taxes (TDS) that are deducted from the payment.
 */
function taxAggregates(doc: any): { addInc: number; withheld: number } {
  let addInc = 0
  let withheld = 0
  for (const tl of doc.taxLines || []) {
    const amount = toNum(tl.amount)
    if (tl.nature === 'withholding') withheld += amount
    else addInc += amount
  }
  return { addInc: round2(addInc), withheld: round2(withheld) }
}

async function getSettings(payload: PayloadRequest['payload']) {
  try {
    return (await payload.findGlobal({
      slug: 'billing-settings',
      depth: 0,
    })) as any
  } catch {
    return {}
  }
}

function resolveAccount(
  settings: any,
  key: string,
  docType: string,
  label: string,
): number {
  const id = settings?.[key]
  if (!id) {
    throw new Error(
      `Posting a "${docType}" requires a "${label}" account. Set it in Billing Settings → Default accounts.`,
    )
  }
  return Number(id)
}

function accId(v: unknown): number {
  if (v && typeof v === 'object') return Number((v as { id: unknown }).id)
  return Number(v)
}

function pickCashOrBank(doc: any, settings: any, docType: string): number {
  if (doc.paymentMethod === 'cash') {
    return resolveAccount(settings, 'cashAccount', docType, 'Cash')
  }
  if (doc.bankAccount) {
    return Number(doc.bankAccount)
  }
  return resolveAccount(settings, 'bankAccount', docType, 'Bank')
}

type PostingLine = {
  account: number
  debit?: number
  credit?: number
  memo?: string
}

type StockPlan = {
  movements: {
    itemId: number
    qty: number
    unitCost: number
    isIn: boolean
  }[]
  totalCogs: number
}

/**
 * Computes the stock side-effects for inventory docTypes. For GRN, lines with
 * an item receive stock at the line's purchase rate. For sales invoices and
 * delivery challans, item lines issue stock at the current weighted-average
 * cost, accumulating the COGS amount for the journal posting. Lines without an
 * item (services) have no stock effect.
 */
async function computeStockPlan(
  payload: PayloadRequest['payload'],
  doc: any,
): Promise<StockPlan> {
  const type = doc.docType
  if (!['grn', 'delivery-challan', 'sales-invoice'].includes(type)) {
    return { movements: [], totalCogs: 0 }
  }
  const movements: StockPlan['movements'] = []
  let totalCogs = 0
  for (const line of doc.lines || []) {
    const itemId = line.item ? accId(line.item) : null
    if (!itemId) continue
    const qty = toNum(line.qty)
    if (qty <= 0) {
      throw new Error('Inventory lines need a positive quantity.')
    }
    const item = (await payload.findByID({
      collection: 'items',
      id: itemId,
      depth: 0,
    })) as any
    if (!item) {
      throw new Error('Linked inventory item not found.')
    }
    if (type === 'grn') {
      const rate = toNum(line.rate) || (qty > 0 ? toNum(line.amount) / qty : 0)
      if (rate <= 0) {
        throw new Error('GRN lines need a purchase rate (or amount).')
      }
      movements.push({ itemId, qty, unitCost: round2(rate), isIn: true })
    } else {
      const { onHand, avgCost } = await currentAvco(payload, item)
      if (qty > onHand + 0.0001) {
        throw new Error(
          `Insufficient stock for "${item.name}": ${qty} requested, ${round2(onHand)} on hand.`,
        )
      }
      movements.push({ itemId, qty, unitCost: round2(avgCost), isIn: false })
      totalCogs += qty * avgCost
    }
  }
  return { movements, totalCogs: round2(totalCogs) }
}

/**
 * Builds the journal lines for a document according to its docType's
 * posting rule (from the bookkeeping taxonomy). Always balanced. For
 * inventory docTypes the COGS / Inventory legs use the weighted-average cost
 * from the stock plan (not the line's selling price).
 */
function buildPostingLines(
  doc: any,
  settings: any,
  stockPlan: StockPlan = { movements: [], totalCogs: 0 },
  taxById: Map<number, any> = new Map(),
): PostingLine[] {
  const type = doc.docType
  const net = toNum(doc.netTotal)
  const tax = toNum(doc.taxTotal)
  const gross = toNum(doc.grossTotal)
  const taxLines: any[] = doc.taxLines || []
  const { addInc, withheld } = taxAggregates(doc)
  const lines: PostingLine[] = []

  // Resolve the ledger account for a tax line on the sales or purchase side.
  const taxAccountFor = (tl: any, side: 'sales' | 'purchase'): number => {
    const typeId = tl.taxType ? accId(tl.taxType) : null
    const taxType = typeId ? taxById.get(Number(typeId)) : null
    if (!taxType) {
      throw new Error(
        `Tax "${tl.nature}" on this voucher references an unknown tax type.`,
      )
    }
    const account = side === 'sales' ? taxType.salesAccount : taxType.purchaseAccount
    if (!account) {
      throw new Error(
        `Tax type "${taxType.name || taxType.code}" has no ${
          side === 'sales' ? 'sales' : 'purchase'
        } account configured. Configure it in Tax Types before posting.`,
      )
    }
    return Number(accId(account))
  }

  switch (type) {
    case 'sales-invoice':
      // AR (gross) ← Revenue (net) + Output Tax; with item lines also
      // COGS (AVCO) → Inventory (AVCO), keeping the entry balanced.
      lines.push({
        account: resolveAccount(settings, 'receivableAccount', type, 'Accounts Receivable'),
        debit: gross,
      })
      lines.push({
        account: resolveAccount(settings, 'revenueAccount', type, 'Sales Revenue'),
        credit: net,
      })
      if (taxLines.length > 0) {
        for (const tl of taxLines) {
          const amount = toNum(tl.amount)
          if (amount <= 0) continue
          if (tl.nature === 'withholding') {
            // TDS withheld from a customer's payment: Dr. TDS receivable.
            lines.push({
              account: taxAccountFor(tl, 'sales'),
              debit: amount,
              memo: `TDS ${tl.nature}`,
            })
          } else {
            lines.push({
              account: taxAccountFor(tl, 'sales'),
              credit: amount,
              memo: `Tax ${tl.nature}`,
            })
          }
        }
      } else if (tax > 0) {
        lines.push({
          account: resolveAccount(settings, 'taxAccount', type, 'Output Tax'),
          credit: tax,
        })
      }
      if (stockPlan.totalCogs > 0) {
        lines.push({
          account: resolveAccount(settings, 'cogsAccount', type, 'COGS'),
          debit: stockPlan.totalCogs,
        })
        lines.push({
          account: resolveAccount(settings, 'inventoryAccount', type, 'Inventory'),
          credit: stockPlan.totalCogs,
        })
      }
      break
    case 'purchase-invoice':
      // Expense (net) + Input Tax ← AP (gross); withholding credits TDS payable.
      lines.push({
        account: resolveAccount(settings, 'expenseAccount', type, 'Purchases / Expense'),
        debit: net,
      })
      if (taxLines.length > 0) {
        for (const tl of taxLines) {
          const amount = toNum(tl.amount)
          if (amount <= 0) continue
          if (tl.nature === 'withholding') {
            lines.push({
              account: taxAccountFor(tl, 'purchase'),
              credit: amount,
              memo: `TDS ${tl.nature}`,
            })
          } else {
            lines.push({
              account: taxAccountFor(tl, 'purchase'),
              debit: amount,
              memo: `Tax ${tl.nature}`,
            })
          }
        }
      } else if (tax > 0) {
        lines.push({
          account: resolveAccount(settings, 'taxAccount', type, 'Input Tax'),
          debit: tax,
        })
      }
      lines.push({
        account: resolveAccount(settings, 'payableAccount', type, 'Accounts Payable'),
        credit: gross,
      })
      break
    case 'payment-voucher':
      // AP ← Cash / Bank. The payable leg uses the full amount (net); when
      // TDS (withholding) is present the cash leg is net of TDS and the TDS
      // is credited to its payable ledger.
      lines.push({
        account: resolveAccount(settings, 'payableAccount', type, 'Accounts Payable'),
        debit: net,
      })
      if (withheld > 0) {
        const tds = (doc.taxLines || []).find(
          (tl: any) => tl.nature === 'withholding' && toNum(tl.amount) > 0,
        )
        if (tds) {
          lines.push({
            account: taxAccountFor(tds, 'purchase'),
            credit: withheld,
            memo: 'TDS payable',
          })
        }
        lines.push({
          account: pickCashOrBank(doc, settings, type),
          credit: round2(net - withheld),
        })
      } else {
        lines.push({
          account: pickCashOrBank(doc, settings, type),
          credit: gross,
        })
      }
      break
    case 'receipt-voucher':
      // Cash / Bank ← AR. The receivable leg uses the full amount (net);
      // when TDS (withholding) is present the cash leg is net of TDS and the
      // TDS is debited to its receivable ledger.
      if (withheld > 0) {
        const tds = (doc.taxLines || []).find(
          (tl: any) => tl.nature === 'withholding' && toNum(tl.amount) > 0,
        )
        lines.push({
          account: pickCashOrBank(doc, settings, type),
          debit: round2(net - withheld),
        })
        if (tds) {
          lines.push({
            account: taxAccountFor(tds, 'sales'),
            debit: withheld,
            memo: 'TDS receivable',
          })
        }
        lines.push({
          account: resolveAccount(settings, 'receivableAccount', type, 'Accounts Receivable'),
          credit: net,
        })
      } else {
        lines.push({
          account: pickCashOrBank(doc, settings, type),
          debit: gross,
        })
        lines.push({
          account: resolveAccount(settings, 'receivableAccount', type, 'Accounts Receivable'),
          credit: gross,
        })
      }
      break
    case 'membership-receipt':
      // Cash / Bank ← Membership Fees (income)
      lines.push({
        account: pickCashOrBank(doc, settings, type),
        debit: gross,
      })
      lines.push({
        account: resolveAccount(settings, 'membershipFeeAccount', type, 'Membership Fees'),
        credit: gross,
      })
      break
    case 'donation-receipt':
      // Cash / Bank ← Donation Income
      lines.push({
        account: pickCashOrBank(doc, settings, type),
        debit: gross,
      })
      lines.push({
        account: resolveAccount(settings, 'donationAccount', type, 'Donations'),
        credit: gross,
      })
      break
    case 'credit-note':
      // Reduces the amount owed. Direction depends on original doc type:
      //   Sales-side: Dr. Sales Returns, Cr. AR
      //   Purchase-side: Dr. AP, Cr. Purchase Returns
      {
        const origType = (doc as any).referenceToDocType || ''
        const isPurchase = ['purchase-invoice', 'purchase-order', 'grn'].includes(origType)
        if (isPurchase) {
          lines.push({
            account: resolveAccount(settings, 'payableAccount', type, 'Accounts Payable'),
            debit: gross,
          })
          lines.push({
            account: resolveAccount(settings, 'returnsAccount', type, 'Purchase Returns'),
            credit: gross,
          })
        } else {
          // Default: sales-side credit note
          lines.push({
            account: resolveAccount(settings, 'returnsAccount', type, 'Sales Returns'),
            debit: gross,
          })
          lines.push({
            account: resolveAccount(settings, 'receivableAccount', type, 'Accounts Receivable'),
            credit: gross,
          })
        }
      }
      break
    case 'debit-note':
      // A debit note from a supplier INCREASES what we owe.
      // Dr. Expense (we incur more cost)  Cr. AP (we owe more).
      lines.push({
        account: resolveAccount(settings, 'expenseAccount', type, 'Purchases / Expense'),
        debit: gross,
      })
      lines.push({
        account: resolveAccount(settings, 'payableAccount', type, 'Accounts Payable'),
        credit: gross,
      })
      break
    case 'petty-cash-voucher':
      // Expense ← Petty Cash
      lines.push({
        account: resolveAccount(settings, 'expenseAccount', type, 'Expense'),
        debit: gross,
      })
      lines.push({
        account: resolveAccount(settings, 'pettyCashAccount', type, 'Petty Cash'),
        credit: gross,
      })
      break
    case 'grn':
      // Inventory ← Accrued Payables
      lines.push({
        account: resolveAccount(settings, 'inventoryAccount', type, 'Inventory'),
        debit: gross,
      })
      lines.push({
        account: resolveAccount(settings, 'accruedPayableAccount', type, 'Accrued Payables'),
        credit: gross,
      })
      break
    case 'delivery-challan':
      // COGS ← Inventory at weighted-average cost when item lines are
      // present; otherwise fall back to the document total.
      const cogs = stockPlan.totalCogs > 0 ? stockPlan.totalCogs : gross
      lines.push({
        account: resolveAccount(settings, 'cogsAccount', type, 'COGS'),
        debit: cogs,
      })
      lines.push({
        account: resolveAccount(settings, 'inventoryAccount', type, 'Inventory'),
        credit: cogs,
      })
      break
    case 'journal-voucher':
      // Free-form balanced entry.
      for (const l of doc.journalLines || []) {
        lines.push({
          account: accId(l.account),
          debit: toNum(l.debit),
          credit: toNum(l.credit),
          memo: l.memo || undefined,
        })
      }
      break
    case 'contra':
      // Transfer between two cash/bank accounts (cash ↔ bank, bank ↔ bank).
      // The "from" account is credited and the "to" account debited.
      {
        const fromId = doc.fromAccount
          ? accId(doc.fromAccount)
          : resolveAccount(settings, 'bankAccount', type, 'Bank')
        const toId = doc.toAccount
          ? accId(doc.toAccount)
          : resolveAccount(settings, 'cashAccount', type, 'Cash')
        if (!fromId || !toId) {
          throw new Error('Contra vouchers need both a source and target account.')
        }
        lines.push({ account: toId, debit: gross })
        lines.push({ account: fromId, credit: gross })
      }
      break
    default:
      throw new Error(`Unsupported document type: ${type}`)
  }
  return lines
}

/**
 * Validates a contra voucher: both accounts must be cash/bank (class) and
 * distinct, with a positive transfer amount. Fetches the linked accounts so
 * the posting engine never resolves to a non-cash account.
 */
async function validateContra(
  payload: PayloadRequest['payload'],
  d: any,
): Promise<void> {
  const fromId = d.fromAccount ? Number(accId(d.fromAccount)) : NaN
  const toId = d.toAccount ? Number(accId(d.toAccount)) : NaN
  if (!fromId || !toId) {
    throw vErr('Contra vouchers need both a source (from) and target (to) account.')
  }
  if (fromId === toId) {
    throw vErr('The source and target accounts of a contra voucher must be different.')
  }
  const amount = toNum(d.grossTotal ?? d.netTotal)
  if (amount <= 0) {
    throw vErr('A contra voucher needs a positive transfer amount.')
  }
  const [from, to] = await Promise.all([
    payload.findByID({ collection: 'gl-accounts', id: fromId, depth: 0 }).catch(() => null),
    payload.findByID({ collection: 'gl-accounts', id: toId, depth: 0 }).catch(() => null),
  ])
  for (const [label, acct] of [
    ['source', from],
    ['target', to],
  ] as const) {
    const a = acct as any
    if (!a) throw vErr(`Contra ${label} account not found.`)
    if (!['cash', 'bank'].includes(a.class)) {
      throw vErr(
        `Contra ${label} account "${a.name}" is not a cash or bank account.`,
      )
    }
  }
  d.netTotal = amount
  d.grossTotal = amount
  d.taxTotal = 0
  d.taxRate = 0
}

function fiscalYearOf(dateValue: string | Date, fiscalYearStart?: string): number {
  const d = new Date(dateValue)
  if (fiscalYearStart) {
    const fys = new Date(fiscalYearStart)
    const startThisYear = new Date(d.getFullYear(), fys.getMonth(), fys.getDate())
    return d >= startThisYear ? d.getFullYear() : d.getFullYear() - 1
  }
  return d.getFullYear()
}

/**
 * Atomically increments the per-type/per-year/per-tenant sequence and
 * returns the formatted voucher number (e.g. SI-2026-0003).
 *
 * The key is scoped to the illaka as well as the doc type and fiscal year,
 * so each illaka numbers its own vouchers from 1 (per-tenant numbering).
 */
async function nextNumber(
  payload: PayloadRequest['payload'],
  docType: string,
  dateValue: string | Date,
  fiscalYearStart?: string,
  tenant?: number | string | { id: number | string } | null,
): Promise<string> {
  const fy = fiscalYearOf(dateValue, fiscalYearStart)
  const tenantId =
    tenant && typeof tenant === 'object' ? tenant.id : tenant || 'org'
  const key = `${docType}:${fy}:${tenantId}`
  const pool = (payload.db as any).pool
  const result = await pool.query(
    `INSERT INTO doc_sequences (key, last_number, created_at, updated_at)
     VALUES ($1, 1, now(), now())
     ON CONFLICT (key)
     DO UPDATE SET last_number = doc_sequences.last_number + 1, updated_at = now()
     RETURNING last_number`,
    [key],
  )
  const seq = Number(result.rows[0].last_number)
  const prefix = DOC_PREFIXES[docType] || 'DOC'
  return `${prefix}-${fy}-${String(seq).padStart(4, '0')}`
}

function isBillingReq(req: PayloadRequest): boolean {
  return Boolean(req.user && isBillingUser(req.user))
}

/**
 * Post a draft document: builds the journal entry per the docType posting
 * rule, assigns the voucher number, writes stock movements, and marks the
 * document posted. Shared by the `/post` endpoint and the members pay-fee
 * auto-post path. Throws on failure (caller maps to an HTTP response); the
 * transaction is committed here and rolled back on error.
 */
export async function postDocument(
  payload: PayloadRequest['payload'],
  docId: number | string,
  opts?: { request?: PayloadRequest },
): Promise<{
  doc: any
  journalEntry: number | string
  number: string
  stockMovements: number
}> {
  const transactionID =
    (await payload.db.beginTransaction()) ?? undefined
  try {
    const doc = (await payload.findByID({
      collection: 'documents',
      id: docId,
      depth: 0,
    })) as any
    if (!doc) throw new Error('Document not found.')
    if (doc.status !== 'draft') {
      throw new Error('Only draft documents can be posted.')
    }
    if (isOrderType(doc.docType)) {
      throw new Error(
        'Orders are status-only documents (confirmed, not posted). Confirm the order to lock it, then raise the challan/invoice against it.',
      )
    }
    const settings = await getSettings(payload)
    // Inventory side-effects (movements + COGS) are computed up front so
    // a stock shortfall aborts the whole posting before any write.
    const stockPlan = await computeStockPlan(payload, doc)
    // Resolve the tax types referenced by the document's tax lines so the
    // posting engine can use each tax's own sales/purchase ledger account.
    const taxById = new Map<number, any>()
    const taxTypeIds = Array.from(
      new Set(
        (doc.taxLines || [])
          .map((tl: any) => (tl.taxType ? accId(tl.taxType) : null))
          .filter((v: number | null) => v !== null),
      ),
    )
    if (taxTypeIds.length) {
      const taxRes = await payload.find({
        collection: 'tax-types',
        where: { id: { in: taxTypeIds } },
        depth: 0,
        limit: 1000,
      })
      for (const t of taxRes.docs as any[]) taxById.set(Number(t.id), t)
    }
    const lines = buildPostingLines(doc, settings, stockPlan, taxById)
    const narration =
      doc.narration ||
      (DOC_TYPES.find((t) => t.value === doc.docType)?.label || doc.docType)

    const entry = await payload.create({
      collection: 'journal-entries',
      data: {
        date: doc.date,
        narration,
        status: 'posted',
        lines: lines.map((l) => ({
          account: l.account,
          debit: l.debit || undefined,
          credit: l.credit || undefined,
          memo: l.memo || undefined,
        })),
        referenceDoc: doc.id,
        // The entry inherits the document's illaka — the beforeValidate
        // hook only fills tenant when missing.
        tenant: doc.tenant,
      },
      req: { transactionID },
    })

    // Stock movements, atomic with the journal entry.
    for (const mv of stockPlan.movements) {
      await payload.create({
        collection: 'stock-movements',
        data: {
          item: mv.itemId,
          doc: doc.id,
          date: doc.date,
          qtyIn: mv.isIn ? mv.qty : undefined,
          qtyOut: mv.isIn ? undefined : mv.qty,
          unitCost: mv.unitCost,
          tenant: doc.tenant,
        },
        req: { transactionID },
      })
    }

    const number = await nextNumber(
      payload,
      doc.docType,
      doc.date,
      settings?.fiscalYearStart,
      doc.tenant,
    )

    const updated = await payload.update({
      collection: 'documents',
      id: doc.id,
      data: {
        status: 'posted',
        number,
        journalEntry: entry.id,
        narration,
      },
      req: {
        transactionID,
        context: { docStatusTransition: 'posted' },
      },
    })

    if (transactionID) {
      await payload.db.commitTransaction(transactionID)
    }

    return {
      doc: updated,
      journalEntry: entry.id,
      number,
      stockMovements: stockPlan.movements.length,
    }
  } catch (err) {
    try {
      if (transactionID) {
        await payload.db.rollbackTransaction(transactionID)
      }
    } catch {
      // transaction already ended
    }
    throw err
  }
}

export const Documents: CollectionConfig = {
  slug: 'documents',
  admin: {
    useAsTitle: 'number',
    group: 'Billing',
    defaultColumns: ['number', 'docType', 'date', 'party', 'status', 'grossTotal', 'updatedAt'],
  },
  access: {
    create: scopedCreate,
    read: scopedRead,
    update: scopedUpdate,
    delete: scopedDelete,
  },
  endpoints: [
    {
      // Post a draft: builds the journal entry per the docType posting rule,
      // assigns the voucher number, and marks the document posted.
      path: '/:id/post',
      method: 'post',
      handler: async (req) => {
        if (!isBillingReq(req)) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const id = req.routeParams?.id as string
        if (!id) {
          return Response.json({ error: 'Missing document id' }, { status: 400 })
        }
        try {
          const result = await postDocument(req.payload, id, { request: req })
          return Response.json({
            doc: result.doc,
            journalEntry: result.journalEntry,
            number: result.number,
            stockMovements: result.stockMovements,
          })
        } catch (err) {
          const raw = err instanceof Error ? err : null
          const ve = (raw as any)?.data as
            | { errors?: { message?: string }[] }
            | undefined
          const message =
            ve?.errors?.[0]?.message || raw?.message || 'Posting failed'
          const status =
            raw?.message?.includes('not found') ? 404 : 400
          return Response.json({ error: message }, { status })
        }
      },
    },
    {
      // Confirm an order (sales-order / purchase-order): assigns the order
      // number and locks the order. Orders are status-only documents — they
      // never touch the ledger. Fulfilment happens through the linked
      // challan / GRN / invoice (see the /orders report).
      path: '/:id/confirm',
      method: 'post',
      handler: async (req) => {
        if (!isBillingReq(req)) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const id = req.routeParams?.id as string
        if (!id) {
          return Response.json({ error: 'Missing document id' }, { status: 400 })
        }
        try {
          const doc = (await req.payload.findByID({
            collection: 'documents',
            id,
            depth: 0,
          })) as any
          if (!doc) {
            return Response.json({ error: 'Document not found' }, { status: 404 })
          }
          if (!isOrderType(doc.docType)) {
            return Response.json(
              { error: 'Only sales orders and purchase orders can be confirmed.' },
              { status: 409 },
            )
          }
          if (doc.orderStatus !== 'draft') {
            return Response.json(
              { error: 'Only draft orders can be confirmed.' },
              { status: 409 },
            )
          }
          const settings = await getSettings(req.payload)
          const number = await nextNumber(
            req.payload,
            doc.docType,
            doc.date,
            settings?.fiscalYearStart,
            doc.tenant,
          )
          const updated = await req.payload.update({
            collection: 'documents',
            id: doc.id,
            data: {
              orderStatus: 'confirmed',
              number,
              confirmedAt: new Date().toISOString(),
            },
            req: {
              context: { docOrderTransition: 'confirmed' },
            },
          })
          return Response.json({ doc: updated, number })
        } catch (err) {
          const raw = err instanceof Error ? err : null
          const ve = (raw as any)?.data as
            | { errors?: { message?: string }[] }
            | undefined
          const message =
            ve?.errors?.[0]?.message || raw?.message || 'Confirming failed'
          return Response.json({ error: message }, { status: 400 })
        }
      },
    },
    {
      // Cancel an order: marks it cancelled. Draft orders can be cancelled
      // freely; confirmed orders can still be cancelled before fulfilment
      // is locked in. Cancelled orders are final.
      path: '/:id/cancel',
      method: 'post',
      handler: async (req) => {
        if (!isBillingReq(req)) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const id = req.routeParams?.id as string
        if (!id) {
          return Response.json({ error: 'Missing document id' }, { status: 400 })
        }
        try {
          const doc = (await req.payload.findByID({
            collection: 'documents',
            id,
            depth: 0,
          })) as any
          if (!doc) {
            return Response.json({ error: 'Document not found' }, { status: 404 })
          }
          if (!isOrderType(doc.docType)) {
            return Response.json(
              { error: 'Only sales orders and purchase orders can be cancelled.' },
              { status: 409 },
            )
          }
          if (doc.orderStatus === 'cancelled') {
            return Response.json(
              { error: 'Order is already cancelled.' },
              { status: 409 },
            )
          }
          const updated = await req.payload.update({
            collection: 'documents',
            id: doc.id,
            data: {
              orderStatus: 'cancelled',
              cancelledAt: new Date().toISOString(),
            },
            req: {
              context: { docOrderTransition: 'cancelled' },
            },
          })
          return Response.json({ doc: updated })
        } catch (err) {
          const raw = err instanceof Error ? err : null
          const ve = (raw as any)?.data as
            | { errors?: { message?: string }[] }
            | undefined
          const message =
            ve?.errors?.[0]?.message || raw?.message || 'Cancelling failed'
          return Response.json({ error: message }, { status: 400 })
        }
      },
    },
    {
      // Open orders register: confirmed (and optionally draft) orders with
      // their fulfilment status — how much has been delivered / billed /
      // received through linked documents. side=sell|buy selects the order
      // type; linked fulfilment docs are found via referenceTo.
      path: '/orders',
      method: 'get',
      handler: async (req) => {
        if (!isBillingReq(req)) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const { searchParams } = new URL(req.url || '/')
        const side = searchParams.get('side') || 'sell'
        if (side !== 'sell' && side !== 'buy') {
          return Response.json(
            { error: 'side must be "sell" or "buy"' },
            { status: 400 },
          )
        }
        const orderType = side === 'sell' ? 'sales-order' : 'purchase-order'
        const fulfilTypes =
          side === 'sell'
            ? ['delivery-challan', 'sales-invoice']
            : ['grn', 'purchase-invoice']
        const from = searchParams.get('from') || undefined
        const to = searchParams.get('to') || undefined
        const status = searchParams.get('status') || 'confirmed'
        const tenant = resolveScopedTenant(req, searchParams.get('tenant'))

        const where: any = {
          docType: { equals: orderType },
          orderStatus: { equals: status },
        }
        if (from) where.date = { ...((where.date as object) || {}), greater_than_equal: from }
        if (to) where.date = { ...((where.date as object) || {}), less_than_equal: to }
        if (tenant) where.tenant = { equals: tenant }

        const res = await req.payload.find({
          collection: 'documents',
          where,
          limit: 1000,
          depth: 1,
          sort: 'date',
        })
        const orders = res.docs as any[]

        // Fulfilment: sum gross of posted linked docs per order.
        const orderIds = orders.map((o) => o.id)
        let linked: any[] = []
        if (orderIds.length) {
          const linkedRes = await req.payload.find({
            collection: 'documents',
            where: {
              status: { equals: 'posted' },
              docType: { in: fulfilTypes },
              referenceTo: { in: orderIds },
            },
            limit: 1000,
            depth: 0,
          })
          linked = linkedRes.docs as any[]
        }
        const fulfilledByOrder = new Map<number, number>()
        const linkedByOrder = new Map<number, any[]>()
        for (const l of linked) {
          const ref = l.referenceTo && typeof l.referenceTo === 'object'
            ? l.referenceTo.id
            : l.referenceTo
          const key = Number(ref)
          if (!key) continue
          fulfilledByOrder.set(
            key,
            round2((fulfilledByOrder.get(key) || 0) + toNum(l.grossTotal)),
          )
          const arr = linkedByOrder.get(key) || []
          arr.push({
            id: l.id,
            docType: l.docType,
            number: l.number || '',
            date: l.date,
            grossTotal: round2(toNum(l.grossTotal)),
          })
          linkedByOrder.set(key, arr)
        }

        const rows = orders.map((o) => {
          const fulfilled = fulfilledByOrder.get(o.id) || 0
          const gross = round2(toNum(o.grossTotal))
          return {
            id: o.id,
            number: o.number || '',
            date: o.date,
            orderStatus: o.orderStatus,
            party:
              o.party && typeof o.party === 'object'
                ? { id: o.party.id, name: o.party.name }
                : null,
            grossTotal: gross,
            fulfilled,
            remaining: round2(Math.max(0, gross - fulfilled)),
            fulfilledPct:
              gross > 0 ? round2((fulfilled / gross) * 100) : 0,
            linked: linkedByOrder.get(o.id) || [],
          }
        })

        return Response.json({
          side,
          status,
          count: rows.length,
          totalValue: round2(rows.reduce((t, r) => t + r.grossTotal, 0)),
          totalFulfilled: round2(rows.reduce((t, r) => t + r.fulfilled, 0)),
          rows,
        })
      },
    },
    {
      // Void a posted document: creates a full reversal journal entry and
      // marks the document void. Voided documents are final.
      path: '/:id/void',
      method: 'post',
      handler: async (req) => {
        if (!isBillingReq(req)) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const id = req.routeParams?.id as string
        if (!id) {
          return Response.json({ error: 'Missing document id' }, { status: 400 })
        }
        // Parse optional request body for the reason
        let reason = 'Full void'
        try {
          const chunks: Buffer[] = []
          const reader = (req as any).body?.getReader?.()
          if (reader) {
            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              chunks.push(value)
            }
            const parsed = JSON.parse(Buffer.concat(chunks).toString())
            if (parsed.reason) reason = parsed.reason
          } else if ((req as any).json) {
            const parsed = await (req as any).json()
            if (parsed.reason) reason = parsed.reason
          }
        } catch {
          // No body or invalid JSON — use default reason
        }
        const transactionID =
          (await req.payload.db.beginTransaction()) ?? undefined
        try {
          const doc = (await req.payload.findByID({
            collection: 'documents',
            id,
            depth: 0,
            overrideAccess: true,
          })) as any
          if (!doc) {
            return Response.json({ error: 'Document not found' }, { status: 404 })
          }
          if (doc.status !== 'posted') {
            return Response.json(
              { error: 'Only posted documents can be voided.' },
              { status: 409 },
            )
          }
          const entry = (await req.payload.findByID({
            collection: 'journal-entries',
            id: doc.journalEntry,
            depth: 0,
            overrideAccess: true,
          })) as any
          if (!entry) {
            return Response.json(
              { error: 'Document has no journal entry — cannot void.' },
              { status: 409 },
            )
          }

          // Void always creates a CREDIT note — it reduces the balance:
          //   Sales void: reduces AR (Dr. Returns, Cr. AR)
          //   Purchase void: reduces AP (Dr. AP, Cr. Returns)
          const creditNoteType = 'credit-note'

          // Generate a number for the credit/debit note
          const cnNumber = await nextNumber(req.payload, creditNoteType, new Date().toISOString().slice(0, 10), undefined, doc.tenant)

          // Create credit/debit note for the full amount
          const noteLines = (doc.lines || []).map((l: any) => ({
            description: l.description || 'Voided item',
            qty: toNum(l.qty) || 1,
            rate: toNum(l.rate) || 0,
            amount: toNum(l.amount) || round2((toNum(l.qty) || 1) * (toNum(l.rate) || 0)),
          }))

          const creditNote = await req.payload.create({
            collection: 'documents',
            data: {
              docType: creditNoteType,
              number: cnNumber,
              date: new Date().toISOString().slice(0, 10),
              party: doc.party,
              status: 'posted',
              narration: `${reason} — ${doc.number || doc.id}`,
              lines: noteLines,
              netTotal: toNum(doc.netTotal) || 0,
              grossTotal: toNum(doc.grossTotal) || 0,
              tenant: doc.tenant,
              referenceTo: doc.id,
              referenceToDocType: doc.docType,
            },
            req: {
              transactionID,
              context: { docStatusTransition: 'post' },
            },
          }) as any

          // Build voidedItems for all lines
          const allLines: any[] = doc.lines || []
          const voidedItems = allLines.map((l: any, idx: number) => ({
            itemIndex: idx,
            quantity: toNum(l.qty) || 1,
            reason: reason,
            creditNoteId: creditNote.id,
            noteNumber: cnNumber,
            voidedAt: new Date().toISOString(),
            voidedBy: req.user?.email || 'system',
          }))

          // Reverse the document's stock movements so voiding a sale restores
          // stock (and vice versa for a GRN), atomic with the credit note.
          const moves = await req.payload.find({
            collection: 'stock-movements',
            where: { doc: { equals: doc.id } },
            limit: 1000,
            depth: 0,
          })
          for (const m of moves.docs as any[]) {
            const qtyIn = toNum(m.qtyIn)
            const qtyOut = toNum(m.qtyOut)
            await req.payload.create({
              collection: 'stock-movements',
              data: {
                item: accId(m.item),
                doc: doc.id,
                date: new Date().toISOString().slice(0, 10),
                qtyIn: qtyOut > 0 ? qtyOut : undefined,
                qtyOut: qtyIn > 0 ? qtyIn : undefined,
                unitCost: toNum(m.unitCost),
                tenant: doc.tenant,
              },
              req: { transactionID },
            })
          }

          const updated = await req.payload.update({
            collection: 'documents',
            id: doc.id,
            data: {
              status: 'void',
              voidedItems,
              voidedAmount: toNum(doc.grossTotal) || 0,
            },
            req: {
              transactionID,
              context: { docStatusTransition: 'void' },
            },
          })

          if (transactionID) {
            await req.payload.db.commitTransaction(transactionID)
          }

          return Response.json({
            doc: updated,
            creditNote: { id: creditNote.id, number: creditNote.number, amount: toNum(doc.grossTotal) || 0 },
            reversedMovements: moves.docs.length,
          })
        } catch (err) {
          try {
            if (transactionID) {
              await req.payload.db.rollbackTransaction(transactionID)
            }
          } catch {
            // transaction already ended
          }
          const raw = err instanceof Error ? err : null
          const ve = (raw as any)?.data as
            | { errors?: { message?: string }[] }
            | undefined
          console.error('[VOID-ERROR]', err)
          const message =
            ve?.errors?.[0]?.message || raw?.message || 'Voiding failed'
          return Response.json({ error: message }, { status: 400 })
        }
      },
    },
    {
      // Partial void: void specific line items by creating a credit/debit note
      // for the voided amounts and recording which items were voided.
      path: '/:id/partial-void',
      method: 'post',
      handler: async (req) => {
        if (!isBillingReq(req)) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const id = req.routeParams?.id as string
        if (!id) {
          return Response.json({ error: 'Missing document id' }, { status: 400 })
        }

        // Parse request body
        let body: any = {}
        try {
          const chunks: Buffer[] = []
          const reader = (req as any).body?.getReader?.()
          if (reader) {
            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              chunks.push(value)
            }
            body = JSON.parse(Buffer.concat(chunks).toString())
          } else if ((req as any).json) {
            body = await (req as any).json()
          }
        } catch {
          return Response.json({ error: 'Invalid request body' }, { status: 400 })
        }

        const items: Array<{ itemIndex: number; quantity: number; reason?: string }> = body.items
        if (!items || !Array.isArray(items) || items.length === 0) {
          return Response.json({ error: 'items array is required' }, { status: 400 })
        }

        const transactionID = (await req.payload.db.beginTransaction()) ?? undefined
        try {
          const doc = (await req.payload.findByID({
            collection: 'documents',
            id,
            depth: 0,
            overrideAccess: true,
          })) as any

          if (!doc) {
            return Response.json({ error: 'Document not found' }, { status: 404 })
          }
          if (doc.status !== 'posted') {
            return Response.json({ error: 'Only posted documents can be partially voided.' }, { status: 409 })
          }

          const lines: any[] = doc.lines || []
          let totalVoidedAmount = 0
          const voidedItems: any[] = []

          for (const item of items) {
            const line = lines[item.itemIndex]
            if (!line) {
              return Response.json({ error: `Invalid itemIndex: ${item.itemIndex}` }, { status: 400 })
            }
            const lineQty = toNum(line.qty) || 1
            if (item.quantity <= 0 || item.quantity > lineQty) {
              return Response.json({ error: `Invalid quantity for item ${item.itemIndex}: must be 1-${lineQty}` }, { status: 400 })
            }
            const lineRate = toNum(line.rate) || 0
            const voidedAmt = round2(item.quantity * lineRate)
            totalVoidedAmount += voidedAmt
            voidedItems.push({
              itemIndex: item.itemIndex,
              quantity: item.quantity,
              reason: item.reason || '',
              voidedAt: new Date().toISOString(),
              voidedBy: req.user?.email || 'system',
            })
          }

          // Partial void always creates a credit note
          const creditNoteType = 'credit-note'

          // Generate a number for the credit/debit note
          const cnNumber = await nextNumber(req.payload, creditNoteType, new Date().toISOString().slice(0, 10), undefined, doc.tenant)

          // Create credit/debit note
          const noteLines = items.map((item) => {
            const line = lines[item.itemIndex]
            const rate = toNum(line.rate) || 0
            return {
              description: `${item.reason || 'Void'} - ${line.description || 'Item'}`,
              qty: item.quantity,
              rate: rate,
              amount: round2(item.quantity * rate),
            }
          })

          const creditNote = await req.payload.create({
            collection: 'documents',
            data: {
              docType: creditNoteType,
              number: cnNumber,
              date: new Date().toISOString().slice(0, 10),
              party: doc.party,
              status: 'posted',
              narration: `Partial void of ${doc.number || doc.id}: ${items.map(i => i.reason || `item ${i.itemIndex + 1}`).join(', ')}`,
              lines: noteLines,
              netTotal: totalVoidedAmount,
              grossTotal: totalVoidedAmount,
              tenant: doc.tenant,
              referenceTo: doc.id,
              referenceToDocType: doc.docType,
            },
            req: {
              transactionID,
              context: { docStatusTransition: 'post' },
            },
          }) as any

          // Link credit note back to the original doc's voided items
          for (let i = 0; i < voidedItems.length; i++) {
            voidedItems[i].creditNoteId = creditNote.id
            voidedItems[i].noteNumber = cnNumber
          }

          // Update original document with voided items
          const existingVoided = doc.voidedItems || []
          const updated = await req.payload.update({
            collection: 'documents',
            id: doc.id,
            data: {
              voidedItems: [...existingVoided, ...voidedItems],
              voidedAmount: round2((doc.voidedAmount || 0) + totalVoidedAmount),
              // If all items are now voided, mark as full void
              status: totalVoidedAmount >= (doc.grossTotal || 0) ? 'void' : doc.status,
            },
            req: {
              transactionID,
              context: { docStatusTransition: 'partial-void' },
            },
          })

          if (transactionID) {
            await req.payload.db.commitTransaction(transactionID)
          }

          return Response.json({
            doc: updated,
            creditNote: { id: creditNote.id, number: creditNote.number, amount: totalVoidedAmount },
            voidedItems,
          })
        } catch (err) {
          try {
            if (transactionID) await req.payload.db.rollbackTransaction(transactionID)
          } catch {}
          const raw = err instanceof Error ? err : null
          return Response.json({ error: raw?.message || 'Partial void failed' }, { status: 400 })
        }
      },
    },

    {
      // AR / AP aging: open positions from posted documents, bucketed by age.
      // AR side: sales invoices (+) reduced by credit notes & receipts (−).
      // AP side: purchase invoices (+) reduced by debit notes & payments (−).
      path: '/aging',
      method: 'get',
      handler: async (req) => {
        if (!isBillingReq(req)) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const { searchParams } = new URL(req.url || '/')
        const side = searchParams.get('side') || 'ar'
        if (side !== 'ar' && side !== 'ap') {
          return Response.json(
            { error: 'side must be "ar" or "ap"' },
            { status: 400 },
          )
        }
        const asOf = searchParams.get('asOf')
          ? new Date(searchParams.get('asOf')!)
          : new Date()
        const posTypes =
          side === 'ar'
            ? ['sales-invoice']
            : ['purchase-invoice', 'debit-note']
        const negTypes =
          side === 'ar'
            ? ['credit-note', 'receipt-voucher']
            : ['credit-note', 'payment-voucher']

        // Scope to the caller's illaka (forced for illaka users) or the
        // explicit tenant filter.
        const tenant = resolveScopedTenant(req, searchParams.get('tenant'))
        const res = await req.payload.find({
          collection: 'documents',
          where: {
            status: { equals: 'posted' },
            docType: { in: [...posTypes, ...negTypes] },
            ...(tenant ? { tenant: { equals: tenant } } : {}),
          },
          limit: 1000,
          depth: 1,
          sort: 'date',
        })

        const bucket = (days: number) =>
          days <= 30 ? '0-30' : days <= 60 ? '31-60' : days <= 90 ? '61-90' : '90+'

        const rows: any[] = []
        const byParty = new Map<number, any>()

        for (const doc of res.docs as any[]) {
          const party = doc.party
          if (!party || typeof party !== 'object') continue
          // Credit notes are shared across AR and AP negTypes. Only count
          // a credit note on the side its original invoice belongs to.
          if (doc.docType === 'credit-note') {
            const refType = doc.referenceToDocType || ''
            const isPurchaseRef = ['purchase-invoice', 'purchase-order', 'grn'].includes(refType)
            if (side === 'ar' && isPurchaseRef) continue
            if (side === 'ap' && !isPurchaseRef) continue
          }
          const sign = posTypes.includes(doc.docType) ? 1 : -1
          // Subtract voided amount so partially-voided documents show the
          // remaining open balance, not the original gross.
          const effective = round2(toNum(doc.grossTotal) - toNum(doc.voidedAmount || 0))
          const amount = round2(sign * effective)
          if (amount === 0) continue
          const days = Math.max(
            0,
            Math.floor(
              (asOf.getTime() - new Date(doc.date).getTime()) / 86_400_000,
            ),
          )
          const b = bucket(days)
          rows.push({
            party: { id: party.id, name: party.name },
            docId: doc.id,
            docType: doc.docType,
            number: doc.number || '',
            date: doc.date,
            amount,
            days,
            bucket: b,
          })
          let g = byParty.get(party.id)
          if (!g) {
            g = {
              party: { id: party.id, name: party.name },
              total: 0,
              buckets: { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 },
            }
            byParty.set(party.id, g)
          }
          g.total = round2(g.total + amount)
          g.buckets[b] = round2(g.buckets[b] + amount)
        }

        const parties = [...byParty.values()].sort(
          (a, b) => Math.abs(b.total) - Math.abs(a.total),
        )
        const totals = parties.reduce(
          (acc, p) => {
            acc.total = round2(acc.total + p.total)
            for (const b of Object.keys(p.buckets)) {
              acc.buckets[b] = round2(acc.buckets[b] + p.buckets[b])
            }
            return acc
          },
          { total: 0, buckets: { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 } },
        )

        const page = paginate(rows, parsePagination(searchParams))

        return Response.json({
          side,
          asOf: asOf.toISOString(),
          rows: page.docs,
          total: page.total,
          hasMore: page.hasMore,
          limit: parsePagination(searchParams).limit,
          offset: parsePagination(searchParams).offset,
          parties,
          totals,
        })
      },
    },
    {
      // Donations register & summary: posted donation receipts in a date
      // range, with totals by purpose, method, and donor. This is the
      // annual-report view for the income/fundraising taxonomy (§6).
      path: '/donations',
      method: 'get',
      handler: async (req) => {
        if (!isBillingReq(req)) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const { searchParams } = new URL(req.url || '/')
        const from = searchParams.get('from') || undefined
        const to = searchParams.get('to') || undefined
        const tenant = resolveScopedTenant(req, searchParams.get('tenant'))

        const where: any = {
          status: { equals: 'posted' },
          docType: { equals: 'donation-receipt' },
        }
        if (from) where.date = { ...((where.date as object) || {}), greater_than_equal: from }
        if (to) where.date = { ...((where.date as object) || {}), less_than_equal: to }
        if (tenant) where.tenant = { equals: tenant }

        const res = await req.payload.find({
          collection: 'documents',
          where,
          limit: 1000,
          depth: 1,
          sort: 'date',
        })

        const rows: any[] = []
        const byPurpose = new Map<string, number>()
        const byMethod = new Map<string, number>()
        const byDonor = new Map<number, { donor: any; total: number; count: number }>()
        let total = 0

        for (const doc of res.docs as any[]) {
          const amount = round2(toNum(doc.grossTotal))
          const purpose = doc.donationPurpose || 'other'
          const method = doc.paymentMethod || 'bank'
          const donor = doc.party && typeof doc.party === 'object'
            ? { id: doc.party.id, name: doc.party.name }
            : null

          rows.push({
            id: doc.id,
            number: doc.number || '',
            date: doc.date,
            donor,
            purpose,
            method,
            amount,
          })

          total = round2(total + amount)
          byPurpose.set(purpose, round2((byPurpose.get(purpose) || 0) + amount))
          byMethod.set(method, round2((byMethod.get(method) || 0) + amount))

          if (donor) {
            const g = byDonor.get(donor.id)
            if (g) {
              g.total = round2(g.total + amount)
              g.count += 1
            } else {
              byDonor.set(donor.id, { donor, total: amount, count: 1 })
            }
          }
        }

        const donors = [...byDonor.values()].sort((a, b) => b.total - a.total)
        const toKv = (m: Map<string, number>) =>
          [...m.entries()].map(([key, value]) => ({ key, value })).sort((a, b) => b.value - a.value)

        return Response.json({
          from: from || null,
          to: to || null,
          total,
          count: rows.length,
          byPurpose: toKv(byPurpose),
          byMethod: toKv(byMethod),
          donors,
          rows,
        })
      },
    },
    {
      // Peek at the next voucher number without consuming it (UI preview).
      path: '/number/next',
      method: 'get',
      handler: async (req) => {
        if (!isBillingReq(req)) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const { searchParams } = new URL(req.url || '/')
        const type = searchParams.get('type') || ''
        if (!DOC_PREFIXES[type]) {
          return Response.json(
            { error: 'Unknown document type. Pass ?type=…' },
            { status: 400 },
          )
        }
        const dateValue = searchParams.get('date') || undefined
        const settings = await getSettings(req.payload)
        const fy = fiscalYearOf(dateValue ? new Date(dateValue) : new Date(), settings?.fiscalYearStart)
        const tenantParam = searchParams.get('tenant')
        const tenantId = tenantParam ? tenantParam : 'org'
        const key = `${type}:${fy}:${tenantId}`
        const pool = (req.payload.db as any).pool
        const result = await pool.query(
          `SELECT last_number FROM doc_sequences WHERE key = $1`,
          [key],
        )
        const last = result.rows[0] ? Number(result.rows[0].last_number) : 0
        const prefix = DOC_PREFIXES[type]
        return Response.json({
          number: `${prefix}-${fy}-${String(last + 1).padStart(4, '0')}`,
        })
      },
    },
  ],
  hooks: {
    beforeDelete: [
      // NB: Payload calls beforeDelete with { id, req } — the doc is fetched
      // AFTER hooks run, so we fetch it ourselves to enforce the rule.
      async ({ id, req }) => {
        const doc = (await req.payload.findByID({
          collection: 'documents',
          id: String(id),
          depth: 0,
        })) as any
        // Drafts are plain forms and safe to delete; anything that touched
        // the ledger is final and may only be reversed by voiding.
        if (doc?.status === 'posted' || doc?.status === 'void') {
          throw new ValidationError({
            collection: 'documents',
            errors: [
              {
                message:
                  doc.status === 'posted'
                    ? 'Posted documents cannot be deleted. Void the document to reverse it.'
                    : 'Voided documents are final and cannot be deleted.',
                path: 'id',
              },
            ],
          })
        }
      },
    ],
    beforeValidate: [
      assignTenant,
      async ({ data, operation, req }) => {
        if (operation !== 'create' && operation !== 'update') return data
        const d = data as any
        if (d.docType === 'journal-voucher') {
          const errors = validateJournalLines(d.journalLines)
          if (errors.length) {
            throw vErr(errors[0] ?? 'Invalid journal lines.')
          }
        }
        if (d.docType === 'contra') {
          await validateContra(req.payload, d)
        }
        // Skip recomputeTotals for local API calls where arrays aren't flattened;
        // totals must be pre-supplied by the caller (see Members pay-fee endpoint).
        if (d.lines && d.lines.length > 0) {
          recomputeTotals(d)
        }
        return data
      },
    ],
    beforeChange: [
      ({ data, operation, originalDoc, req }) => {
        const doc = originalDoc as any
        const nextStatus = (data as any)?.status
        const engineFlag = (req as any)?.context?.docStatusTransition
        const orderFlag = (req as any)?.context?.docOrderTransition
        const orderStatus = (data as any)?.orderStatus

        // Posted documents are immutable except voiding; voided are final.
        if (operation === 'update' && (doc?.status === 'posted' || doc?.status === 'void')) {
          const allowed =
            doc.status === 'posted' ? nextStatus === 'void' : false
          if (!allowed) {
            throw vErr(
              doc.status === 'posted'
                ? 'Posted documents cannot be edited. Void the document to reverse it.'
                : 'Voided documents are final and cannot be modified.',
            )
          }
        }

        // Orders: confirmed orders are immutable except cancellation;
        // cancelled orders are final. orderStatus may only change through
        // the confirm/cancel endpoints.
        if (operation === 'update' && isOrderType(doc?.docType)) {
          if (doc?.orderStatus === 'cancelled' || doc?.orderStatus === 'confirmed') {
            const allowed = doc.orderStatus === 'confirmed'
              ? orderStatus === 'cancelled'
              : false
            if (!allowed) {
              throw vErr(
                doc.orderStatus === 'confirmed'
                  ? 'Confirmed orders cannot be edited. Cancel the order to modify it.'
                  : 'Cancelled orders are final and cannot be modified.',
              )
            }
          }
          if (orderStatus && orderStatus !== doc?.orderStatus) {
            if (orderFlag !== orderStatus) {
              throw vErr(
                'Order status can only be changed by confirming or cancelling.',
              )
            }
          }
        }

        // Status may only change through the post/void endpoints.
        if (operation === 'update' && nextStatus && nextStatus !== doc?.status) {
          if (engineFlag !== nextStatus) {
            throw vErr(
              'Document status can only be changed by posting or voiding.',
            )
          }
        }

        // Stamp postedAt when the document is posted.
        if ((data as any)?.status === 'posted' && (operation === 'create' || doc?.status !== 'posted')) {
          ;(data as any).postedAt = new Date().toISOString()
        }
        return data
      },
    ],
    // Audit trail: log every create/update/delete to audit-logs.
    afterChange: [
      async ({ doc, operation, req, previousDoc }) => {
        try {
          const d = doc as any
          const user = req.user as any
          await req.payload.create({
            collection: 'audit-logs',
            overrideAccess: true,
            data: {
              action: operation === 'create' ? 'create' : 'update',
              entityType: 'documents',
              entityId: String(d.id),
              entityLabel: d.number || d.docType || String(d.id),
              tenant: d.tenant,
              userName: user?.email || user?.name || 'system',
              userRole: user?.role || '',
              before: previousDoc ? { status: previousDoc.status, grossTotal: previousDoc.grossTotal } : null,
              after: { status: d.status, grossTotal: d.grossTotal, docType: d.docType },
            },
          } as any)
        } catch {
          // Audit writes must never block the main operation.
        }
      },
    ],
  },
  fields: [
    {
      name: 'docType',
      type: 'select',
      required: true,
      options: DOC_TYPES,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'number',
      type: 'text',
      admin: {
        position: 'sidebar',
        readOnly: true,
        description:
          'Assigned automatically on posting (or on confirming an order).',
      },
      access: {
        create: () => false,
        update: () => false,
      },
    },
    {
      name: 'date',
      type: 'date',
      required: true,
      defaultValue: () => new Date(),
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'party',
      type: 'relationship',
      relationTo: 'parties',
      admin: {
        position: 'sidebar',
        description: 'Customer / vendor. Not used for journal vouchers.',
      },
    },
    {
      name: 'narration',
      type: 'textarea',
      admin: {
        description: 'Description of the transaction.',
      },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'draft',
      required: true,
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Posted', value: 'posted' },
        { label: 'Void', value: 'void' },
      ],
      admin: {
        position: 'sidebar',
      },
      // Only the post/void endpoints (local API with overrideAccess) change status.
      access: {
        create: () => false,
        update: () => false,
      },
    },
    {
      name: 'postedAt',
      type: 'date',
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
      access: {
        create: () => false,
        update: () => false,
      },
    },
    // Orders (sales-order / purchase-order): status-only documents that
    // never touch the ledger. Draft → confirmed → cancelled via the
    // confirm/cancel endpoints; number assigned on confirmation.
    {
      name: 'orderStatus',
      type: 'select',
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Confirmed', value: 'confirmed' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
      admin: {
        position: 'sidebar',
        condition: (data) => isOrderType(data?.docType),
        description: 'Order lifecycle. Only the confirm/cancel endpoints change this.',
      },
      access: {
        create: () => false,
        update: () => false,
      },
    },
    {
      name: 'confirmedAt',
      type: 'date',
      admin: {
        position: 'sidebar',
        condition: (data) => isOrderType(data?.docType),
        readOnly: true,
      },
      access: {
        create: () => false,
        update: () => false,
      },
    },
    {
      name: 'cancelledAt',
      type: 'date',
      admin: {
        position: 'sidebar',
        condition: (data) => isOrderType(data?.docType),
        readOnly: true,
      },
      access: {
        create: () => false,
        update: () => false,
      },
    },
    {
      name: 'journalEntry',
      type: 'relationship',
      relationTo: 'journal-entries',
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Journal entry created when this document was posted.',
      },
      access: {
        create: () => false,
        update: () => false,
      },
    },
    {
      name: 'referenceTo',
      type: 'relationship',
      relationTo: 'documents',
      admin: {
        position: 'sidebar',
        description: 'Original document this note/challan refers to.',
      },
    },
    {
      name: 'referenceToDocType',
      type: 'text',
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Doc type of the referenced document (used by aging report to classify credit notes).',
      },
    },
    {
      name: 'linkedInvoice',
      type: 'relationship',
      relationTo: 'documents',
      admin: {
        position: 'sidebar',
        description: 'Sales/Purchase invoice this receipt/payment settles. Links payment to a specific invoice for outstanding tracking.',
        condition: (_data, { siblingData }) =>
          ['receipt-voucher', 'payment-voucher'].includes(siblingData?.docType),
      },
    },

    // -- Partial / Full Void tracking --
    // When items are voided (via credit/debit note), the voided line
    // indices and quantities are recorded here so reports can subtract
    // them and the UI can show which items are voided.
    {
      name: 'voidedItems',
      type: 'array',
      admin: {
        position: 'sidebar',
        description: 'Items that have been voided via credit/debit note.',
      },
      fields: [
        {
          name: 'itemIndex',
          type: 'number',
          required: true,
          admin: { description: '0-based index into the lines[] array' },
        },
        {
          name: 'quantity',
          type: 'number',
          required: true,
          admin: { description: 'Quantity voided (can be less than original qty for partial void)' },
        },
        {
          name: 'reason',
          type: 'text',
        },
        {
          name: 'creditNoteId',
          type: 'relationship',
          relationTo: 'documents',
          admin: { description: 'The credit/debit note created for this voided item' },
        },
        {
          name: 'noteNumber',
          type: 'text',
          admin: { description: 'The CN/DN document number (e.g. CN-2026-0001)' },
        },
        {
          name: 'voidedAt',
          type: 'date',
        },
        {
          name: 'voidedBy',
          type: 'text',
        },
      ],
    },
    {
      name: 'voidedAmount',
      type: 'number',
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Total voided amount. Subtracted from grossTotal for report net amounts.',
      },
      defaultValue: 0,
    },
    {
      name: 'paymentMethod',
      type: 'select',
      options: [
        { label: 'Cash', value: 'cash' },
        { label: 'Bank', value: 'bank' },
      ],
      admin: {
        position: 'sidebar',
        condition: (data) =>
          ['payment-voucher', 'receipt-voucher', 'donation-receipt'].includes(data?.docType),
      },
    },
    {
      name: 'bankAccount',
      type: 'relationship',
      relationTo: 'gl-accounts',
      admin: {
        position: 'sidebar',
        condition: (data) =>
          ['payment-voucher', 'receipt-voucher', 'donation-receipt'].includes(data?.docType),
        description: 'Override the default bank account for this voucher.',
      },
    },
    // Contra vouchers transfer between two cash/bank accounts.
    {
      name: 'fromAccount',
      type: 'relationship',
      relationTo: 'gl-accounts',
      admin: {
        position: 'sidebar',
        condition: (data) => data?.docType === 'contra',
        description: 'Transfer from (credited). Must be a cash or bank account.',
      },
    },
    {
      name: 'toAccount',
      type: 'relationship',
      relationTo: 'gl-accounts',
      admin: {
        position: 'sidebar',
        condition: (data) => data?.docType === 'contra',
        description: 'Transfer to (debited). Must be a cash or bank account.',
      },
    },
    {
      name: 'donationPurpose',
      type: 'select',
      options: [
        { label: 'Individual', value: 'individual' },
        { label: 'Corporate', value: 'corporate' },
        { label: 'Community', value: 'community' },
        { label: 'Other', value: 'other' },
      ],
      admin: {
        position: 'sidebar',
        condition: (data) => data?.docType === 'donation-receipt',
        description: 'Donation classification (per the income/fundraising taxonomy).',
      },
    },
    // Item lines for sales/purchase/stock vouchers.
    {
      name: 'lines',
      type: 'array',
      admin: {
        condition: (data) =>
          Boolean(data?.docType) &&
          data.docType !== 'journal-voucher' &&
          data.docType !== 'contra',
      },
      fields: [
        {
          name: 'item',
          type: 'relationship',
          relationTo: 'items',
          admin: {
            description:
              'Inventory item (optional). When set, posting creates stock movements; GRN receives, sales invoices & challans issue at weighted-average cost.',
          },
        },
        {
          name: 'description',
          type: 'text',
          required: true,
        },
        {
          name: 'qty',
          type: 'number',
        },
        {
          name: 'rate',
          type: 'number',
        },
        {
          name: 'amount',
          type: 'number',
          admin: {
            description: 'Line total. Computed as qty × rate if left empty.',
          },
        },
      ],
    },
    // Free-form journal lines for journal vouchers.
    {
      name: 'journalLines',
      type: 'array',
      admin: {
        condition: (data) => data?.docType === 'journal-voucher',
      },
      fields: [
        {
          name: 'account',
          type: 'relationship',
          relationTo: 'gl-accounts',
          required: true,
        },
        {
          name: 'debit',
          type: 'number',
        },
        {
          name: 'credit',
          type: 'number',
        },
        {
          name: 'memo',
          type: 'text',
        },
      ],
    },
    // Computed totals (server-side, read-only).
    {
      name: 'taxRate',
      type: 'number',
      defaultValue: 0,
      admin: {
        position: 'sidebar',
        description: 'Legacy single tax rate in percent applied to the net total.',
      },
    },
    // Multiple tax system (VAT/GST/TDS). Each line references a tax type and
    // records the computed base and amount; the posting engine uses the tax
    // type's own sales/purchase ledger account.
    {
      name: 'taxLines',
      type: 'array',
      admin: {
        condition: (data) =>
          Boolean(data?.docType) &&
          ['sales-invoice', 'purchase-invoice', 'payment-voucher', 'receipt-voucher'].includes(
            data.docType,
          ),
        description:
          'Taxes on this voucher (additive VAT/GST, inclusive, or withholding TDS).',
      },
      fields: [
        {
          name: 'taxType',
          type: 'relationship',
          relationTo: 'tax-types',
          required: true,
        },
        {
          name: 'nature',
          type: 'select',
          required: true,
          options: [
            { label: 'Additive', value: 'additive' },
            { label: 'Inclusive', value: 'inclusive' },
            { label: 'Withholding', value: 'withholding' },
          ],
        },
        {
          name: 'rate',
          type: 'number',
          required: true,
        },
        {
          name: 'baseAmount',
          type: 'number',
          admin: {
            readOnly: true,
            description: 'Taxable base (computed on save).',
          },
        },
        {
          name: 'amount',
          type: 'number',
          admin: {
            readOnly: true,
            description: 'Computed tax amount.',
          },
        },
      ],
    },
    {
      name: 'netTotal',
      type: 'number',
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
    },
    {
      name: 'taxTotal',
      type: 'number',
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
    },
    {
      name: 'grossTotal',
      type: 'number',
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
    },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
    },
    // Illaka scoping — required; auto-assigned from the user's illaka (or C00).
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      admin: {
        position: 'sidebar',
      },
    },
  ],
}
