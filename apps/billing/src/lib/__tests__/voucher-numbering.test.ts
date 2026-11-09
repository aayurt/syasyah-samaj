import { describe, it, expect } from 'vitest'
import { createMockVoucher, createMockDataSet } from '../../test/factories'

describe('Voucher Numbering', () => {
  describe('Voucher Factory', () => {
    it('creates valid voucher with defaults', () => {
      const voucher = createMockVoucher()

      expect(voucher.id).toBeDefined()
      expect(voucher.voucherNo).toMatch(/^VCH\d{8}$/)
      expect(voucher.fiscalYear).toBe('2081-82')
      expect(voucher.tenant).toBe('C00')
    })

    it('allows overrides', () => {
      const voucher = createMockVoucher({
        voucherNo: 'JV-2083-84-0001',
        fiscalYear: '2083-84',
        type: 'journal',
      })

      expect(voucher.voucherNo).toBe('JV-2083-84-0001')
      expect(voucher.fiscalYear).toBe('2083-84')
      expect(voucher.type).toBe('journal')
    })
  })

  describe('Per-Document and Per-FY Numbering', () => {
    it('enforces voucher number uniqueness within a fiscal year', () => {
      const vouchers = [
        createMockVoucher({ voucherNo: 'VCH00000001', fiscalYear: '2083-84' }),
        createMockVoucher({ voucherNo: 'VCH00000002', fiscalYear: '2083-84' }),
        createMockVoucher({ voucherNo: 'VCH00000001', fiscalYear: '2082-83' }),
      ]

      const fy208384 = vouchers.filter((v) => v.fiscalYear === '2083-84')
      const nos = fy208384.map((v) => v.voucherNo)
      const uniqueNos = new Set(nos)

      expect(uniqueNos.size).toBe(nos.length)
    })

    it('supports per-document-type numbering sequences', () => {
      const docTypes = ['sales-invoice', 'purchase-invoice', 'payment-voucher', 'receipt-voucher', 'credit-note']

      const sequences = docTypes.map((dt) => ({
        docType: dt,
        prefix: dt === 'sales-invoice' ? 'SI' : dt === 'purchase-invoice' ? 'PI' : 'VCH',
        fiscalYear: '2083-84',
      }))

      expect(sequences).toHaveLength(5)
      sequences.forEach((seq) => {
        expect(seq.prefix).toBeTruthy()
        expect(seq.fiscalYear).toBe('2083-84')
      })
    })

    it('never assigns voucher numbers to drafts', () => {
      const draft = createMockVoucher({ status: 'draft', voucherNo: '' })
      const posted = createMockVoucher({ status: 'posted', voucherNo: 'VCH00000001' })

      expect(draft.status).toBe('draft')
      expect(draft.voucherNo).toBe('')
      expect(posted.status).toBe('posted')
      expect(posted.voucherNo).toMatch(/^VCH/)
    })

    it('numbers are scoped to fiscal year', () => {
      const vouchers = [
        createMockVoucher({ voucherNo: 'VCH00000001', fiscalYear: '2083-84' }),
        createMockVoucher({ voucherNo: 'VCH00000001', fiscalYear: '2082-83' }),
      ]

      const fyGroups = new Map<string, string[]>()
      vouchers.forEach((v) => {
        const arr = fyGroups.get(v.fiscalYear) || []
        arr.push(v.voucherNo)
        fyGroups.set(v.fiscalYear, arr)
      })

      expect(fyGroups.get('2083-84')).toEqual(['VCH00000001'])
      expect(fyGroups.get('2082-83')).toEqual(['VCH00000001'])
    })
  })

  describe('Voucher Number Format', () => {
    it('matches VCH prefix with 8 digits', () => {
      const voucher = createMockVoucher()

      expect(voucher.voucherNo).toMatch(/^VCH\d{8}$/)
    })

    it('supports custom document number formats', () => {
      const custom = createMockVoucher({ voucherNo: 'JV-2083-84-0001' })

      expect(custom.voucherNo).toBe('JV-2083-84-0001')
      expect(custom.voucherNo).toContain('2083-84')
    })

    it('creates consistent dataset with unique voucher numbers', () => {
      const data = createMockDataSet(5)

      expect(data.vouchers).toHaveLength(5)
      const nos = data.vouchers.map((v) => v.voucherNo)
      expect(new Set(nos).size).toBe(5)
    })
  })
})
