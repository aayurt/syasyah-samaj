import {
  isBillingUser,
  resolveScopedTenant,
  scopedCreate,
  scopedDelete,
  scopedRead,
  scopedUpdate,
} from '@/access/tenantScoped'
import type { CollectionConfig } from 'payload'
import { round2, toNum } from '@/utilities/journalValidation'
import { computeStockLedger } from '@/utilities/stockValuation'
import { assignTenant } from '@/utilities/tenantScope'
import { paginate, parsePagination } from '@/utilities/pagination'

export const Items: CollectionConfig = {
  slug: 'items',
  admin: {
    useAsTitle: 'name',
    group: 'Billing',
    defaultColumns: ['code', 'name', 'unit', 'openingStock', 'salePrice', 'purchasePrice'],
  },
  access: {
    create: scopedCreate,
    read: scopedRead,
    update: scopedUpdate,
    delete: scopedDelete,
  },
  endpoints: [
    {
      // Per-item stock levels: on-hand quantity, weighted-average cost, value,
      // and a reorder flag (below reorderLevel). One summary per item.
      path: '/stock-levels',
      method: 'get',
      handler: async (req) => {
        if (!req.user || !isBillingUser(req.user)) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const { searchParams } = new URL(req.url || '/')
        const tenant = resolveScopedTenant(req, searchParams.get('tenant'))
        const res = await req.payload.find({
          collection: 'items',
          limit: 1000,
          depth: 0,
          where: tenant ? { tenant: { equals: tenant } } : undefined,
        })
        const levels: any[] = []
        for (const item of res.docs as any[]) {
          const ledger = await computeStockLedger(req.payload, item)
          const last = ledger[ledger.length - 1]
          const onHand = last?.qtyOnHand ?? 0
          const avgCost = last?.avgCost ?? 0
          levels.push({
            item: { id: item.id, code: item.code, name: item.name, unit: item.unit },
            onHand,
            avgCost,
            value: onHand * avgCost,
            belowReorder:
              Number(item.reorderLevel) > 0 && onHand < Number(item.reorderLevel),
          })
        }
        const page = paginate(levels, parsePagination(searchParams))
        return Response.json({
          docs: page.docs,
          total: page.total,
          hasMore: page.hasMore,
          limit: parsePagination(searchParams).limit,
          offset: parsePagination(searchParams).offset,
        })
      },
    },
    {
      // Valuation summary per item: opening and closing quantity+value,
      // receipts and issues (quantity+value) inside the period, weighted-
      // average cost, and a reorder flag. One summary per item.
      path: '/valuation',
      method: 'get',
      handler: async (req) => {
        if (!req.user || !isBillingUser(req.user)) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const { searchParams } = new URL(req.url || '/')
        const tenant = resolveScopedTenant(req, searchParams.get('tenant'))
        const from = searchParams.get('from') || ''
        const to = searchParams.get('to') || ''
        const res = await req.payload.find({
          collection: 'items',
          limit: 1000,
          depth: 0,
          where: tenant ? { tenant: { equals: tenant } } : undefined,
        })
        const docs: any[] = []
        for (const item of res.docs as any[]) {
          const ledger = await computeStockLedger(req.payload, item)
          const last = ledger[ledger.length - 1]
          const onHand = last?.qtyOnHand ?? 0
          const avgCost = last?.avgCost ?? 0
          let receiptsQty = 0
          let receiptsValue = 0
          let issuesQty = 0
          let issuesValue = 0
          for (const r of ledger.slice(1)) {
            if (from && (r.date || '') < from) continue
            if (to && (r.date || '') > to + 'T23:59:59') continue
            if (r.qtyIn > 0) {
              receiptsQty += r.qtyIn
              receiptsValue += r.qtyIn * r.unitCost
            } else if (r.qtyOut > 0) {
              issuesQty += r.qtyOut
              issuesValue += r.qtyOut * r.unitCost
            }
          }
          const openingQty =
            from && ledger.length > 0
              ? (ledger[0]?.qtyOnHand ?? 0)
              : (toNum(item.openingStock) || 0)
          const openingRow = ledger[0]
          docs.push({
            item: { id: item.id, code: item.code, name: item.name, unit: item.unit },
            valuationMethod: item.valuationMethod || 'avco',
            openingQty,
            openingValue: openingRow?.balanceValue ?? 0,
            receiptsQty: round2(receiptsQty),
            receiptsValue: round2(receiptsValue),
            issuesQty: round2(issuesQty),
            issuesValue: round2(issuesValue),
            closingQty: onHand,
            closingValue: last ? last.balanceValue : 0,
            avgCost,
            belowReorder:
              Number(item.reorderLevel) > 0 && onHand < Number(item.reorderLevel),
          })
        }
        const page = paginate(docs, parsePagination(searchParams))
        return Response.json({
          docs: page.docs,
          total: page.total,
          hasMore: page.hasMore,
          limit: parsePagination(searchParams).limit,
          offset: parsePagination(searchParams).offset,
        })
      },
    },
    {
      // Stock ledger for one item: movements with running quantity, running
      // weighted-average cost, and running balance value.
      path: '/:id/ledger',
      method: 'get',
      handler: async (req) => {
        if (!req.user || !isBillingUser(req.user)) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const id = req.routeParams?.id as string
        if (!id) {
          return Response.json({ error: 'Missing item id' }, { status: 400 })
        }
        const item = (await req.payload.findByID({
          collection: 'items',
          id,
          depth: 0,
        })) as any
        if (!item) {
          return Response.json({ error: 'Item not found' }, { status: 404 })
        }
        const rows = await computeStockLedger(req.payload, item)
        const last = rows[rows.length - 1]
        return Response.json({
          item: {
            id: item.id,
            code: item.code,
            name: item.name,
            unit: item.unit,
            valuationMethod: item.valuationMethod,
          },
          rows,
          closing: {
            onHand: last?.qtyOnHand ?? 0,
            avgCost: last?.avgCost ?? 0,
            value: last ? last.qtyOnHand * last.avgCost : 0,
          },
        })
      },
    },
  ],
  hooks: {
    beforeValidate: [
      assignTenant,
      ({ data }) => {
        const d = data as any
        const opening = toNum(d.openingStock)
        if (opening < 0) {
          throw new Error('Opening stock cannot be negative.')
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'code',
      type: 'text',
      admin: {
        description: 'SKU / item code.',
      },
    },
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'unit',
      type: 'text',
      admin: {
        description: 'Unit of measure (pc, kg, box, litre…).',
      },
    },
    {
      name: 'valuationMethod',
      type: 'select',
      defaultValue: 'avco',
      required: true,
      options: [
        { label: 'AVCO (weighted average)', value: 'avco' },
        { label: 'FIFO (planned)', value: 'fifo' },
      ],
      admin: {
        position: 'sidebar',
        description: 'AVCO is implemented; FIFO is planned.',
      },
    },
    {
      name: 'reorderLevel',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Alert when on-hand stock drops below this.',
      },
    },
    {
      name: 'openingStock',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Starting quantity. Valued at the purchase price.',
        position: 'sidebar',
      },
    },
    {
      name: 'salePrice',
      type: 'number',
      admin: {
        description: 'Default selling price.',
      },
    },
    {
      name: 'purchasePrice',
      type: 'number',
      admin: {
        description: 'Default purchase cost — also values the opening stock.',
      },
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
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
