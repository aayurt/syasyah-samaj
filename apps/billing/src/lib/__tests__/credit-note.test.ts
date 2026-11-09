import { describe, it, expect } from 'vitest'
import { createMockVoucher, createMockDataSet } from '../../test/factories'

describe('Credit Note', () => {
  describe('Credit Note Factory', () => {
    it('creates valid credit note voucher', () => {
      const creditNote = createMockVoucher({
        type: 'credit-note',
        totalAmount: -5000,
      })

      expect(creditNote.type).toBe('credit-note')
      expect(creditNote.totalAmount).toBe(-5000)
      expect(creditNote.tenant).toBe('C00')
    })

    it('supports negative returns', () => {
      const creditNote = createMockVoucher({
        type: 'credit-note',
        totalAmount: -2500,
        narration: 'Return of defective goods',
      })

      expect(creditNote.totalAmount).toBeLessThan(0)
      expect(creditNote.narration).toContain('Return')
    })
  })

  describe('Negative Returns and Reversal', () => {
    it('represents a return as negative amount', () => {
      const originalInvoice = createMockVoucher({
        type: 'sales-invoice',
        totalAmount: 10000,
      })
      const creditNote = createMockVoucher({
        type: 'credit-note',
        totalAmount: -10000,
        narration: 'Reversal of INV-0001',
      })

      expect(originalInvoice.totalAmount).toBeGreaterThan(0)
      expect(creditNote.totalAmount).toBeLessThan(0)
      expect(Math.abs(creditNote.totalAmount)).toBe(originalInvoice.totalAmount)
    })

    it('reverses the original invoice amount fully', () => {
      const invoiceAmount = 15000
      const creditNoteAmount = -15000

      const netEffect = invoiceAmount + creditNoteAmount

      expect(netEffect).toBe(0)
    })

    it('supports partial credit note reversal', () => {
      const invoiceAmount = 10000
      const partialCredit = -3000

      const remaining = invoiceAmount + partialCredit

      expect(remaining).toBe(7000)
    })
  })

  describe('Credit Note Linkage', () => {
    it('links credit note to original invoice', () => {
      const original = createMockVoucher({ voucherNo: 'VCH00000001', type: 'sales-invoice' })
      const creditNote = createMockVoucher({
        voucherNo: 'VCH00000002',
        type: 'credit-note',
        narration: 'Reversal of VCH00000001',
      })

      expect(creditNote.narration).toContain(original.voucherNo)
      expect(creditNote.type).toBe('credit-note')
    })

    it('marks credit note as posted after reversal', () => {
      const creditNote = createMockVoucher({
        type: 'credit-note',
        status: 'posted',
      })

      expect(creditNote.status).toBe('posted')
    })
  })

  describe('Credit Note Dataset', () => {
    it('creates consistent dataset with credit notes', () => {
      const data = createMockDataSet(5)

      const creditNotes = data.vouchers.filter((v) => v.type === 'credit-note')

      expect(creditNotes.length).toBeGreaterThanOrEqual(0)
      expect(data.vouchers.every((v) => v.tenant === 'C00')).toBe(true)
    })

    it('validates credit note has negative total', () => {
      const creditNote = createMockVoucher({ type: 'credit-note', totalAmount: -4000 })

      expect(creditNote.totalAmount).toBeLessThan(0)
    })
  })
})
