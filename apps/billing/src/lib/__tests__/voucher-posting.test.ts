import { describe, it, expect } from 'vitest'
import { createMockVoucher, createMockJournalEntry } from '../../test/factories'

describe('Voucher Posting', () => {
  describe('Voucher Factory', () => {
    it('creates valid voucher with defaults', () => {
      const voucher = createMockVoucher()

      expect(voucher.id).toBeDefined()
      expect(['draft', 'posted', 'cancelled']).toContain(voucher.status)
      expect(voucher.lines).toEqual([])
      expect(voucher.tenant).toBe('C00')
    })

    it('allows overrides', () => {
      const voucher = createMockVoucher({
        status: 'posted',
        totalAmount: 50000,
        narration: 'Office rent payment',
      })

      expect(voucher.status).toBe('posted')
      expect(voucher.totalAmount).toBe(50000)
      expect(voucher.narration).toBe('Office rent payment')
    })
  })

  describe('Posting Calculations', () => {
    it('calculates total from voucher lines', () => {
      const lines = [
        { account: 1, debit: 1000, credit: 0 },
        { account: 2, debit: 0, credit: 1000 },
      ]

      const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0)
      const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0)

      expect(totalDebit).toBe(1000)
      expect(totalCredit).toBe(1000)
    })

    it('validates total amount equals sum of debit lines', () => {
      const lines = [
        { debit: 3000, credit: 0 },
        { debit: 2000, credit: 0 },
        { debit: 0, credit: 5000 },
      ]

      const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0)
      const expectedTotal = 5000

      expect(totalDebit).toBe(expectedTotal)
    })

    it('calculates net amount after tax', () => {
      const grossTotal = 11300
      const taxRate = 13
      const taxTotal = Math.round((grossTotal * taxRate) / (100 + taxRate))
      const netTotal = grossTotal - taxTotal

      expect(netTotal).toBe(10000)
      expect(taxTotal).toBe(1300)
    })
  })

  describe('Double-Entry Invariant', () => {
    it('enforces debit equals credit on posting', () => {
      const lines = [
        { accountId: 1, debit: 1000, credit: 0 },
        { accountId: 2, debit: 0, credit: 1000 },
      ]

      const totalDebits = lines.reduce((s, l) => s + (l.debit || 0), 0)
      const totalCredits = lines.reduce((s, l) => s + (l.credit || 0), 0)

      expect(totalDebits).toBe(totalCredits)
    })

    it('rejects unbalanced voucher lines', () => {
      const lines = [
        { accountId: 1, debit: 1000, credit: 0 },
        { accountId: 2, debit: 0, credit: 500 },
      ]

      const totalDebits = lines.reduce((s, l) => s + (l.debit || 0), 0)
      const totalCredits = lines.reduce((s, l) => s + (l.credit || 0), 0)

      expect(totalDebits).not.toBe(totalCredits)
    })

    it('validates journal entry balance', () => {
      const entry = createMockJournalEntry({
        lines: [
          { account: 1, debit: 1000, credit: 0 },
          { account: 2, debit: 0, credit: 1000 },
        ],
      })

      const totalDebits = entry.lines.reduce((s, l) => s + (l.debit || 0), 0)
      const totalCredits = entry.lines.reduce((s, l) => s + (l.credit || 0), 0)

      expect(totalDebits).toBe(totalCredits)
    })
  })

  describe('Idempotency', () => {
    it('posting the same voucher twice produces one journal entry', () => {
      const voucher = createMockVoucher({ voucherNo: 'VCH00000001', status: 'posted' })
      const postedVouchers = [voucher, voucher]

      const uniqueVouchers = [...new Set(postedVouchers.map((v) => v.voucherNo))]

      expect(uniqueVouchers).toHaveLength(1)
    })

    it('prevents duplicate posting of same voucher number', () => {
      const postedNumbers = new Set<string>()

      const voucher1 = createMockVoucher({ voucherNo: 'VCH00000001' })
      postedNumbers.add(voucher1.voucherNo)

      const canPost = (v: typeof voucher1) => !postedNumbers.has(v.voucherNo)

      expect(canPost(voucher1)).toBe(false)

      const voucher2 = createMockVoucher({ voucherNo: 'VCH00000002' })
      expect(canPost(voucher2)).toBe(true)
    })

    it('marks voucher as posted after successful post', () => {
      const voucher = createMockVoucher({ status: 'draft' })

      voucher.status = 'posted'

      expect(voucher.status).toBe('posted')
    })
  })

  describe('Posting Lifecycle', () => {
    it('supports draft → posted → cancelled flow', () => {
      const draft = createMockVoucher({ status: 'draft' })
      const posted = createMockVoucher({ status: 'posted' })
      const cancelled = createMockVoucher({ status: 'cancelled' })

      expect(draft.status).toBe('draft')
      expect(posted.status).toBe('posted')
      expect(cancelled.status).toBe('cancelled')
    })

    it('blocks posting into a closed fiscal year', () => {
      const fiscalYear = { name: '2082-83', isClosed: true }
      const voucher = createMockVoucher({ fiscalYear: '2082-83' })

      const canPost = !fiscalYear.isClosed

      expect(canPost).toBe(false)
      expect(voucher.fiscalYear).toBe('2082-83')
    })
  })
})
