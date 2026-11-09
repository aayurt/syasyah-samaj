import { describe, it, expect } from 'vitest'
import { createMockItem, createMockDataSet } from '../../test/factories'

describe('Inventory Ledger', () => {
  describe('Item Factory', () => {
    it('creates valid item with defaults', () => {
      const item = createMockItem()

      expect(item.id).toBeDefined()
      expect(item.code).toMatch(/^ITM\d{4}$/)
      expect(item.name).toBeTruthy()
      expect(['PCS', 'KG', 'MTR', 'LTR', 'BOX', 'PKT']).toContain(item.unit)
      expect(['taxable', 'exempt', 'zero-rated']).toContain(item.taxType)
      expect(item.tenant).toBe('C00')
    })

    it('allows overrides', () => {
      const item = createMockItem({
        code: 'ITM0001',
        name: 'Rice Bag',
        unit: 'KG',
        rate: 1200,
        openingStock: 100,
      })

      expect(item.code).toBe('ITM0001')
      expect(item.name).toBe('Rice Bag')
      expect(item.unit).toBe('KG')
      expect(item.rate).toBe(1200)
      expect(item.openingStock).toBe(100)
    })
  })

  describe('Stock Movement and Valuation', () => {
    it('calculates on-hand quantity from movements', () => {
      const movements = [
        { item: 1, qtyIn: 100, qtyOut: 0 },
        { item: 1, qtyIn: 50, qtyOut: 0 },
        { item: 1, qtyIn: 0, qtyOut: 30 },
      ]

      const qtyIn = movements.reduce((s, m) => s + (m.qtyIn || 0), 0)
      const qtyOut = movements.reduce((s, m) => s + (m.qtyOut || 0), 0)
      const onHand = qtyIn - qtyOut

      expect(onHand).toBe(120)
    })

    it('tracks running balance after each movement', () => {
      const movements = [
        { qtyIn: 100, qtyOut: 0, runningBalance: 100 },
        { qtyIn: 50, qtyOut: 0, runningBalance: 150 },
        { qtyIn: 0, qtyOut: 30, runningBalance: 120 },
      ]

      let balance = 0
      movements.forEach((m) => {
        balance = balance + (m.qtyIn || 0) - (m.qtyOut || 0)
        expect(balance).toBe(m.runningBalance)
      })
    })

    it('calculates inventory value from on-hand and unit cost', () => {
      const onHand = 120
      const unitCost = 1000

      const value = onHand * unitCost

      expect(value).toBe(120000)
    })

    it('computes average cost after multiple purchases', () => {
      const purchases = [
        { qty: 100, unitCost: 1000 },
        { qty: 50, unitCost: 1100 },
      ]

      const totalQty = purchases.reduce((s, p) => s + p.qty, 0)
      const totalCost = purchases.reduce((s, p) => s + p.qty * p.unitCost, 0)
      const avgCost = totalCost / totalQty

      expect(totalQty).toBe(150)
      expect(avgCost).toBe(1033.3333333333333)
    })
  })

  describe('Stock Level and Reorder', () => {
    it('computes stock value per item', () => {
      const item = createMockItem({ openingStock: 100, purchasePrice: 500 })

      const value = (item.openingStock || 0) * (item.purchasePrice || 0)

      expect(value).toBe(50000)
    })

    it('flags items below reorder level', () => {
      const item = createMockItem({ onHand: 5, reorderLevel: 20 })

      const belowReorder = (item.onHand || 0) < (item.reorderLevel || 0)

      expect(belowReorder).toBe(true)
    })

    it('scopes items by tenant', () => {
      const data = createMockDataSet(5)

      expect(data.items.every((i) => i.tenant === 'C00')).toBe(true)
    })
  })

  describe('Inventory Dataset', () => {
    it('creates consistent item dataset', () => {
      const data = createMockDataSet(5)

      expect(data.items).toHaveLength(5)
      const codes = data.items.map((i) => i.code)
      expect(new Set(codes).size).toBe(5)
    })
  })
})
