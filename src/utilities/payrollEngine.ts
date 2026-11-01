import { round2 } from './journalValidation'
import type { PayrollRunLine, PayrollEarning, PayrollDeduction } from './payrollCalc'
import { computeIncomeTax } from './indiaPayroll'

export interface PayrollComponentField {
  component?: number | { id: number } | null
  amount?: number | null
  formula?: string | null
  condition?: string | null
  dependsOnPaymentDays?: boolean | null
  isTaxApplicable?: boolean | null
  exemptedFromIncomeTax?: boolean | null
  doNotIncludeInTotal?: boolean | null
  doNotIncludeInAccounts?: boolean | null
  statisticalComponent?: boolean | null
}

export interface PayrollStructureField {
  company?: number | { id: number } | null
  currency?: string | null
  payrollFrequency?: string | null
  modeOfPayment?: string | null
  paymentAccount?: number | { id: number } | null
  earnings?: PayrollComponentField[]
  deductions?: PayrollComponentField[]
  employerContributions?: PayrollComponentField[]
  isActive?: boolean | null
  isDefault?: boolean | null
}

export interface PayrollAssignmentField {
  id?: number | null
  employee?: number | { id: number } | null
  salaryStructure?: number | { id: number } | null
  fromDate?: string | null
  base?: number | null
  variable?: number | null
  payrollPayableAccount?: number | { id: number } | null
  taxableEarningsTillDate?: number | null
  taxDeductedTillDate?: number | null
  leaveEncashmentAmountPerDay?: number | null
  maxBenefits?: number | null
  costCenters?: Array<{ costCenter?: string | null; percentage?: number | null }> | null
}

export interface PayrollRunField {
  company?: number | { id: number } | null
  currency?: string | null
  period?: string | null
  postingDate?: string | null
  startDate?: string | null
  endDate?: string | null
  payrollFrequency?: string | null
  payrollPayableAccount?: number | { id: number } | null
  expenseAccount?: number | { id: number } | null
  paymentAccount?: number | { id: number } | null
  bankAccount?: number | { id: number } | null
  status?: string | null
  numberOfEmployees?: number | null
  totalGrossPay?: number | null
  totalNetPay?: number | null
  totalDeductions?: number | null
  totalEmployerContributions?: number | null
}

export interface PayrollSlipField {
  employee?: number | { id: number } | null
  period?: string | null
  postingDate?: string | null
  startDate?: string | null
  endDate?: string | null
  payrollFrequency?: string | null
  salaryStructure?: number | { id: number } | null
  salaryStructureAssignment?: number | { id: number } | null
  payrollRun?: number | { id: number } | null
  base?: number | null
  variable?: number | null
  totalWorkingDays?: number | null
  paymentDays?: number | null
  leaveWithoutPay?: number | null
  absentDays?: number | null
  salaryMode?: string | null
  bankName?: string | null
  bankAccountNumber?: string | null
  grossPay?: number | null
  totalEarnings?: number | null
  totalDeductionsAmount?: number | null
  totalEmployerContributions?: number | null
  netPay?: number | null
  roundedTotal?: number | null
  employeeGrossPay?: number | null
  employerGrossPay?: number | null
  employeeTotalDeduction?: number | null
  employerTotalContribution?: number | null
  employeeNetPay?: number | null
  employerNetPay?: number | null
  ctc?: number | null
  annualTaxableAmount?: number | null
  totalIncomeTax?: number | null
  incomeTaxDeductedTillDate?: number | null
  currentMonthIncomeTax?: number | null
  yearToDate?: number | null
  monthToDate?: number | null
  taxableEarningsTillDate?: number | null
  taxDeductedTillDate?: number | null
  status?: string | null
  journalEntry?: number | { id: number } | null
  paymentJournalEntry?: number | { id: number } | null
  paidAt?: string | null
  additionalSalary?: Array<{
    additionalSalary?: number | { id: number } | null
    amount?: number | null
    type?: string | null
  }> | null
  loanRepayment?: Array<{
    loan?: number | { id: number } | null
    amount?: number | null
    principalAmount?: number | null
    interestAmount?: number | null
  }> | null
  advanceRecovery?: Array<{
    additionalSalary?: number | { id: number } | null
    amount?: number | null
  }> | null
  flexibleBenefits?: Array<{
    component?: number | { id: number } | null
    label?: string | null
    amount?: number | null
  }> | null
  taxExemptionDeclaration?: number | { id: number } | null
  payrollCostCenters?: Array<{ costCenter?: string | null; percentage?: number | null }> | null
}

export interface PayrollEarningsLine {
  component?: number | null
  label?: string | null
  amount: number
  isTaxApplicable: boolean
  exemptedFromIncomeTax: boolean
  doNotIncludeInTotal: boolean
}

export interface PayrollDeductionsLine {
  component?: number | null
  label?: string | null
  amount: number
  isTaxApplicable: boolean
  doNotIncludeInTotal: boolean
  doNotIncludeInAccounts: boolean
  account?: number | null
}

export interface PayrollEmployerContributionsLine {
  component?: number | null
  label?: string | null
  amount: number
  doNotIncludeInTotal: boolean
  doNotIncludeInAccounts: boolean
}

export interface PayrollSlipResult {
  earnings: PayrollEarningsLine[]
  deductions: PayrollDeductionsLine[]
  employerContributions: PayrollEmployerContributionsLine[]
  totalEarnings: number
  totalDeductions: number
  totalEmployerContributions: number
  grossPay: number
  netPay: number
  employeeGrossPay: number
  employerGrossPay: number
  employeeTotalDeduction: number
  employerTotalContribution: number
  employeeNetPay: number
  employerNetPay: number
  ctc: number
  taxableEarnings: number
  totalIncomeTax: number
  currentMonthIncomeTax: number
  annualTaxableAmount: number
  yearToDate: number
  monthToDate: number
  incomeTaxDeductedTillDate: number
  taxDeductedTillDate: number
}

export interface PayrollRunResult {
  lines: PayrollRunLine[]
  grossPay: number
  totalDeductions: number
  netPay: number
  employerContributionsTotal: number
  journalEntryLines: Array<{ account: number; debit?: number; credit?: number; memo?: string }>
}

export interface PayrollEngineInput {
  employee: {
    id: number
    employeeId?: string | null
    name: string
    basicSalary?: number | null
    allowances?: Array<{ label?: string | null; amount?: number | null }> | null
    deductions?: Array<{ label?: string | null; amount?: number | null; account?: number | null }> | null
    employmentState?: string | null
    gender?: string | null
    taxRegime?: string | null
    epfApplicable?: boolean | null
    lwfExempt?: boolean | null
    vpfAmount?: number | null
  }
  assignment: PayrollAssignmentField
  structure: PayrollStructureField
  period: string
  postingDate?: string | null
  startDate?: string | null
  endDate?: string | null
  payrollFrequency?: string | null
  payrollPayableAccount?: number | null
  settings?: {
    epfEnabled?: boolean | null
    esicEnabled?: boolean | null
    professionalTaxEnabled?: boolean | null
    lwfEnabled?: boolean | null
    tdsEnabled?: boolean | null
    defaultEmploymentState?: string | null
    epfPayableAccount?: number | null
    epsPayableAccount?: number | null
    edliPayableAccount?: number | null
    esicPayableAccount?: number | null
    ptPayableAccount?: number | null
    lwfPayableAccount?: number | null
    tdsPayableAccount?: number | null
    statutoryExpenseAccount?: number | null
    expenseAccount?: number | null
    paymentAccount?: number | null
    payrollPayableAccount?: number | null
    pfNumber?: string | null
    esiNumber?: string | null
    lwfNumber?: string | null
  }
  additionalSalary?: PayrollSlipField['additionalSalary']
  loanRepayment?: PayrollSlipField['loanRepayment']
  advanceRecovery?: PayrollSlipField['advanceRecovery']
  flexibleBenefits?: PayrollSlipField['flexibleBenefits']
  taxExemptionDeclaration?: PayrollSlipField['taxExemptionDeclaration']
  payrollCostCenters?: PayrollSlipField['payrollCostCenters']
  workingDays?: number | null
  paymentDays?: number | null
  leaveWithoutPay?: number | null
  absentDays?: number | null
}

function pickDate(
  preferred?: string | null,
  fallback?: string | null,
): string | null {
  if (preferred) return preferred
  if (fallback) return fallback
  return null
}

export function computePayrollSlip(input: PayrollEngineInput): PayrollSlipResult {
  const base = Number(input.assignment.base ?? 0)
  const variable = Number(input.assignment.variable ?? 0)
  const totalWorkingDays = Number(input.workingDays ?? 0) || 1
  const paymentDays = Number(input.paymentDays ?? input.workingDays ?? 0) || 1
  const leaveWithoutPay = Number(input.leaveWithoutPay ?? 0) || 0
  const absentDays = Number(input.absentDays ?? 0) || 0
  const paymentDayFactor = totalWorkingDays > 0 ? paymentDays / totalWorkingDays : 1
  const baseAfterLOP = base * paymentDayFactor

  const earnings: PayrollEarningsLine[] = []
  const deductions: PayrollDeductionsLine[] = []
  const employerContributions: PayrollEmployerContributionsLine[] = []

  const earningsFromStructure = (input.structure.earnings ?? []).filter(
    (e): e is PayrollComponentField & { component?: number | null } =>
      e.component != null,
  )
  const deductionsFromStructure = (input.structure.deductions ?? []).filter(
    (d): d is PayrollComponentField & { component?: number | null } =>
      d.component != null,
  )
  const employerContributionsFromStructure = (input.structure.employerContributions ?? []).filter(
    (e): e is PayrollComponentField & { component?: number | null } =>
      e.component != null,
  )

  const evaluatedEarnings: Array<{
    component: number
    amount: number
    isTaxApplicable: boolean
    exemptedFromIncomeTax: boolean
    doNotIncludeInTotal: boolean
  }> = []
  const ev = (f: string | null | undefined, base: number, variable: number): number =>
    f != null ? evaluateFormula(f, base, variable) : 0
  const evaluatedDeductions: Array<{
    component: number
    amount: number
    isTaxApplicable: boolean
    doNotIncludeInTotal: boolean
    doNotIncludeInAccounts: boolean
  }> = []
  const evaluatedEmployerContributions: Array<{
    component: number
    amount: number
    doNotIncludeInTotal: boolean
    doNotIncludeInAccounts: boolean
  }> = []

  for (const earning of earningsFromStructure) {
    const amount = Number(earning.amount ?? 0)
    const computedAmount = ev(earning.formula, baseAfterLOP, variable) || amount
    evaluatedEarnings.push({
      component: earning.component!,
      amount: round2(computedAmount),
      isTaxApplicable: earning.isTaxApplicable !== false,
      exemptedFromIncomeTax: earning.exemptedFromIncomeTax === true,
      doNotIncludeInTotal: earning.doNotIncludeInTotal === true,
    })
  }

  for (const deduction of deductionsFromStructure) {
    const amount = Number(deduction.amount ?? 0)
    const computedAmount = ev(deduction.formula, baseAfterLOP, variable) || amount
    evaluatedDeductions.push({
      component: deduction.component!,
      amount: round2(computedAmount),
      isTaxApplicable: deduction.isTaxApplicable !== false,
      doNotIncludeInTotal: deduction.doNotIncludeInTotal === true,
      doNotIncludeInAccounts: deduction.doNotIncludeInAccounts === true,
    })
  }

  for (const employerContribution of employerContributionsFromStructure) {
    const amount = Number(employerContribution.amount ?? 0)
    const computedAmount = ev(employerContribution.formula, baseAfterLOP, variable) || amount
    evaluatedEmployerContributions.push({
      component: employerContribution.component!,
      amount: round2(computedAmount),
      doNotIncludeInTotal: employerContribution.doNotIncludeInTotal === true,
      doNotIncludeInAccounts: employerContribution.doNotIncludeInAccounts === true,
    })
  }

  const additionalSalaryAmount = (input.additionalSalary ?? []).reduce((s, a) => s + Number(a.amount ?? 0), 0)
  const additionalSalaryTaxable = (input.additionalSalary ?? [])
    .filter((a) => a.type !== 'Deduction')
    .reduce((s, a) => s + Number(a.amount ?? 0), 0)

  const loanRepaymentAmount = (input.loanRepayment ?? []).reduce((s, l) => s + Number(l.amount ?? 0), 0)
  const advanceRecoveryAmount = (input.advanceRecovery ?? []).reduce((s, a) => s + Number(a.amount ?? 0), 0)

  const flexibleBenefitsAmount = (input.flexibleBenefits ?? []).reduce((s, f) => s + Number(f.amount ?? 0), 0)

  const employeeEarningsTotal =
    evaluatedEarnings.reduce((s, e) => s + e.amount, 0) + additionalSalaryTaxable + flexibleBenefitsAmount
  const employeeEarningsForGross =
    evaluatedEarnings.filter((e) => !e.doNotIncludeInTotal).reduce((s, e) => s + e.amount, 0) + additionalSalaryTaxable + flexibleBenefitsAmount
  const employeeDeductionsTotal =
    evaluatedDeductions.reduce((s, d) => s + d.amount, 0) + loanRepaymentAmount + advanceRecoveryAmount
  const employerContributionsTotal = evaluatedEmployerContributions.reduce((s, e) => s + e.amount, 0)

  const grossPay = baseAfterLOP + employeeEarningsForGross
  const netPay = grossPay - employeeDeductionsTotal

  const employeeGrossPay = grossPay
  const employerGrossPay = employerContributionsTotal
  const employeeTotalDeduction = employeeDeductionsTotal
  const employerTotalContribution = employerContributionsTotal
  const employeeNetPay = netPay
  const employerNetPay = employerContributionsTotal
  const ctc = grossPay + employerContributionsTotal

  const taxableEarnings =
    evaluatedEarnings
      .filter((e) => e.isTaxApplicable && !e.exemptedFromIncomeTax)
      .reduce((s, e) => s + e.amount, 0) + additionalSalaryTaxable + flexibleBenefitsAmount

  const taxRegime = input.employee.taxRegime === 'old' ? 'old' : 'new'
  const incomeTaxResult = computeIncomeTax({
    annualIncome: round2(taxableEarnings * 12),
    regime: taxRegime,
  })

  const currentMonthIncomeTax = incomeTaxResult.monthlyTDS
  const totalIncomeTax = incomeTaxResult.totalTax
  const annualTaxableAmount = incomeTaxResult.taxableIncome
  const yearToDate = incomeTaxResult.taxableIncome
  const monthToDate = incomeTaxResult.taxableIncome
  const deductedTillDate = input.assignment.taxDeductedTillDate ?? 0

  return {
    earnings: evaluatedEarnings.map((e) => ({
      component: e.component,
      label: undefined,
      amount: e.amount,
      isTaxApplicable: e.isTaxApplicable,
      exemptedFromIncomeTax: e.exemptedFromIncomeTax,
      doNotIncludeInTotal: e.doNotIncludeInTotal,
    })),
    deductions: evaluatedDeductions.map((d) => ({
      component: d.component,
      label: undefined,
      amount: d.amount,
      isTaxApplicable: d.isTaxApplicable,
      doNotIncludeInTotal: d.doNotIncludeInTotal,
      doNotIncludeInAccounts: d.doNotIncludeInAccounts,
    })),
    employerContributions: evaluatedEmployerContributions.map((e) => ({
      component: e.component,
      label: undefined,
      amount: e.amount,
      doNotIncludeInTotal: e.doNotIncludeInTotal,
      doNotIncludeInAccounts: e.doNotIncludeInAccounts,
    })),
    totalEarnings: round2(employeeEarningsTotal),
    totalDeductions: round2(employeeDeductionsTotal),
    totalEmployerContributions: round2(employerContributionsTotal),
    grossPay: round2(grossPay),
    netPay: round2(netPay),
    employeeGrossPay: round2(employeeGrossPay),
    employerGrossPay: round2(employerGrossPay),
    employeeTotalDeduction: round2(employeeTotalDeduction),
    employerTotalContribution: round2(employerTotalContribution),
    employeeNetPay: round2(employeeNetPay),
    employerNetPay: round2(employerNetPay),
    ctc: round2(ctc),
    taxableEarnings: round2(taxableEarnings),
    totalIncomeTax: round2(totalIncomeTax),
    currentMonthIncomeTax: round2(currentMonthIncomeTax),
    annualTaxableAmount: round2(annualTaxableAmount),
    yearToDate: round2(yearToDate),
    monthToDate: round2(monthToDate),
    incomeTaxDeductedTillDate: round2(deductedTillDate),
    taxDeductedTillDate: round2(deductedTillDate),
  }
}

export function computePayrollRun(
  input: {
    company: number
    fiscalYear: number
    period: string
    postingDate?: string | null
    settings?: PayrollEngineInput['settings']
    expenseAccount?: number | null
    paymentAccount?: number | null
    payrollPayableAccount?: number | null
  },
  assignments: Array<{
    id: number
    employee: {
      id: number
      employeeId?: string | null
      name: string
      basicSalary?: number | null
      allowances?: Array<{ label?: string | null; amount?: number | null }> | null
      deductions?: Array<{ label?: string | null; amount?: number | null; account?: number | null }> | null
      employmentState?: string | null
      gender?: string | null
      taxRegime?: string | null
      epfApplicable?: boolean | null
      lwfExempt?: boolean | null
      vpfAmount?: number | null
    }
    structure: PayrollStructureField
    assignment: PayrollAssignmentField
  }>,
): PayrollRunResult {
  const lines: PayrollRunLine[] = []
  let grossPay = 0
  let totalDeductions = 0
  let netPay = 0
  let employerContributionsTotal = 0

  const journalEntryLines: Array<{ account: number; debit?: number; credit?: number; memo?: string }> = []

  for (const assignment of assignments) {
    const slip = computePayrollSlip({
      employee: assignment.employee,
      assignment: assignment.assignment,
      structure: assignment.structure,
      period: input.period,
      postingDate: input.postingDate,
      settings: input.settings ?? {},
    })

    const line: PayrollRunLine = {
      employee: assignment.employee.id,
      empCode: assignment.employee.employeeId ?? '',
      name: assignment.employee.name,
      basic: round2(Number(assignment.employee.basicSalary ?? 0)),
      allowances: (assignment.employee.allowances ?? []).map((a): PayrollEarning => ({
        label: a.label ?? '',
        amount: round2(Number(a.amount ?? 0)),
      })),
      gross: slip.grossPay,
      deductions: slip.deductions.map((d) => ({
        label: d.label ?? '',
        amount: d.amount,
        account: d.account ?? null,
      })),
      net: slip.netPay,
    }

    lines.push(line)
    grossPay += slip.grossPay
    totalDeductions += slip.totalDeductions
    netPay += slip.netPay
    employerContributionsTotal += slip.totalEmployerContributions
  }

  const expenseAccount = input.settings?.expenseAccount ?? 0
  const paymentAccount = input.settings?.paymentAccount ?? 0
  const payrollPayableAccount = input.settings?.payrollPayableAccount ?? 0

  journalEntryLines.push({
    account: expenseAccount,
    debit: round2(grossPay),
    memo: `Salaries ${input.period}`,
  })
  journalEntryLines.push({
    account: payrollPayableAccount,
    credit: round2(netPay),
    memo: `Net salaries ${input.period}`,
  })

  if (employerContributionsTotal > 0) {
    const statutoryExpenseAccount = input.settings?.statutoryExpenseAccount ?? expenseAccount
    journalEntryLines.push({
      account: statutoryExpenseAccount,
      debit: round2(employerContributionsTotal),
      memo: 'Employer statutory contributions',
    })
  }

  return {
    lines,
    grossPay: round2(grossPay),
    totalDeductions: round2(totalDeductions),
    netPay: round2(netPay),
    employerContributionsTotal: round2(employerContributionsTotal),
    journalEntryLines,
  }
}

function evaluateFormula(formula: string | null | undefined, base: number, variable: number): number {
  if (formula == null) return 0
  const formulaLower = formula.toLowerCase()
  if (formulaLower.includes('base')) {
    if (formulaLower.includes('*')) {
      const match = formulaLower.match(/base\s*\*\s*([\d.]+)/)
      if (match && match[1] != null) {
        return base * parseFloat(match[1])
      }
    }
    if (formulaLower.includes('+')) {
      const match = formulaLower.match(/base\s*\+\s*([\d.]+)/)
      if (match && match[1] != null) {
        return base + parseFloat(match[1])
      }
    }
    if (formulaLower.includes('-')) {
      const match = formulaLower.match(/base\s*-\s*([\d.]+)/)
      if (match && match[1] != null) {
        return base - parseFloat(match[1])
      }
    }
    if (formulaLower === 'base') {
      return base
    }
    if (formulaLower === 'base * 0.12') {
      return base * 0.12
    }
    if (formulaLower === 'base * 0.0833') {
      return base * 0.0833
    }
    if (formulaLower === 'base * 0.005') {
      return base * 0.005
    }
  }
  if (formulaLower.includes('variable')) {
    if (formulaLower.includes('*')) {
      const match = formulaLower.match(/variable\s*\*\s*([\d.]+)/)
      if (match && match[1] != null) {
        return variable * parseFloat(match[1])
      }
    }
    if (formulaLower.includes('+')) {
      const match = formulaLower.match(/variable\s*\+\s*([\d.]+)/)
      if (match && match[1] != null) {
        return variable + parseFloat(match[1])
      }
    }
    if (formulaLower === 'variable') {
      return variable
    }
  }
  const num = parseFloat(formula ?? '')
  if (!isNaN(num)) {
    return num
  }
  return 0
}

