import {
  computePayrollSlip,
  computePayrollRun,
  type PayrollEngineInput,
  type PayrollStructureField,
  type PayrollAssignmentField,
} from './payrollEngine'

/* eslint-disable @typescript-eslint/no-explicit-any */

function baseStructure(extra?: Partial<PayrollStructureField>): PayrollStructureField {
  return {
    company: 1,
    currency: 'INR',
    payrollFrequency: 'Monthly',
    paymentAccount: 100,
    earnings: [],
    deductions: [],
    employerContributions: [],
    isActive: true,
    isDefault: false,
    ...extra,
  }
}

function baseEmployee(overrides?: Partial<PayrollEngineInput['employee']>): PayrollEngineInput['employee'] {
  return {
    id: 1,
    employeeId: 'EMP-001',
    name: 'Aama Gurung',
    basicSalary: 30000,
    allowances: [],
    deductions: [],
    employmentState: 'Karnataka',
    gender: 'Male',
    taxRegime: 'new',
    epfApplicable: true,
    vpfAmount: 0,
    ...overrides,
  }
}

function baseAssignment(overrides?: Partial<PayrollAssignmentField>): PayrollAssignmentField {
  return {
    id: 1,
    employee: { id: 1 },
    base: 30000,
    variable: 0,
    fromDate: '2026-09-01',
    ...overrides,
  }
}

describe('computePayrollSlip', () => {
  it('computes earnings, deductions, employer contributions, and total', () => {
    const input: PayrollEngineInput = {
      employee: baseEmployee({
        allowances: [{ label: 'House Rent Allowance', amount: 5000 }],
        deductions: [{ label: 'Provident Fund', amount: 3600 }],
      }),
      assignment: baseAssignment({ variable: 5000 }),
      structure: baseStructure({
        deductions: [
          {
            component: 2,
            amount: 0,
            formula: 'base * 0.12',
            isTaxApplicable: true,
            doNotIncludeInTotal: false,
            doNotIncludeInAccounts: false,
          },
        ],
        employerContributions: [
          {
            component: 3,
            amount: 0,
            formula: 'base * 0.0833',
            doNotIncludeInTotal: false,
            doNotIncludeInAccounts: false,
          },
        ],
      }),
      period: '2026-09',
      postingDate: '2026-09-30',
      payrollPayableAccount: 200,
      settings: {
        epfEnabled: true,
        esicEnabled: false,
        professionalTaxEnabled: true,
        lwfEnabled: false,
        tdsEnabled: true,
        defaultEmploymentState: 'Karnataka',
        statutoryExpenseAccount: 700,
      },
    }
    const result = computePayrollSlip(input)

    expect(result.earnings).toHaveLength(0)
    expect(result.deductions).toHaveLength(1)
    const deduction = result.deductions[0]
    expect(deduction).toBeDefined()
    expect(deduction!.amount).toBe(3600) // base(30000) * 0.12
    expect(deduction!.isTaxApplicable).toBe(true)
    expect(deduction!.doNotIncludeInTotal).toBe(false)
    expect(deduction!.doNotIncludeInAccounts).toBe(false)

    expect(result.employerContributions).toHaveLength(1)
    const employerContribution = result.employerContributions[0]
    expect(employerContribution).toBeDefined()
    expect(employerContribution!.amount).toBeCloseTo(2499, 0) // base(30000) * 0.0833
    expect(employerContribution!.doNotIncludeInTotal).toBe(false)
    expect(employerContribution!.doNotIncludeInAccounts).toBe(false)

    // grossPay = baseAfterLOP (30000) + earnings (0) = 30000
    // netPay = grossPay (30000) - deductions (3600) = 26400
    expect(result.totalEarnings).toBe(0)
    expect(result.totalDeductions).toBe(3600)
    expect(result.totalEmployerContributions).toBeCloseTo(2499, 0)
    expect(result.grossPay).toBe(30000)
    expect(result.netPay).toBe(26400)
    expect(result.employeeGrossPay).toBe(30000)
    expect(result.employerGrossPay).toBeCloseTo(2499, 0)
    expect(result.employeeTotalDeduction).toBe(3600)
    expect(result.employerTotalContribution).toBeCloseTo(2499, 0)
    expect(result.employeeNetPay).toBe(26400)
    expect(result.employerNetPay).toBeCloseTo(2499, 0)
    expect(result.ctc).toBe(32499)
    // taxableEarnings = earnings (0) + additionalSalary (0) = 0
    // BUT basicSalary is not directly taxable — only earnings are
    // Actually in this engine taxableEarnings = evaluatedEarnings (filtered) + additionalSalary + flexBenefits
    // With no earnings, taxableEarnings = 0
    expect(result.taxableEarnings).toBe(0)
    expect(result.totalIncomeTax).toBe(0)
    expect(result.currentMonthIncomeTax).toBe(0)
    expect(result.annualTaxableAmount).toBe(0)
    expect(result.yearToDate).toBe(0)
    expect(result.monthToDate).toBe(0)
    expect(result.incomeTaxDeductedTillDate).toBe(0)
    expect(result.taxDeductedTillDate).toBe(0)
  })

  it('excludes exempted earnings from taxable income', () => {
    const input: PayrollEngineInput = {
      employee: baseEmployee(),
      assignment: baseAssignment(),
      structure: baseStructure({
        earnings: [
          {
            component: 1,
            amount: 0,
            formula: 'base',
            isTaxApplicable: true,
            exemptedFromIncomeTax: true,
            doNotIncludeInTotal: false,
          },
        ],
      }),
      period: '2026-09',
      postingDate: '2026-09-30',
      payrollPayableAccount: 200,
      settings: {
        epfEnabled: false,
        esicEnabled: false,
        professionalTaxEnabled: false,
        lwfEnabled: false,
        tdsEnabled: false,
      },
    }
    const result = computePayrollSlip(input)

    // earning formula 'base' = 30000, but exempted from tax
    // grossPay = baseAfterLOP (30000) + earnings (30000) = 60000
    // taxableEarnings = 30000 (earning) but exempted → 0
    expect(result.taxableEarnings).toBe(0)
    expect(result.totalIncomeTax).toBe(0)
    expect(result.currentMonthIncomeTax).toBe(0)
  })

  it('excludes doNotIncludeInTotal earnings from gross and net', () => {
    const input: PayrollEngineInput = {
      employee: baseEmployee(),
      assignment: baseAssignment(),
      structure: baseStructure({
        earnings: [
          {
            component: 1,
            amount: 0,
            formula: 'base',
            isTaxApplicable: true,
            exemptedFromIncomeTax: false,
            doNotIncludeInTotal: true,
          },
        ],
      }),
      period: '2026-09',
      postingDate: '2026-09-30',
      payrollPayableAccount: 200,
      settings: {
        epfEnabled: false,
        esicEnabled: false,
        professionalTaxEnabled: false,
        lwfEnabled: false,
        tdsEnabled: false,
      },
    }
    const result = computePayrollSlip(input)

    // earning formula 'base' = 30000, doNotIncludeInTotal=true
    // grossPay = baseAfterLOP (30000) + 0 (excluded earnings) = 30000
    // netPay = grossPay (30000) - 0 = 30000
    // totalEarnings still counts the 30000
    expect(result.grossPay).toBe(30000)
    expect(result.netPay).toBe(30000)
    expect(result.totalEarnings).toBe(30000)
    expect(result.employeeGrossPay).toBe(30000)
    expect(result.employeeNetPay).toBe(30000)
  })

  it('adds additional salary to earnings and taxable income', () => {
    const input: PayrollEngineInput = {
      employee: baseEmployee(),
      assignment: baseAssignment(),
      structure: baseStructure(),
      period: '2026-09',
      postingDate: '2026-09-30',
      payrollPayableAccount: 200,
      settings: {
        epfEnabled: false,
        esicEnabled: false,
        professionalTaxEnabled: false,
        lwfEnabled: false,
        tdsEnabled: false,
      },
      additionalSalary: [
        {
          additionalSalary: 1,
          amount: 5000,
          type: 'Earning',
        },
      ],
    }
    const result = computePayrollSlip(input)

    // grossPay = baseAfterLOP (30000) + earnings (0) + additionalSalary (5000) = 35000
    expect(result.totalEarnings).toBe(5000)
    expect(result.taxableEarnings).toBe(5000)
    expect(result.grossPay).toBe(35000)
  })

  it('subtracts loans and advance recovery from net pay', () => {
    const input: PayrollEngineInput = {
      employee: baseEmployee(),
      assignment: baseAssignment(),
      structure: baseStructure(),
      period: '2026-09',
      postingDate: '2026-09-30',
      payrollPayableAccount: 200,
      settings: {
        epfEnabled: false,
        esicEnabled: false,
        professionalTaxEnabled: false,
        lwfEnabled: false,
        tdsEnabled: false,
      },
      loanRepayment: [
        {
          loan: 1,
          amount: 2000,
          principalAmount: 1500,
          interestAmount: 500,
        },
      ],
      advanceRecovery: [
        {
          additionalSalary: 1,
          amount: 1000,
        },
      ],
    }
    const result = computePayrollSlip(input)

    // grossPay = baseAfterLOP (30000) + 0 = 30000
    // deductions = loan (2000) + advance (1000) = 3000
    // netPay = 30000 - 3000 = 27000
    expect(result.totalDeductions).toBe(3000)
    expect(result.netPay).toBe(27000)
    expect(result.employeeTotalDeduction).toBe(3000)
    expect(result.employeeNetPay).toBe(27000)
  })

  it('adds flexible benefits to earnings', () => {
    const input: PayrollEngineInput = {
      employee: baseEmployee(),
      assignment: baseAssignment(),
      structure: baseStructure(),
      period: '2026-09',
      postingDate: '2026-09-30',
      payrollPayableAccount: 200,
      settings: {
        epfEnabled: false,
        esicEnabled: false,
        professionalTaxEnabled: false,
        lwfEnabled: false,
        tdsEnabled: false,
      },
      flexibleBenefits: [
        {
          component: 1,
          label: 'Health Insurance',
          amount: 5000,
        },
      ],
    }
    const result = computePayrollSlip(input)

    // grossPay = baseAfterLOP (30000) + earnings (0) + flexBenefits (5000) = 35000
    expect(result.totalEarnings).toBe(5000)
    expect(result.taxableEarnings).toBe(5000)
    expect(result.grossPay).toBe(35000)
  })
})

describe('computePayrollRun', () => {
  it('computes run totals and journal entry lines', () => {
    const assignments = [
      {
        id: 1,
        employee: baseEmployee({
          allowances: [{ label: 'House Rent Allowance', amount: 5000 }],
          deductions: [{ label: 'Provident Fund', amount: 3600 }],
          employmentState: 'Karnataka',
        }),
        structure: baseStructure({
          deductions: [
            {
              component: 2,
              amount: 0,
              formula: 'base * 0.12',
              isTaxApplicable: true,
              doNotIncludeInTotal: false,
              doNotIncludeInAccounts: false,
            },
          ],
          employerContributions: [
            {
              component: 3,
              amount: 0,
              formula: 'base * 0.0833',
              doNotIncludeInTotal: false,
              doNotIncludeInAccounts: false,
            },
          ],
        }),
        assignment: baseAssignment({ variable: 5000 }),
      },
      {
        id: 2,
        employee: baseEmployee({
          basicSalary: 20000,
          employeeId: 'EMP-002',
          name: 'Hari Thapa',
          allowances: [],
          deductions: [],
          employmentState: 'Maharashtra',
        }),
        structure: baseStructure({
          employerContributions: [
            {
              component: 3,
              amount: 0,
              formula: 'base * 0.0833',
              doNotIncludeInTotal: false,
              doNotIncludeInAccounts: false,
            },
          ],
        }),
        assignment: baseAssignment({ base: 20000, variable: 0 }),
      },
    ]

    const result = computePayrollRun(
      {
        company: 1,
        fiscalYear: 1,
        period: '2026-09',
        postingDate: '2026-09-30',
        settings: {
          epfEnabled: true,
          esicEnabled: false,
          professionalTaxEnabled: true,
          lwfEnabled: false,
          tdsEnabled: true,
          defaultEmploymentState: 'Karnataka',
          statutoryExpenseAccount: 700,
          expenseAccount: 700,
          paymentAccount: 100,
          payrollPayableAccount: 200,
        },
      },
      assignments,
    )

    expect(result.lines).toHaveLength(2)
    // Employee 1: gross=30000 (base) + 0 earnings = 30000; deductions=3600; net=26400
    // Employee 2: gross=20000 (base) + 0 earnings = 20000; deductions=0; net=20000
    expect(result.grossPay).toBe(30000 + 20000)
    expect(result.totalDeductions).toBe(3600)
    expect(result.netPay).toBe(26400 + 20000)
    expect(result.employerContributionsTotal).toBeCloseTo(2499 + 1666, 0)

    const lines = result.journalEntryLines
    expect(lines.length).toBeGreaterThan(0)
    const firstLine = lines[0]
    const secondLine = lines[1]
    const thirdLine = lines[2]
    expect(firstLine).toBeDefined()
    expect(secondLine).toBeDefined()
    expect(thirdLine).toBeDefined()

    expect(firstLine!.account).toBe(700)
    expect(firstLine!.debit).toBe(50000)
    expect(firstLine!.memo).toBe('Salaries 2026-09')
    expect(secondLine!.account).toBe(200)
    expect(secondLine!.credit).toBe(46400)
    expect(secondLine!.memo).toBe('Net salaries 2026-09')
    expect(thirdLine!.account).toBe(700)
    expect(thirdLine!.debit).toBeCloseTo(4165, 0)
    expect(thirdLine!.memo).toBe('Employer statutory contributions')
  })
})
