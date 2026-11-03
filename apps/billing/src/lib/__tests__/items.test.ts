import { describe, it, expect } from 'vitest'
import {
  createMockItem,
  createMockDataSet,
} from '../../test/factories'

describe('Items', () => {
  describe('Item Factory', () => {
    it('creates valid item with defaults', () => {
      const item = createMockItem()

      expect(item.id).toBeDefined()
      expect(item.code).toMatch(/^ITM\d{4}$/)
      expect(item.name).toBeTruthy()
      expect(item.description).toBeTruthy()
      expect(['PCS', 'KG', 'MTR', 'LTR', 'BOX', 'PKT']).toContain(item.unit)
      expect(item.rate).toBeGreaterThan(0)
      expect(['taxable', 'exempt', 'zero-rated']).toContain(item.taxType)
      expect(item.taxRate).toBe(13)
      expect(item.hsnCode).toMatch(/^\d{8}$/)
      expect(item.tenant).toBe('C00')
    })

    it('allows overrides', () => {
      const item = createMockItem({
        code: 'ITM9999',
        name: 'Custom Item',
        unit: 'KG',
        rate: 500.5,
        taxType: 'exempt',
        taxRate: 0,
      })

      expect(item.code).toBe('ITM9999')
      expect(item.name).toBe('Custom Item')
      expect(item.unit).toBe('KG')
      expect(item.rate).toBe(500.5)
      expect(item.taxType).toBe('exempt')
      expect(item.taxRate).toBe(0)
    })
  })

  describe('Item Validation', () => {
    it('validates required fields', () => {
      const items = [
        createMockItem({ name: 'Valid Item', rate: 100 }),
        createMockItem({ name: '', rate: 200 }),
        createMockItem({ name: 'No Rate', rate: 0 }),
      ]

      const valid = items.filter((i) => i.name && i.rate > 0)
      expect(valid).toHaveLength(1)
    })

    it('validates HSN code format', () => {
      const validHsn = ['00000001', '12345678', '99999999']
      const invalidHsn = ['12345', 'ABCDEFGH', '123456789']

      validHsn.forEach((h) => expect(h.match(/^\d{8}$/)).toBeTruthy())
      invalidHsn.forEach((h) => expect(h.match(/^\d{8}$/)).toBeNull())
    })

    it('calculates tax amount correctly', () => {
      const taxable = createMockItem({ rate: 1000, taxRate: 13 })
      const exempt = createMockItem({ rate: 1000, taxType: 'exempt', taxRate: 0 })
      const zeroRated = createMockItem({ rate: 1000, taxType: 'zero-rated', taxRate: 0 })

      const taxableTax = (taxable.rate * taxable.taxRate) / 100
      expect(taxableTax).toBe(130)

      const exemptTax = (exempt.rate * exempt.taxRate) / 100
      expect(exemptTax).toBe(0)

      const zeroRatedTax = (zeroRated.rate * zeroRated.taxRate) / 100
      expect(zeroRatedTax).toBe(0)
    })
  })

  describe('Pricing', () => {
    it('calculates line total', () => {
      const item = createMockItem({ rate: 250.75 })
      const quantity = 10

      const total = item.rate * quantity
      expect(total).toBe(2507.5)
    })

    it('applies quantity discount logic', () => {
      const rate = 100
      const qty = 5
      const discountPct = 10

      const subtotal = rate * qty
      const discount = (subtotal * discountPct) / 100
      const finalTotal = subtotal - discount

      expect(subtotal).toBe(500)
      expect(discount).toBe(50)
      expect(finalTotal).toBe(450)
    })
  })

  describe('Item Dataset', () => {
    it('creates consistent dataset', () => {
      const data = createMockDataSet(5)

      expect(data.items).toHaveLength(5)
      expect(data.items.every((i) => i.tenant === 'C00')).toBe(true)
      expect(new Set(data.items.map((i) => i.code)).size).toBe(5)
    })
  })
})
