/**
 * Statutory wiring tests — the glue between the india-payroll engine and
 * payroll runs: per-line deductions (EPF/VPF/ESI/PT/LWF/TDS) and the
 * employer contribution totals the posting journal accrues.
 */
import {
  ptPriorPeriods,
  applyStatutoryDeductions,
  type StatutoryEmployee,
  type StatutorySettings,
} from './payrollStatutory'
import type { PayrollRunLine } from './payrollCalc'

const SETTINGS: StatutorySettings = {
  epfEnabled: true,
  esicEnabled: true,
  professionalTaxEnabled: true,
  lwfEnabled: true,
  tdsEnabled: true,
  defaultEmploymentState: 'Maharashtra',
  epfPayableAccount: 210,
  epsPayableAccount: 211,
  edliPayableAccount: 212,
  esicPayableAccount: 213,
  ptPayableAccount: 214,
  lwfPayableAccount: 215,
  tdsPayableAccount: 216,
  statutoryExpenseAccount: 720,
}

function line(over: Partial<PayrollRunLine> = {}): PayrollRunLine {
  return {
    employee: 1,
    empCode: 'EMP-001',
    name: 'Aama Gurung',
    basic: 20000,
    allowances: [{ label: 'Dearness Allowance', amount: 3000 }],
    gross: 23000,
    deductions: [],
    net: 23000,
    ...over,
  }
}

const EMP: StatutoryEmployee = {
  id: 1,
  epfApplicable: true,
  taxRegime: 'new',
}

describe('ptPriorPeriods', () => {
  it('half-yearly: Apr–Sep and Oct–Mar windows', () => {
    expect(ptPriorPeriods('half-yearly', '2026-07')).toEqual(['2026-04', '2026-05', '2026-06'])
    expect(ptPriorPeriods('half-yearly', '2026-01')).toEqual(['2025-10', '2025-11', '2025-12'])
    expect(ptPriorPeriods('half-yearly', '2026-05')).toEqual(['2026-04'])
    expect(ptPriorPeriods('half-yearly', '2026-04')).toEqual([])
  })

  it('yearly: everything before the month inside the Apr–Mar fiscal year', () => {
    expect(ptPriorPeriods('yearly', '2026-12')).toEqual([
      '2026-04', '2026-05', '2026-06', '2026-07', '2026-08',
      '2026-09', '2026-10', '2026-11',
    ])
    expect(ptPriorPeriods('yearly', '2026-01')).toEqual([
      '2025-04', '2025-05', '2025-06', '2025-07', '2025-08',
      '2025-09', '2025-10', '2025-11', '2025-12',
    ])
    expect(ptPriorPeriods('yearly', '2026-04')).toEqual([])
  })
})

describe('applyStatutoryDeductions — all statutes on (Karnataka, Oct 2026)', () => {
  it('appends EPF, ESI, PT, LWF and TDS rows and recomputes net', () => {
    const { lines, employerContributions } = applyStatutoryDeductions(
      [line()],
      new Map([[1, EMP]]),
      SETTINGS,
      '2026-10',
    )
    const l = lines[0]!
    const byLabel = Object.fromEntries(l.deductions.map((d) => [d.label, d]))

    // PF wage 23,000 → capped at new ceiling 25,000 → 12 % = 2,760.
    expect(byLabel['Provident Fund']).toMatchObject({ amount: 2760, account: 210 })
    // ESI wage 23,000 > 21,000 → not covered → no ESI row.
    expect(byLabel['Employee State Insurance']).toBeUndefined()
    // Maharashtra PT: gross 23,000 → top slab 200 (Oct — no Feb override).
    expect(byLabel['Professional Tax']).toMatchObject({ amount: 200, account: 214 })
    // Maharashtra LWF: half-yearly (June + December) → nothing in October.
    expect(byLabel['Labour Welfare Fund']).toBeUndefined()
    // TDS: annual 2,76,000 → std deduction → nil tax.
    expect(byLabel['TDS']).toBeUndefined()

    expect(l.net).toBe(23000 - 2760 - 200)

    // Employer: EPF total 2,760 split EPS (8.33 % of 23,000 = 1,915.9 → 1,916)
    // + employer EPF remainder; EDLI + admin on capped wage.
    const ec = Object.fromEntries(employerContributions.map((c) => [c.label, c]))
    expect(ec['EPS']).toMatchObject({ amount: 1916, account: 211 })
    expect(ec['EPF (Employer)']).toMatchObject({ amount: 844, account: 210 })
    expect(ec['EDLI']).toMatchObject({ amount: 115, account: 212 })
    expect(ec['EPF Admin']).toMatchObject({ amount: 115, account: 212 })
  })

  it('ESI applies when the wage is within the ceiling', () => {
    const lowBasic = line({
      basic: 15000,
      allowances: [],
      gross: 15000,
      net: 15000,
    })
    const { lines, employerContributions } = applyStatutoryDeductions(
      [lowBasic],
      new Map([[1, EMP]]),
      SETTINGS,
      '2026-10',
    )
    const byLabel = Object.fromEntries(lines[0]!.deductions.map((d) => [d.label, d]))
    expect(byLabel['Employee State Insurance']).toMatchObject({
      amount: 112.5, // 0.75 % × 15,000
      account: 213,
    })
    const ec = Object.fromEntries(employerContributions.map((c) => [c.label, c]))
    expect(ec['ESI (Employer)']).toMatchObject({ amount: 487.5, account: 213 })
  })
})

describe('applyStatutoryDeductions — gates', () => {
  it('a disabled statute adds nothing while the others still fire', () => {
    const off: StatutorySettings = { ...SETTINGS, epfEnabled: false, professionalTaxEnabled: false }
    const low = line({ basic: 15000, allowances: [], gross: 15000, net: 15000 })
    const { lines, employerContributions } = applyStatutoryDeductions(
      [low],
      new Map([[1, EMP]]),
      off,
      '2026-10',
    )
    const labels = lines[0]!.deductions.map((d) => d.label)
    expect(labels).not.toContain('Provident Fund')
    expect(labels).not.toContain('Professional Tax')
    // ESI still applies to the same line (15,000 ≤ 21,000).
    expect(labels).toContain('Employee State Insurance')
    expect(employerContributions.some((c) => c.label === 'ESI (Employer)')).toBe(true)
    expect(employerContributions.some((c) => c.label === 'EPS')).toBe(false)
  })

  it('employee opt-outs: epfApplicable false and lwfExempt', () => {
    // Haryana has monthly LWF, so the exemption is observable.
    const hr: StatutorySettings = { ...SETTINGS, defaultEmploymentState: 'Haryana' }
    const optOut: StatutoryEmployee = { ...EMP, epfApplicable: false, lwfExempt: true }
    const { lines, employerContributions } = applyStatutoryDeductions(
      [line()],
      new Map([[1, optOut]]),
      hr,
      '2026-03',
    )
    const labels = lines[0]!.deductions.map((d) => d.label)
    expect(labels).not.toContain('Provident Fund')
    expect(employerContributions.some((c) => c.label === 'EPS')).toBe(false)
    expect(labels).not.toContain('Labour Welfare Fund')
    expect(employerContributions.some((c) => c.label === 'LWF (Employer)')).toBe(false)

    // Control: without the exemption the row appears.
    const control = applyStatutoryDeductions(
      [line()],
      new Map([[1, { ...EMP, epfApplicable: false }]]),
      hr,
      '2026-03',
    )
    expect(
      control.lines[0]!.deductions.some((d) => d.label === 'Labour Welfare Fund'),
    ).toBe(true)
    expect(control.employerContributions.some((c) => c.label === 'LWF (Employer)')).toBe(true)
  })

  it('VPF adds an extra employee row on top of EPF', () => {
    const { lines } = applyStatutoryDeductions(
      [line()],
      new Map([[1, { ...EMP, vpfAmount: 1000 }]]),
      SETTINGS,
      '2026-10',
    )
    const byLabel = Object.fromEntries(lines[0]!.deductions.map((d) => [d.label, d]))
    expect(byLabel['Voluntary Provident Fund']).toMatchObject({ amount: 1000, account: 210 })
  })

  it('employment state falls back to the settings default; none → no PT/LWF', () => {
    const noState: StatutorySettings = { ...SETTINGS, defaultEmploymentState: undefined }
    const { lines } = applyStatutoryDeductions(
      [line()],
      new Map([[1, EMP]]),
      noState,
      '2026-10',
    )
    const labels = lines[0]!.deductions.map((d) => d.label)
    expect(labels).not.toContain('Professional Tax')
    expect(labels).not.toContain('Labour Welfare Fund')
  })

  it('TDS follows the employee regime; old regime at this income still nil', () => {
    const big = line({ basic: 100000, allowances: [], gross: 100000, net: 100000 })
    const { lines } = applyStatutoryDeductions(
      [big],
      new Map([[1, EMP]]),
      SETTINGS,
      '2026-10',
    )
    const tds = lines[0]!.deductions.find((d) => d.label === 'TDS')
    // Annual 12,00,000 → taxable 11,25,000 → 52,500 → below 12L rebate limit → 0.
    expect(tds).toBeUndefined()

    const richer = line({ basic: 200000, allowances: [], gross: 200000, net: 200000 })
    const out = applyStatutoryDeductions(
      [richer],
      new Map([[1, EMP]]),
      SETTINGS,
      '2026-10',
    )
    const tdsBig = out.lines[0]!.deductions.find((d) => d.label === 'TDS')
    // Annual 24,00,000 → taxable 23,25,000 → monthly instalment > 0.
    expect(tdsBig?.amount).toBeGreaterThan(0)
    expect(tdsBig?.account).toBe(216)
  })
})

describe('applyStatutoryDeductions — half-yearly PT accumulates', () => {
  it('deducts only the incremental slab across the half-year', () => {
    const tn: StatutorySettings = {
      ...SETTINGS,
      defaultEmploymentState: 'Tamil Nadu',
    }
    const emp: StatutoryEmployee = { ...EMP }
    const empMap = new Map([[1, emp]])

    // May: first month of Apr–Sep, gross 45,000 → full slab 425.
    const may = applyStatutoryDeductions(
      [line({ basic: 45000, allowances: [], gross: 45000, net: 45000 })],
      empMap,
      tn,
      '2026-05',
    )
    expect(
      may.lines[0]!.deductions.find((d) => d.label === 'Professional Tax')?.amount,
    ).toBe(425)

    // June with prior run context: cumulative 90,000 → 1,250 due − 425 paid.
    const june = applyStatutoryDeductions(
      [line({ basic: 45000, allowances: [], gross: 45000, net: 45000 })],
      empMap,
      tn,
      '2026-06',
      new Map([[1, { gross: 45000, ptDeducted: 425 }]]),
    )
    expect(
      june.lines[0]!.deductions.find((d) => d.label === 'Professional Tax')?.amount,
    ).toBe(825)
  })
})

describe('applyStatutoryDeductions — missing payable accounts degrade to null', () => {
  it('deduction rows keep account null so posting falls back to Accrued Payables', () => {
    const { lines, employerContributions } = applyStatutoryDeductions(
      [line()],
      new Map([[1, EMP]]),
      {
        ...SETTINGS,
        epfPayableAccount: undefined,
        epsPayableAccount: undefined,
        statutoryExpenseAccount: undefined,
      },
      '2026-10',
    )
    const epfRow = lines[0]!.deductions.find((d) => d.label === 'Provident Fund')
    expect(epfRow?.account).toBeNull()
    // EPS falls back to the EPF payable account (also null here).
    const eps = employerContributions.find((c) => c.label === 'EPS')
    expect(eps?.account).toBeNull()
  })
})
