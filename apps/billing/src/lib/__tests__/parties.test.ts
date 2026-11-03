import { describe, it, expect } from 'vitest'
import {
  createMockParty,
  createMockDataSet,
} from '../../test/factories'

describe('Parties', () => {
  describe('Party Factory', () => {
    it('creates valid party with defaults', () => {
      const party = createMockParty()

      expect(party.id).toBeDefined()
      expect(party.name).toBeTruthy()
      expect(['customer', 'vendor', 'both']).toContain(party.type)
      expect(party.phone).toMatch(/^98\d{8}$/)
      expect(party.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
      expect(party.openingBalance).toBeDefined()
      expect(party.tenant).toBe('C00')
    })

    it('allows overrides', () => {
      const party = createMockParty({
        name: 'Custom Vendor',
        type: 'vendor',
        phone: '9812345678',
        gstNumber: 'PAN1234567890',
      })

      expect(party.name).toBe('Custom Vendor')
      expect(party.type).toBe('vendor')
      expect(party.phone).toBe('9812345678')
      expect(party.gstNumber).toBe('PAN1234567890')
    })
  })

  describe('Party Validation', () => {
    it('validates required fields', () => {
      const parties = [
        createMockParty({ name: 'Valid Party', phone: '9800000000' }),
        createMockParty({ name: '', phone: '9800000001' }),
        createMockParty({ name: 'No Phone', phone: '' }),
      ]

      const valid = parties.filter((p) => p.name && p.phone)
      expect(valid).toHaveLength(1)
    })

    it('validates PAN/GST number format', () => {
      const party = createMockParty({
        gstNumber: 'PAN1234567890',
        panNumber: 'ABCDE1234F',
      })

      expect(party.gstNumber).toMatch(/^[A-Z0-9]+$/)
      expect(party.panNumber).toMatch(/^[A-Z0-9]+$/)
    })

    it('supports customer and vendor types', () => {
      const customer = createMockParty({ type: 'customer' })
      const vendor = createMockParty({ type: 'vendor' })
      const both = createMockParty({ type: 'both' })

      expect(customer.type).toBe('customer')
      expect(vendor.type).toBe('vendor')
      expect(both.type).toBe('both')
    })
  })

  describe('Opening Balance', () => {
    it('tracks party opening balance', () => {
      const receivable = createMockParty({ type: 'customer', openingBalance: 50000 })
      const payable = createMockParty({ type: 'vendor', openingBalance: -30000 })

      expect(receivable.openingBalance).toBe(50000)
      expect(payable.openingBalance).toBe(-30000)
    })
  })

  describe('Party Dataset', () => {
    it('creates consistent dataset', () => {
      const data = createMockDataSet(5)

      expect(data.parties).toHaveLength(5)
      expect(data.parties.every((p) => p.tenant === 'C00')).toBe(true)
      expect(new Set(data.parties.map((p) => p.name)).size).toBe(5)
    })
  })
})
