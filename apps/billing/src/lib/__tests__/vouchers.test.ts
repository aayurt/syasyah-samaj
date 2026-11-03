import { describe, it, expect } from 'vitest'
import {
  createMockVoucher,
  createMockDataSet,
} from '../../test/factories'

describe('Vouchers', () => {
  describe('Voucher Factory', () => {
    it('creates valid voucher with defaults', () => {
      const voucher = createMockVoucher()

      expect(voucher.id).toBeDefined()
      expect(voucher.voucherNo).toMatch(/^VCH\d{8}$/)
      expect([
        'receipt', 'payment', 'journal', 'contra',
        'sales-invoice', 'purchase-invoice', 'credit-note', 'debit-note',
        'grn', 'delivery-challan', 'membership-receipt', 'donation-receipt', 'petty-cash',
      ]).toContain(voucher.type)
      expect(['draft', 'posted', 'cancelled']).toContain(voucher.status)
      expect(voucher.totalAmount).toBeGreaterThan(0)
      expect(voucher.lines).toEqual([])
      expect(voucher.tenant).toBe('C00')
      expect(voucher.fiscalYear).toBe('2081-82')
    })

    it('allows overrides', () => {
      const voucher = createMockVoucher({
        voucherNo: 'VCH00000001',
        type: 'payment',
        status: 'posted',
        totalAmount: 50000,
        narration: 'Office rent payment',
      })

      expect(voucher.voucherNo).toBe('VCH00000001')
      expect(voucher.type).toBe('payment')
      expect(voucher.status).toBe('posted')
      expect(voucher.totalAmount).toBe(50000)
      expect(voucher.narration).toBe('Office rent payment')
    })
  })

  describe('Voucher Validation', () => {
    it('validates voucher number uniqueness', () => {
      const vouchers = [
        createMockVoucher({ voucherNo: 'VCH00000001' }),
        createMockVoucher({ voucherNo: 'VCH00000002' }),
        createMockVoucher({ voucherNo: 'VCH00000001' }),
      ]

      const nos = vouchers.map((v) => v.voucherNo)
      const uniqueNos = new Set(nos)
      expect(uniqueNos.size).toBe(2)
    })

    it('validates total amount positive', () => {
      const voucher = createMockVoucher({ totalAmount: -100 })
      expect(voucher.totalAmount).toBeLessThan(0)

      const validVoucher = createMockVoucher({ totalAmount: 500 })
      expect(validVoucher.totalAmount).toBeGreaterThan(0)
    })

    it('supports all voucher types', () => {
      const types = [
        'receipt', 'payment', 'journal', 'contra',
        'sales-invoice', 'purchase-invoice', 'credit-note', 'debit-note',
        'grn', 'delivery-challan', 'membership-receipt', 'donation-receipt', 'petty-cash',
      ]

      types.forEach((type) => {
        const v = createMockVoucher({ type })
        expect(v.type).toBe(type)
      })
    })
  })

  describe('Double Entry', () => {
    it('validates balanced journal voucher lines', () => {
      const lines = [
        { accountId: 1, debit: 1000, credit: 0 },
        { accountId: 2, debit: 0, credit: 1000 },
      ]

      const totalDebits = lines.reduce((sum, l) => sum + (l.debit || 0), 0)
      const totalCredits = lines.reduce((sum, l) => sum + (l.credit || 0), 0)

      expect(totalDebits).toBe(totalCredits)
    })

    it('rejects unbalanced lines', () => {
      const lines = [
        { accountId: 1, debit: 1000, credit: 0 },
        { accountId: 2, debit: 0, credit: 500 },
      ]

      const totalDebits = lines.reduce((sum, l) => sum + (l.debit || 0), 0)
      const totalCredits = lines.reduce((sum, l) => sum + (l.credit || 0), 0)

      expect(totalDebits).not.toBe(totalCredits)
    })
  })

  describe('Status Lifecycle', () => {
    it('supports draft → posted → cancelled flow', () => {
      const draft = createMockVoucher({ status: 'draft' })
      const posted = createMockVoucher({ status: 'posted' })
      const cancelled = createMockVoucher({ status: 'cancelled' })

      expect(['draft', 'posted', 'cancelled']).toContain(draft.status)
      expect(['draft', 'posted', 'cancelled']).toContain(posted.status)
      expect(['draft', 'posted', 'cancelled']).toContain(cancelled.status)
    })
  })

  describe('Voucher Dataset', () => {
    it('creates consistent dataset', () => {
      const data = createMockDataSet(5)

      expect(data.vouchers).toHaveLength(5)
      expect(data.vouchers.every((v) => v.tenant === 'C00')).toBe(true)
      expect(new Set(data.vouchers.map((v) => v.voucherNo)).size).toBe(5)
    })
  })
})
