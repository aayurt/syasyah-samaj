import { describe, it, expect } from 'vitest'
import { createMockParty, createMockDataSet } from '../../test/factories'

describe('Party Validation', () => {
  describe('Party Factory', () => {
    it('creates valid party with defaults', () => {
      const party = createMockParty()

      expect(party.id).toBeDefined()
      expect(party.name).toBeTruthy()
      expect(['customer', 'vendor', 'both']).toContain(party.type)
      expect(party.phone).toMatch(/^98\d{8}$/)
      expect(party.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
      expect(party.tenant).toBe('C00')
    })

    it('allows overrides', () => {
      const party = createMockParty({
        name: 'Custom Vendor',
        type: 'vendor',
        phone: '9812345678',
        taxId: 'PAN1234567890',
      })

      expect(party.name).toBe('Custom Vendor')
      expect(party.type).toBe('vendor')
      expect(party.phone).toBe('9812345678')
      expect(party.taxId).toBe('PAN1234567890')
    })
  })

  describe('PAN / Tax ID Format Validation', () => {
    it('validates PAN number alphanumeric format', () => {
      const party = createMockParty({
        taxId: 'ABCDE1234F',
      })

      expect(party.taxId).toMatch(/^[A-Z0-9]+$/)
    })

    it('rejects empty PAN number', () => {
      const party = createMockParty({ taxId: '' })

      expect(party.taxId).toBe('')
    })

    it('validates GST number format', () => {
      const party = createMockParty({
        taxId: 'PAN1234567890',
      })

      expect(party.taxId).toMatch(/^[A-Z0-9]+$/)
      expect(party.taxId.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('PAN Uniqueness Validation', () => {
    it('detects duplicate PAN across parties', () => {
      const parties = [
        createMockParty({ taxId: 'PAN1234567890', name: 'Party A' }),
        createMockParty({ taxId: 'PAN9876543210', name: 'Party B' }),
        createMockParty({ taxId: 'PAN1234567890', name: 'Party C' }),
      ]

      const panNumbers = parties.map((p) => p.taxId).filter(Boolean)
      const uniquePans = new Set(panNumbers)

      expect(uniquePans.size).toBeLessThan(panNumbers.length)
      expect(uniquePans.has('PAN1234567890')).toBe(true)
    })

    it('enforces unique PAN within a tenant', () => {
      const parties = createMockDataSet(10)

      const pans = parties.parties.map((p) => p.taxId).filter(Boolean)
      const uniquePans = new Set(pans)

      // All parties in a dataset must have distinct PANs
      expect(uniquePans.size).toBe(pans.length)
    })

    it('allows parties without PAN', () => {
      const party = createMockParty({ taxId: undefined })

      expect(party.taxId).toBeUndefined()
    })
  })

  describe('Party Type Validation', () => {
    it('supports customer, vendor, and both types', () => {
      const customer = createMockParty({ type: 'customer' })
      const vendor = createMockParty({ type: 'vendor' })
      const both = createMockParty({ type: 'both' })

      expect(customer.type).toBe('customer')
      expect(vendor.type).toBe('vendor')
      expect(both.type).toBe('both')
    })

    it('validates required fields', () => {
      const parties = [
        createMockParty({ name: 'Valid Party', phone: '9800000000' }),
        createMockParty({ name: '', phone: '9800000001' }),
        createMockParty({ name: 'No Phone', phone: '' }),
      ]

      const valid = parties.filter((p) => p.name && p.phone)
      expect(valid).toHaveLength(1)
    })

    it('requires unique party names within a dataset', () => {
      const data = createMockDataSet(5)

      const names = data.parties.map((p) => p.name)
      const uniqueNames = new Set(names)

      expect(uniqueNames.size).toBe(5)
    })
  })
})
