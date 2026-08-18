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

const DOC_TYPES = [
  { label: 'Sales Invoice', value: 'sales-invoice' },
  { label: 'Purchase Invoice', value: 'purchase-invoice' },
  { label: 'Payment Voucher', value: 'payment-voucher' },
  { label: 'Receipt Voucher', value: 'receipt-voucher' },
  { label: 'Credit Note', value: 'credit-note' },
  { label: 'Debit Note', value: 'debit-note' },
  { label: 'Petty Cash Voucher', value: 'petty-cash-voucher' },
  { label: 'Goods Received Note', value: 'grn' },
  { label: 'Delivery Challan', value: 'delivery-challan' },
  { label: 'Journal Voucher', value: 'journal-voucher' },
]

const DOC_PREFIXES: Record<string, string> = {
  'sales-invoice': 'SI',
  'purchase-invoice': 'PI',
  'payment-voucher': 'PV',
  'receipt-voucher': 'RV',
  'credit-note': 'CN',
  'debit-note': 'DN',
  'petty-cash-voucher': 'PC',
  grn: 'GRN',
  'delivery-challan': 'DC',
  'journal-voucher': 'JV',
}

const ITEM_LINE_TYPES = DOC_TYPES.map((t) => t.value).filter(
  (v) => v !== 'journal-voucher',
)

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
  const taxRate = Math.max(0, toNum(d.taxRate))
  const netTotal = round2(net)
  const taxTotal = round2((netTotal * taxRate) / 100)
  d.netTotal = netTotal
  d.taxRate = taxRate
  d.taxTotal = taxTotal
  d.grossTotal = round2(netTotal + taxTotal)
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
): PostingLine[] {
  const type = doc.docType
  const net = toNum(doc.netTotal)
  const tax = toNum(doc.taxTotal)
  const gross = toNum(doc.grossTotal)
  const lines: PostingLine[] = []

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
      if (tax > 0) {
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
      // Expense (net) + Input Tax ← AP (gross)
      lines.push({
        account: resolveAccount(settings, 'expenseAccount', type, 'Purchases / Expense'),
        debit: net,
      })
      if (tax > 0) {
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
      // AP ← Cash / Bank
      lines.push({
        account: resolveAccount(settings, 'payableAccount', type, 'Accounts Payable'),
        debit: gross,
      })
      lines.push({
        account: pickCashOrBank(doc, settings, type),
        credit: gross,
      })
      break
    case 'receipt-voucher':
      // Cash / Bank ← AR
      lines.push({
        account: pickCashOrBank(doc, settings, type),
        debit: gross,
      })
      lines.push({
        account: resolveAccount(settings, 'receivableAccount', type, 'Accounts Receivable'),
        credit: gross,
      })
      break
    case 'credit-note':
      // Sales Returns ← AR
      lines.push({
        account: resolveAccount(settings, 'returnsAccount', type, 'Sales Returns'),
        debit: gross,
      })
      lines.push({
        account: resolveAccount(settings, 'receivableAccount', type, 'Accounts Receivable'),
        credit: gross,
      })
      break
    case 'debit-note':
      // AP ← Purchase Returns
      lines.push({
        account: resolveAccount(settings, 'payableAccount', type, 'Accounts Payable'),
        debit: gross,
      })
      lines.push({
        account: resolveAccount(settings, 'returnsAccount', type, 'Purchase Returns'),
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
    default:
      throw new Error(`Unsupported document type: ${type}`)
  }
  return lines
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
 * Atomically increments the per-type/per-year sequence and returns the
 * formatted voucher number (e.g. SI-2026-0003).
 */
async function nextNumber(
  payload: PayloadRequest['payload'],
  docType: string,
  dateValue: string | Date,
  fiscalYearStart?: string,
): Promise<string> {
  const fy = fiscalYearOf(dateValue, fiscalYearStart)
  const key = `${docType}:${fy}`
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
        const transactionID =
          (await req.payload.db.beginTransaction()) ?? undefined
        try {
          const doc = (await req.payload.findByID({
            collection: 'documents',
            id,
            depth: 0,
          })) as any
          if (!doc) {
            return Response.json({ error: 'Document not found' }, { status: 404 })
          }
          if (doc.status !== 'draft') {
            return Response.json(
              { error: 'Only draft documents can be posted.' },
              { status: 409 },
            )
          }
          const settings = await getSettings(req.payload)
          // Inventory side-effects (movements + COGS) are computed up front so
          // a stock shortfall aborts the whole posting before any write.
          const stockPlan = await computeStockPlan(req.payload, doc)
          const lines = buildPostingLines(doc, settings, stockPlan)
          const narration =
            doc.narration ||
            (DOC_TYPES.find((t) => t.value === doc.docType)?.label ||
              doc.docType)

          const entry = await req.payload.create({
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
            await req.payload.create({
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
            req.payload,
            doc.docType,
            doc.date,
            settings?.fiscalYearStart,
          )

          const updated = await req.payload.update({
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
            await req.payload.db.commitTransaction(transactionID)
          }

          return Response.json({
            doc: updated,
            journalEntry: entry.id,
            number,
            stockMovements: stockPlan.movements.length,
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
          const message =
            ve?.errors?.[0]?.message || raw?.message || 'Posting failed'
          return Response.json({ error: message }, { status: 400 })
        }
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
        const transactionID =
          (await req.payload.db.beginTransaction()) ?? undefined
        try {
          const doc = (await req.payload.findByID({
            collection: 'documents',
            id,
            depth: 0,
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
          })) as any
          if (!entry) {
            return Response.json(
              { error: 'Document has no journal entry — cannot void.' },
              { status: 409 },
            )
          }

          const reversalLines = (entry.lines || []).map((l: any) => ({
            account: accId(l.account),
            debit: toNum(l.credit) || undefined,
            credit: toNum(l.debit) || undefined,
            memo: l.memo || undefined,
          }))

          const reversal = await req.payload.create({
            collection: 'journal-entries',
            data: {
              date: new Date().toISOString().slice(0, 10),
              narration: `Reversal of ${doc.number || doc.id}`,
              status: 'posted',
              lines: reversalLines,
              referenceDoc: doc.id,
              tenant: doc.tenant,
            },
            req: { transactionID },
          })

          // Reverse the document's stock movements so voiding a sale restores
          // stock (and vice versa for a GRN), atomic with the reversal entry.
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
            data: { status: 'void' },
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
            reversalEntry: reversal.id,
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
          const message =
            ve?.errors?.[0]?.message || raw?.message || 'Voiding failed'
          return Response.json({ error: message }, { status: 400 })
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
          side === 'ar' ? ['sales-invoice'] : ['purchase-invoice']
        const negTypes =
          side === 'ar'
            ? ['credit-note', 'receipt-voucher']
            : ['debit-note', 'payment-voucher']

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
          const sign = posTypes.includes(doc.docType) ? 1 : -1
          const amount = round2(sign * toNum(doc.grossTotal))
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

        return Response.json({
          side,
          asOf: asOf.toISOString(),
          rows,
          parties,
          totals,
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
        const key = `${type}:${fy}`
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
      ({ data, operation }) => {
        if (operation !== 'create' && operation !== 'update') return data
        const d = data as any
        if (d.docType === 'journal-voucher') {
          const errors = validateJournalLines(d.journalLines)
          if (errors.length) {
            throw vErr(errors[0] ?? 'Invalid journal lines.')
          }
          return data
        }
        recomputeTotals(d)
        return data
      },
    ],
    beforeChange: [
      ({ data, operation, originalDoc, req }) => {
        const doc = originalDoc as any
        const nextStatus = (data as any)?.status
        const engineFlag = (req as any)?.context?.docStatusTransition

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
        description: 'Assigned automatically when the document is posted.',
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
      name: 'paymentMethod',
      type: 'select',
      options: [
        { label: 'Cash', value: 'cash' },
        { label: 'Bank', value: 'bank' },
      ],
      admin: {
        position: 'sidebar',
        condition: (data) =>
          ['payment-voucher', 'receipt-voucher'].includes(data?.docType),
      },
    },
    {
      name: 'bankAccount',
      type: 'relationship',
      relationTo: 'gl-accounts',
      admin: {
        position: 'sidebar',
        condition: (data) =>
          ['payment-voucher', 'receipt-voucher'].includes(data?.docType),
        description: 'Override the default bank account for this voucher.',
      },
    },
    // Item lines for sales/purchase/stock vouchers.
    {
      name: 'lines',
      type: 'array',
      admin: {
        condition: (data) =>
          Boolean(data?.docType) && data.docType !== 'journal-voucher',
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
        description: 'Tax rate in percent applied to the net total.',
      },
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
