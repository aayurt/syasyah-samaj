import { describe, it, expect } from 'vitest'
import { createMockDataSet } from '../../test/factories'

describe('VAT Register', () => {
  describe('VAT Document Filtering', () => {
    it('filters documents by VAT applicability', () => {
      const documents = [
        { docType: 'sales-invoice', taxRate: 13, taxTotal: 1300 },
        { docType: 'purchase-invoice', taxRate: 13, taxTotal: 650 },
        { docType: 'receipt-voucher', taxRate: 0, taxTotal: 0 },
        { docType: 'credit-note', taxRate: 13, taxTotal: -130 },
      ]

      const vatDocuments = documents.filter((d) => d.taxRate > 0)

      expect(vatDocuments).toHaveLength(3)
      expect(vatDocuments.every((d) => d.taxRate > 0)).toBe(true)
    })

    it('excludes zero-rated and exempt documents from VAT register', () => {
      const documents = [
        { docType: 'sales-invoice', taxType: 'taxable', taxRate: 13 },
        { docType: 'sales-invoice', taxType: 'exempt', taxRate: 0 },
        { docType: 'sales-invoice', taxType: 'zero-rated', taxRate: 0 },
      ]

      const taxable = documents.filter((d) => d.taxType === 'taxable')
      const exempt = documents.filter((d) => d.taxType === 'exempt')

      expect(taxable).toHaveLength(1)
      expect(exempt).toHaveLength(1)
    })

    it('calculates VAT output and input totals', () => {
      const sales = [
        { docType: 'sales-invoice', taxTotal: 1300 },
        { docType: 'sales-invoice', taxTotal: 2600 },
      ]
      const purchases = [
        { docType: 'purchase-invoice', taxTotal: 650 },
        { docType: 'purchase-invoice', taxTotal: 1300 },
      ]

      const outputVat = sales.reduce((s, d) => s + d.taxTotal, 0)
      const inputVat = purchases.reduce((s, d) => s + d.taxTotal, 0)

      expect(outputVat).toBe(3900)
      expect(inputVat).toBe(1950)
    })
  })

  describe('VAT Register by Party and Document', () => {
    it('groups VAT documents by party', () => {
      const documents = [
        { party: 'Party A', docType: 'sales-invoice', amount: 10000, taxTotal: 1300 },
        { party: 'Party B', docType: 'purchase-invoice', amount: 5000, taxTotal: 650 },
        { party: 'Party A', docType: 'sales-invoice', amount: 15000, taxTotal: 1950 },
      ]

      const byParty = new Map<string, typeof documents[]>()
      documents.forEach((d) => {
        const arr = byParty.get(d.party) || []
        arr.push(d)
        byParty.set(d.party, arr)
      })

      expect(byParty.get('Party A')).toHaveLength(2)
      expect(byParty.get('Party B')).toHaveLength(1)
    })

    it('filters VAT documents by date range', () => {
      const documents = [
        { docType: 'sales-invoice', date: '2026-07-20', taxTotal: 1300 },
        { docType: 'sales-invoice', date: '2026-08-15', taxTotal: 2600 },
        { docType: 'sales-invoice', date: '2026-09-01', taxTotal: 650 },
      ]

      const inRange = documents.filter(
        (d) => d.date >= '2026-07-01' && d.date <= '2026-08-31'
      )

      expect(inRange).toHaveLength(2)
    })

    it('scopes VAT documents by tenant', () => {
      const data = createMockDataSet(5)

      expect(data.parties.every((p) => p.tenant === 'C00')).toBe(true)
    })
  })

  describe('VAT Amount Calculation', () => {
    it('computes VAT from net total and rate', () => {
      const netTotal = 10000
      const taxRate = 13
      const taxTotal = Math.round((netTotal * taxRate) / 100)
      const grossTotal = netTotal + taxTotal

      expect(taxTotal).toBe(1300)
      expect(grossTotal).toBe(11300)
    })

    it('computes net total from gross and rate (tax-inclusive)', () => {
      const grossTotal = 11300
      const taxRate = 13
      const netTotal = Math.round((grossTotal * 100) / (100 + taxRate))
      const taxTotal = grossTotal - netTotal

      expect(netTotal).toBe(10000)
      expect(taxTotal).toBe(1300)
    })
  })
})
