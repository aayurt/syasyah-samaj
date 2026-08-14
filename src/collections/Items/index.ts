import { isAdmin } from '@/access/admin'
import type { CollectionConfig } from 'payload'
import { toNum } from '@/utilities/journalValidation'
import { computeStockLedger } from '@/utilities/stockValuation'

export const Items: CollectionConfig = {
  slug: 'items',
  admin: {
    useAsTitle: 'name',
    group: 'Billing',
    defaultColumns: ['code', 'name', 'unit', 'openingStock', 'salePrice', 'purchasePrice'],
  },
  access: {
    create: isAdmin,
    read: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  endpoints: [
    {
      // Per-item stock levels: on-hand quantity, weighted-average cost, value,
      // and a reorder flag (below reorderLevel). One summary per item.
      path: '/stock-levels',
      method: 'get',
      handler: async (req) => {
        if (!req.user || !isAdmin({ req })) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const res = await req.payload.find({
          collection: 'items',
          limit: 1000,
          depth: 0,
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
        return Response.json({ docs: levels })
      },
    },
    {
      // Stock ledger for one item: movements with running quantity, running
      // weighted-average cost, and running balance value.
      path: '/:id/ledger',
      method: 'get',
      handler: async (req) => {
        if (!req.user || !isAdmin({ req })) {
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
    // Optional ilaka scoping — metadata only in v1, not enforced.
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      admin: {
        position: 'sidebar',
      },
    },
  ],
}
