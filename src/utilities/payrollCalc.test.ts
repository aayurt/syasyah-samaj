import {
  buildPayrollLines,
  buildPayrollJournalLines,
  summarizePayroll,
} from './payrollCalc'

const employee = (over: Record<string, unknown> = {}) => ({
  id: 1,
  employeeId: 'EMP-001',
  name: 'Aama Gurung',
  active: true,
  basicSalary: 30000,
  allowances: [
    { label: 'House allowance', amount: 5000 },
    { label: 'Transport allowance', amount: 2000 },
  ],
  deductions: [
    { label: 'Provident Fund', amount: 3000, account: 55 },
    { label: 'TDS', amount: 1500, account: 56 },
  ],
  ...over,
})

describe('buildPayrollLines', () => {
  it('computes gross and net per employee', () => {
    const lines = buildPayrollLines([employee()])
    expect(lines).toHaveLength(1)
    const line = lines[0]!
    expect(line.empCode).toBe('EMP-001')
    expect(line.name).toBe('Aama Gurung')
    expect(line.basic).toBe(30000)
    expect(line.gross).toBe(37000) // 30000 + 5000 + 2000
    expect(line.net).toBe(32500) // 37000 - 3000 - 1500
  })

  it('skips inactive employees', () => {
    const lines = buildPayrollLines([
      employee(),
      employee({ id: 2, employeeId: 'EMP-002', name: 'Inactive', active: false }),
    ])
    expect(lines).toHaveLength(1)
    expect(lines[0]!.empCode).toBe('EMP-001')
  })

  it('rounds money to 2 decimals and treats junk as zero', () => {
    const lines = buildPayrollLines([
      employee({
        basicSalary: 1000.335,
        allowances: [{ label: 'Allow', amount: 'not-a-number' as unknown as number }],
        deductions: [{ label: 'PF', amount: 100.005 }],
      }),
    ])
    const line = lines[0]!
    expect(line.basic).toBe(1000.34)
    expect(line.gross).toBe(1000.34)
    expect(line.net).toBe(900.33) // 1000.34 − round2(100.005) = 1000.34 − 100.01
  })

  it('handles an employee with no allowances or deductions', () => {
    const lines = buildPayrollLines([employee({ allowances: [], deductions: [] })])
    const line = lines[0]!
    expect(line.gross).toBe(30000)
    expect(line.net).toBe(30000)
  })
})

describe('summarizePayroll', () => {
  it('sums gross, deductions and net across lines, rounded to 2dp', () => {
    const lines = buildPayrollLines([
      employee(),
      employee({ id: 2, employeeId: 'EMP-002', allowances: [], deductions: [] }),
    ])
    const totals = summarizePayroll(lines)
    expect(totals.grossPay).toBe(67000)
    expect(totals.totalDeductions).toBe(4500)
    expect(totals.netPay).toBe(62500)
  })

  it('returns zeroes for an empty roster', () => {
    expect(summarizePayroll([])).toEqual({ grossPay: 0, totalDeductions: 0, netPay: 0 })
  })
})

describe('buildPayrollJournalLines', () => {
  const run = () => {
    const lines = buildPayrollLines([employee()])
    return { period: '2026-10', lines, ...summarizePayroll(lines) }
  }
  const accounts = {
    expenseAccount: 700, // Salaries & Wages expense
    paymentAccount: 100, // Cash
    deductionDefaultAccount: 210, // Accrued payables fallback
  }

  it('builds a balanced entry: Dr expense gross, Cr deductions, Cr payment net', () => {
    const je = buildPayrollJournalLines(run(), accounts)
    const debit = je.filter((l) => (l.debit || 0) > 0)
    const credit = je.filter((l) => (l.credit || 0) > 0)

    expect(debit).toHaveLength(1)
    expect(debit[0]!.account).toBe(700)
    expect(debit[0]!.debit).toBe(37000)

    // Deduction heads with accounts + net to payment account
    expect(credit.map((l) => l.account)).toEqual([55, 56, 100])
    expect(credit.map((l) => l.credit)).toEqual([3000, 1500, 32500])

    const totalDebit = je.reduce((s, l) => s + (l.debit || 0), 0)
    const totalCredit = je.reduce((s, l) => s + (l.credit || 0), 0)
    expect(totalDebit).toBe(totalCredit)
  })

  it('groups deduction heads sharing an account into one credit line', () => {
    const lines = buildPayrollLines([
      employee({
        deductions: [
          { label: 'PF', amount: 1000, account: 55 },
          { label: 'CIT', amount: 500, account: 55 },
        ],
      }),
    ])
    const je = buildPayrollJournalLines(
      { period: '2026-10', lines, ...summarizePayroll(lines) },
      accounts,
    )
    const pfLine = je.filter((l) => l.account === 55)
    expect(pfLine).toHaveLength(1)
    expect(pfLine[0]!.credit).toBe(1500)
    expect(pfLine[0]!.memo).toContain('PF')
    expect(pfLine[0]!.memo).toContain('CIT')
  })

  it('falls back to the default deduction account for heads without one', () => {
    const lines = buildPayrollLines([
      employee({ deductions: [{ label: 'Advance', amount: 800 }] }),
    ])
    const je = buildPayrollJournalLines(
      { period: '2026-10', lines, ...summarizePayroll(lines) },
      accounts,
    )
    const fallback = je.find((l) => l.account === 210)
    expect(fallback?.credit).toBe(800)
  })

  it('throws when the expense or payment account is missing', () => {
    expect(() => buildPayrollJournalLines(run(), { ...accounts, expenseAccount: null })).toThrow(
      /expense/i,
    )
    expect(() => buildPayrollJournalLines(run(), { ...accounts, paymentAccount: null })).toThrow(
      /payment|cash/i,
    )
  })

  it('throws when the run has no lines', () => {
    expect(() =>
      buildPayrollJournalLines(
        { period: '2026-10', lines: [], grossPay: 0, totalDeductions: 0, netPay: 0 },
        accounts,
      ),
    ).toThrow(/no lines|empty/i)
  })
})
