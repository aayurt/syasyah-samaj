import { describe, it, expect, vi } from 'vitest'
import {
  buildCoaExcel,
  parseCoaExcel,
  buildJournalExcel,
  parseJournalExcel,
  buildOpeningBalancesExcel,
  parseOpeningBalancesExcel,
  validateImportRows
} from '../../src/lib/importExport'

vi.mock('../../src/lib/api', () => ({
  api: vi.fn(),
}))

describe('Chart of Accounts Excel Round-Trip', () => {
  it('preserves group hierarchy', async () => {
    const originalDocs = [
      { code: '101', name: 'Cash', type: 'asset', class: 'Current', group: 'Assets', openingBalance: 1000, openingBalanceType: 'Dr' },
      { code: '201', name: 'Loan', type: 'liability', class: 'Non-Current', group: 'Liabilities', openingBalance: 2000, openingBalanceType: 'Cr' }
    ]

    const excelBlob = await buildCoaExcel(originalDocs)
    const file = new File([excelBlob], 'coa.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const parsed = await parseCoaExcel(file)
    const docs = parsed.docs as any[]

    expect(docs.length).toBeGreaterThan(0)

    const cash = docs.find(d => String(d.code) === '101')
    expect(cash).toBeDefined()
    expect(cash.group).toBe('Assets')

    const loan = docs.find(d => String(d.code) === '201')
    expect(loan).toBeDefined()
    expect(loan.group).toBe('Liabilities')
  })
})

describe('Journal/Voucher Excel Round-Trip', () => {
  it('balanced vouchers pass, unbalanced rejected', async () => {
    const validDocs = [
      { voucherNo: 'V-001', date: '2024-01-01', type: 'Journal', narration: 'Test 1', fy: '80/81', account: 'Cash', debit: 100, credit: 0 },
      { voucherNo: 'V-001', date: '2024-01-01', type: 'Journal', narration: 'Test 1', fy: '80/81', account: 'Sales', debit: 0, credit: 100 }
    ]

    const excelBlob = await buildJournalExcel(validDocs)
    const file = new File([excelBlob], 'journals.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const parsed = await parseJournalExcel(file)
    const docs = parsed.docs as any[]

    expect(docs.length).toBe(2)

    const validateDocs = [
      { voucherNo: 'V-002', date: '2024-01-01', account: 'Cash', debit: 100, credit: 0 },
      { voucherNo: 'V-002', date: '2024-01-01', account: 'Sales', debit: 0, credit: 50 }
    ]

    const { errors } = validateImportRows(validateDocs, 'journal-entries')
    expect(errors.length).toBeGreaterThan(0)
    // Check that validation errors include row numbers as requested in acceptance criteria
    expect(errors[0].row).toBeDefined()
    expect(errors[0].row).toBeGreaterThan(0)
  })
})

describe('Opening Balances Round-Trip', () => {
  it('round trips and calculates balance', async () => {
    const originalDocs = [
      { accountCode: '100', accountName: 'Cash', debitOpening: 1000, creditOpening: 0 },
      { accountCode: '200', accountName: 'Loan', debitOpening: 0, creditOpening: 1000 }
    ]

    const excelBlob = await buildOpeningBalancesExcel(originalDocs)
    const file = new File([excelBlob], 'ob.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const parsed = await parseOpeningBalancesExcel(file)
    const docs = parsed.docs as any[]

    expect(docs.length).toBe(3) // 2 rows + 1 total

    const cash = docs.find(d => d['Account Code'] === '100' || d.accountCode === '100')
    expect(cash).toBeDefined()
    expect(cash._balanced).toBe(false)

    const sum = docs.find(d => d.accountCode === 'TOTAL')
    expect(sum).toBeDefined()
    expect(sum.isBalanced).toBe('✓')
  })
})
