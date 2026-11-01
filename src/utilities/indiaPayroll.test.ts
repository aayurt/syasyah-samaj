/**
 * Statutory engine tests — ported from frappe/india-payroll fixtures:
 *   epf.py (ceilings, EPFO rounding, EPS post-2014 rule)
 *   esi.py (coverage ceiling, 0.75/3.25 split)
 *   professional_tax.py (state slabs, Feb-300 rule, revisions, exemptions)
 *   lwf.py (state amounts + deduction-month frequencies)
 *   income_tax_utils.py (new/old regime slabs, 87A rebate, surcharge + marginal relief)
 */
import {
  capPFWage,
  computeEPF,
  computeESI,
  computeIncomeTax,
  computeLWF,
  computeProfessionalTax,
  computeStatutoryWages,
  epfoRound,
  getEPFCeilings,
  getEPSWage,
  isESIWageComponent,
  isPFWageComponent,
} from './indiaPayroll'

const d = (s: string) => new Date(s + 'T00:00:00Z')

describe('epfoRound', () => {
  it('rounds half-up (1249.5 → 1250, never banker’s rounding)', () => {
    expect(epfoRound(1249.5)).toBe(1250)
    expect(epfoRound(1249.4)).toBe(1249)
    expect(epfoRound(0.5)).toBe(1)
    expect(epfoRound(2999.5)).toBe(3000)
  })
})

describe('isPFWageComponent', () => {
  it('matches Basic / Dearness / DA variants only', () => {
    expect(isPFWageComponent('Basic Salary')).toBe(true)
    expect(isPFWageComponent('Dearness Allowance')).toBe(true)
    expect(isPFWageComponent('DA')).toBe(true)
    expect(isPFWageComponent('Basic + DA')).toBe(true)
    expect(isPFWageComponent('House Rent')).toBe(false)
    expect(isPFWageComponent('Medical Allowance')).toBe(false)
    expect(isPFWageComponent('Fixed Pay')).toBe(false)
    expect(isPFWageComponent('')).toBe(false)
    expect(isPFWageComponent(null)).toBe(false)
  })

  it('is stricter than the ESI matcher', () => {
    expect(isESIWageComponent('Retaining Allowance')).toBe(true)
    expect(isPFWageComponent('Retaining Allowance')).toBe(false)
  })
})

describe('computeStatutoryWages', () => {
  it('PF wage = Basic + DA-matching allowances; ESI adds retaining/RA', () => {
    const wages = computeStatutoryWages(20000, [
      { label: 'Dearness Allowance', amount: 3000 },
      { label: 'House Rent', amount: 5000 },
      { label: 'Retaining Allowance', amount: 500 },
    ])
    expect(wages.pfWage).toBe(23000)
    expect(wages.esiWage).toBe(23500)
  })
})

describe('EPF ceilings (S.O. 5109(E))', () => {
  it('₹15,000 before 17 Sept 2026, ₹25,000 from 17 Sept 2026', () => {
    expect(getEPFCeilings('2026-08-31', '2026-08-31')).toEqual([[15000, 1]])
    expect(getEPFCeilings('2026-10-01', '2026-10-31')).toEqual([[25000, 1]])
  })

  it('straddling September 2026 splits by calendar days (16/30 old, 14/30 new)', () => {
    const ceilings = getEPFCeilings('2026-09-01', '2026-09-30')
    expect(ceilings).toHaveLength(2)
    expect(ceilings[0]?.[0]).toBe(15000)
    expect(ceilings[1]?.[0]).toBe(25000)
    expect(ceilings[0]?.[1]).toBeCloseTo(16 / 30, 6)
    expect(ceilings[1]?.[1]).toBeCloseTo(14 / 30, 6)
  })

  it('caps per ceiling, not on the weighted average', () => {
    // 20,000 in Sept 2026 → 15,000×16/30 + 20,000×14/30 = 17,333.33
    const c = getEPFCeilings('2026-09-01', '2026-09-30')
    expect(capPFWage(20000, c)).toBeCloseTo(17333.33, 2)
    // min(20000, 19666.67) would have given 19,666.67 — must not happen.
    expect(capPFWage(20000, c)).not.toBeCloseTo(19666.67, 1)
  })

  it('EPS wage: no pension above the ceiling (post-1 Sept 2014 rule)', () => {
    const c = getEPFCeilings('2026-08-01', '2026-08-31')
    expect(getEPSWage(15000, c)).toBe(15000)
    expect(getEPSWage(20000, c)).toBe(0)
    const sep = getEPFCeilings('2026-09-01', '2026-09-30')
    // 20,000 qualifies only for the 14 days under the ₹25,000 ceiling.
    expect(getEPSWage(20000, sep)).toBeCloseTo((20000 * 14) / 30, 2)
  })
})

describe('computeEPF', () => {
  it('employee 12% on capped wage; employer split EPF/EPS/EDLI/admin', () => {
    const r = computeEPF({ pfWage: 15000, periodStart: '2026-08-01', periodEnd: '2026-08-31' })
    expect(r.employee).toBe(1800) // 12% × 15000
    expect(r.eps).toBe(1250) // 8.33% × 15000 = 1249.5 → half-up 1250
    expect(r.employerEpf).toBe(550) // 1800 − 1250
    expect(r.edli).toBe(75) // 0.5% × 15000
    expect(r.admin).toBe(75)
    expect(r.cappedWage).toBe(15000)
  })

  it('wage above ceiling: contribution caps, EPS drops to 0', () => {
    const r = computeEPF({ pfWage: 40000, periodStart: '2026-10-01', periodEnd: '2026-10-31' })
    expect(r.cappedWage).toBe(25000)
    expect(r.employee).toBe(3000) // 12% × 25000
    expect(r.eps).toBe(0)
    expect(r.employerEpf).toBe(3000)
    expect(r.edli).toBe(125)
    expect(r.admin).toBe(125)
  })

  it('no PF wage → zero everything', () => {
    const r = computeEPF({ pfWage: 0, periodStart: '2026-10-01' })
    expect(r).toMatchObject({ employee: 0, eps: 0, employerEpf: 0, edli: 0, admin: 0 })
  })
})

describe('computeESI', () => {
  it('employee 0.75% / employer 3.25% within the ₹21,000 ceiling', () => {
    const r = computeESI({ wage: 20000 })
    expect(r.covered).toBe(true)
    expect(r.ceiling).toBe(21000)
    expect(r.employee).toBeCloseTo(150, 2)
    expect(r.employer).toBeCloseTo(650, 2)
  })

  it('ceiling is inclusive; above it no coverage', () => {
    expect(computeESI({ wage: 21000 }).covered).toBe(true)
    expect(computeESI({ wage: 21001 }).covered).toBe(false)
    expect(computeESI({ wage: 30000 })).toMatchObject({ employee: 0, employer: 0 })
  })

  it('PwD ceiling is ₹25,000', () => {
    expect(computeESI({ wage: 23000, isDisabled: true }).covered).toBe(true)
    expect(computeESI({ wage: 23000 }).covered).toBe(false)
  })

  it('coverage judged on cycleGross while contribution follows paid wage', () => {
    const r = computeESI({ wage: 8000, cycleGross: 25000 })
    expect(r.covered).toBe(false)
    expect(r.employee).toBe(0)
  })
})

describe('computeProfessionalTax — monthly states', () => {
  it('Karnataka: 0 below 25k, ₹200 after, ₹300 in February', () => {
    expect(computeProfessionalTax({ state: 'Karnataka', gross: 20000, month: 1 })).toBe(0)
    expect(computeProfessionalTax({ state: 'Karnataka', gross: 30000, month: 1 })).toBe(200)
    expect(computeProfessionalTax({ state: 'Karnataka', gross: 30000, month: 2 })).toBe(300)
    expect(computeProfessionalTax({ state: 'Karnataka', gross: 30000, month: 12 })).toBe(200)
  })

  it('Maharashtra: slab + Feb-300 rule + women exemption ≤ 25,000', () => {
    expect(computeProfessionalTax({ state: 'Maharashtra', gross: 5000, month: 1 })).toBe(0)
    expect(computeProfessionalTax({ state: 'Maharashtra', gross: 9000, month: 1 })).toBe(175)
    expect(computeProfessionalTax({ state: 'Maharashtra', gross: 30000, month: 1 })).toBe(200)
    expect(computeProfessionalTax({ state: 'Maharashtra', gross: 30000, month: 2 })).toBe(300)
    expect(
      computeProfessionalTax({ state: 'Maharashtra', gross: 24000, month: 1, gender: 'Female' }),
    ).toBe(0)
    expect(
      computeProfessionalTax({ state: 'Maharashtra', gross: 24000, month: 1, gender: 'Male' }),
    ).toBe(200)
  })

  it('Odisha repealed from 1 April 2026 (revision with empty slabs)', () => {
    expect(
      computeProfessionalTax({ state: 'Odisha', gross: 30000, month: 6, asOf: '2026-03-15' }),
    ).toBe(200)
    expect(
      computeProfessionalTax({ state: 'Odisha', gross: 30000, month: 6, asOf: '2026-05-15' }),
    ).toBe(0)
  })

  it('West Bengal: pre-Oct-2026 slabs until the revision bites', () => {
    expect(
      computeProfessionalTax({ state: 'West Bengal', gross: 25000, month: 8, asOf: '2026-09-01' }),
    ).toBe(130)
    expect(
      computeProfessionalTax({ state: 'West Bengal', gross: 25000, month: 8, asOf: '2026-10-01' }),
    ).toBe(100)
    expect(
      computeProfessionalTax({ state: 'West Bengal', gross: 60000, month: 8, asOf: '2026-10-01' }),
    ).toBe(170)
  })

  it('unknown state or empty config → 0', () => {
    expect(computeProfessionalTax({ state: 'Bavaria', gross: 50000, month: 1 })).toBe(0)
    expect(computeProfessionalTax({ state: '', gross: 50000, month: 1 })).toBe(0)
  })
})

describe('computeProfessionalTax — half-yearly/yearly states', () => {
  it('Tamil Nadu accumulates over Apr–Sep and deducts the incremental slab', () => {
    // First month of the half-year: full slab on own gross.
    expect(
      computeProfessionalTax({ state: 'Tamil Nadu', gross: 45000, month: 5 }),
    ).toBe(425)
    // Next month: cumulative 90k → top slab 1250 due, 425 paid → 825 more.
    expect(
      computeProfessionalTax({
        state: 'Tamil Nadu',
        gross: 45000,
        month: 6,
        priorGross: 45000,
        priorDeducted: 425,
      }),
    ).toBe(825)
    // Cumulative 180k → top slab 1250 fully paid already → nothing more.
    expect(
      computeProfessionalTax({
        state: 'Tamil Nadu',
        gross: 45000,
        month: 8,
        priorGross: 135000,
        priorDeducted: 1250,
      }),
    ).toBe(0)
  })

  it('Bihar (yearly): PT kicks in only when cumulative crosses ₹3L', () => {
    // Cumulative 280k (Apr–Nov) → still in the 0 slab.
    expect(
      computeProfessionalTax({
        state: 'Bihar',
        gross: 40000,
        month: 11,
        priorGross: 240000,
      }),
    ).toBe(0)
    // Cumulative 360k → ₹1,000 due for the fiscal year, none paid yet.
    expect(
      computeProfessionalTax({
        state: 'Bihar',
        gross: 40000,
        month: 12,
        priorGross: 320000,
      }),
    ).toBe(1000)
    // Already paid → nothing more.
    expect(
      computeProfessionalTax({
        state: 'Bihar',
        gross: 40000,
        month: 1,
        priorGross: 360000,
        priorDeducted: 1000,
      }),
    ).toBe(0)
  })
})

describe('computeLWF', () => {
  it('monthly states deduct every month', () => {
    expect(computeLWF({ state: 'Haryana', month: 3 })).toEqual({ employee: 34, employer: 68 })
    expect(computeLWF({ state: 'Kerala', month: 1 })).toEqual({ employee: 50, employer: 50 })
  })

  it('half-yearly states only in June and December', () => {
    expect(computeLWF({ state: 'Maharashtra', month: 6 })).toEqual({ employee: 25, employer: 75 })
    expect(computeLWF({ state: 'Maharashtra', month: 12 })).toEqual({ employee: 25, employer: 75 })
    expect(computeLWF({ state: 'Maharashtra', month: 7 })).toBeNull()
    expect(computeLWF({ state: 'Delhi', month: 6 })).toEqual({ employee: 0.75, employer: 2.25 })
  })

  it('annual states only in December', () => {
    expect(computeLWF({ state: 'Karnataka', month: 12 })).toEqual({ employee: 50, employer: 100 })
    expect(computeLWF({ state: 'Karnataka', month: 11 })).toBeNull()
    expect(computeLWF({ state: 'Telangana', month: 12 })).toEqual({ employee: 2, employer: 5 })
  })

  it('state without LWF → null', () => {
    expect(computeLWF({ state: 'Uttar Pradesh', month: 6 })).toBeNull()
    expect(computeLWF({ state: '', month: 6 })).toBeNull()
  })
})

describe('computeIncomeTax — new regime, FY 2025-26 slabs', () => {
  it('nil tax up to ₹12L total income via 87A rebate', () => {
    const r = computeIncomeTax({ annualIncome: 1200000, regime: 'new' })
    expect(r.taxableIncome).toBe(1200000 - 75000) // standard deduction
    expect(r.totalTax).toBe(0)
  })

  it('₹15L: slabs + 4% cess', () => {
    const r = computeIncomeTax({ annualIncome: 1500000, regime: 'new' })
    // taxable 14,25,000 → 20k + 40k + 225k×15% = 93,750
    expect(r.baseTax).toBe(93750)
    expect(r.surcharge).toBe(0)
    expect(r.cess).toBeCloseTo(3750, 2)
    expect(r.totalTax).toBeCloseTo(97500, 2)
    expect(r.monthlyTDS).toBeCloseTo(8125, 2)
  })

  it('₹8L taxable income is below the rebate cliff → zero tax', () => {
    const r = computeIncomeTax({ annualIncome: 800000, regime: 'new' })
    expect(r.totalTax).toBe(0)
  })
})

describe('computeIncomeTax — old regime', () => {
  it('₹15L: old slabs + std deduction 50k + cess', () => {
    const r = computeIncomeTax({ annualIncome: 1500000, regime: 'old' })
    // taxable 14,50,000 → 12,500 + 1,00,000 + 1,35,000 = 247,500
    expect(r.baseTax).toBe(247500)
    expect(r.totalTax).toBeCloseTo(257400, 2)
  })

  it('old regime zero-tax cliff at ₹5L', () => {
    expect(computeIncomeTax({ annualIncome: 550000, regime: 'old' }).totalTax).toBe(0)
    expect(computeIncomeTax({ annualIncome: 700000, regime: 'old' }).totalTax).toBeGreaterThan(0)
  })
})

describe('computeIncomeTax — surcharge with marginal relief', () => {
  it('just above the ₹50L slab: relief caps the jump to the excess income', () => {
    // Taxable = income − 75,000 std deduction.
    const atThreshold = computeIncomeTax({ annualIncome: 5000000, regime: 'new' })
    expect(atThreshold.taxableIncome).toBe(4925000)
    expect(atThreshold.baseTax).toBe(1057500)
    expect(atThreshold.surcharge).toBe(0)

    const above = computeIncomeTax({ annualIncome: 5100000, regime: 'new' })
    // Taxable 50,25,000 → base 1,087,500; raw 10% surcharge = 108,750, but
    // relief caps total at tax@taxable-50L + excess income:
    //   1,080,000 + 25,000 = 1,105,000 → surcharge = 17,500.
    expect(above.baseTax).toBe(1087500)
    expect(above.surcharge).toBe(17500)
    expect(above.baseTax + above.surcharge).toBe(1105000)
    expect(above.totalTax).toBeCloseTo(1105000 * 1.04, 2)
  })

  it('no surcharge below the ₹50L taxable slab', () => {
    const r = computeIncomeTax({ annualIncome: 4900000, regime: 'new' })
    expect(r.surcharge).toBe(0)
    expect(r.cess).toBeCloseTo(r.baseTax * 0.04, 2)
  })
})
