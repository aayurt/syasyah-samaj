/**
 * Unit tests for payroll calculation utilities.
 *
 * Pure functions — no Payload, no DB — runnable with vitest.
 *
 *   pnpm --filter @afno/billing test --run src/lib/__tests__/payrollCalcUtils.test.ts
 */
import { describe, it, expect } from 'vitest'
import {
  computePeriodDayCounts,
  countDays,
  listDates,
  weekendDaysInRange,
  perDay,
} from '../payroll/payrollDays'
import {
  resolveMethod,
  applyMethod,
  calculateElement,
} from '../payroll/calcEngine'
import {
  computeCompletedMonths,
  prorateByDays,
  computePayableWorkingDays,
  computePayableDays,
} from '../payroll/prorationEngine'
import {
  calculateNepalStatutory,
  calculateSSF,
  calculatePF,
  calculateAnnualTax,
} from '../payroll/taxCalculator'

describe('payrollDays', () => {
  it('countDays counts inclusive days', () => {
    expect(countDays('2026-01-01', '2026-01-01')).toBe(1)
    expect(countDays('2026-01-01', '2026-01-07')).toBe(7)
  })

  it('listDates returns every date inclusive', () => {
    expect(listDates('2026-01-01', '2026-01-03')).toEqual([
      '2026-01-01',
      '2026-01-02',
      '2026-01-03',
    ])
  })

  it('weekendDaysInRange counts Sat+Sun by default', () => {
    expect(weekendDaysInRange('2026-01-01', '2026-01-07')).toBe(2)
  })

  it('computePeriodDayCounts: total − weekend − holiday = working', () => {
    const c = computePeriodDayCounts('2026-01-01', '2026-01-07', {
      publicHolidays: ['2026-01-01'],
    })
    expect(c.totalDays).toBe(7)
    expect(c.weekendDays).toBe(2)
    expect(c.publicHolidayDays).toBe(1)
    expect(c.workingDays).toBe(4)
    expect(c.workingAdDates).toHaveLength(4)
  })

  it('perDay divides and rounds', () => {
    expect(perDay(1000, 30)).toBeCloseTo(33.33, 2)
    expect(perDay(100, 0)).toBe(0)
  })
})

describe('calcEngine', () => {
  const ctx = {
    workingDays: 22,
    totalDays: 30,
    weekendDays: 8,
    publicHolidayDays: 0,
    payableWorkingDays: 22,
    payableDays: 30,
    unpaidLeaveDays: 0,
    absenceDays: 0,
    joinerDays: 0,
    leaverDays: 0,
    prorateJoiner: true,
    prorateLeaver: true,
    prorateUnpaidLeave: true,
  }

  it('resolveMethod: element override wins over setup default', () => {
    const m = resolveMethod(
      { code: 'BASIC', name: 'Basic', type: 'earning', amount: 1000, methodCode: 'PRORATE_WORKING_DAYS' },
      { code: 'FIXED_AMOUNT', name: 'Fixed' },
    )
    expect(m.code).toBe('PRORATE_WORKING_DAYS')
  })

  it('resolveMethod: adjustment always FIXED_AMOUNT', () => {
    const m = resolveMethod(
      { code: 'ADJUSTMENT', name: 'Adjustment', type: 'deduction', amount: 500, methodCode: 'PRORATE_WORKING_DAYS' },
      { code: 'PRORATE_WORKING_DAYS', name: 'Prorate' },
    )
    expect(m.code).toBe('FIXED_AMOUNT')
  })

  it('applyMethod: FIXED_AMOUNT returns full value', () => {
    const r = applyMethod(1000, { code: 'FIXED_AMOUNT', name: 'Fixed' }, ctx)
    expect(r.value).toBe(1000)
  })

  it('applyMethod: PRORATE_WORKING_DAYS scales by payable/working', () => {
    const r = applyMethod(1000, { code: 'PRORATE_WORKING_DAYS', name: 'Prorate' }, {
      ...ctx,
      payableWorkingDays: 11,
    })
    expect(r.value).toBeCloseTo(500, 0)
  })

  it('applyMethod: PRORATE_COMPLETED_MONTHS scales by months/annual', () => {
    const r = applyMethod(1200, { code: 'PRORATE_COMPLETED_MONTHS', name: 'Completed Months' }, {
      ...ctx,
      completedMonths: 3,
      annualMonths: 12,
    })
    expect(r.value).toBe(300)
  })

  it('calculateElement: deduction adjustment is fixed even with prorate method', () => {
    const r = calculateElement(
      { code: 'ADJUSTMENT', name: 'Adjustment', type: 'deduction', amount: 500, methodCode: 'PRORATE_WORKING_DAYS' },
      { code: 'PRORATE_WORKING_DAYS', name: 'Prorate' },
      ctx,
    )
    expect(r.methodCode).toBe('FIXED_AMOUNT')
    expect(r.proratedValue).toBe(500)
  })
})

describe('prorationEngine', () => {
  it('computeCompletedMonths: full period = 1 month', () => {
    const r = computeCompletedMonths({
      joiningDate: '2026-01-01',
      leavingDate: null,
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
      rule: 'FULL_CALENDAR_MONTH',
    })
    expect(r.completedMonths).toBe(1)
    expect(r.isFullMonth).toBe(true)
  })

  it('computeCompletedMonths: joined after period start = 0', () => {
    const r = computeCompletedMonths({
      joiningDate: '2026-01-15',
      leavingDate: null,
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
      rule: 'FULL_CALENDAR_MONTH',
    })
    expect(r.completedMonths).toBe(0)
    expect(r.isFullMonth).toBe(false)
  })

  it('prorateByDays: half days = half amount', () => {
    expect(prorateByDays(1000, 15, 30)).toBe(500)
  })

  it('computePayableWorkingDays: working − leave − absence − gaps', () => {
    expect(computePayableWorkingDays({
      workingDays: 22,
      totalDays: 30,
      unpaidLeaveDays: 2,
      absenceDays: 1,
      joinerDays: 3,
      leaverDays: 2,
    })).toBe(14)
  })

  it('computePayableDays: floors at 0', () => {
    expect(computePayableDays({
      totalDays: 30,
      weekendDays: 8,
      publicHolidayDays: 2,
      unpaidLeaveDays: 10,
      absenceDays: 5,
      joinerDays: 3,
      leaverDays: 2,
    })).toBe(0)
  })
})

describe('taxCalculator (Nepal)', () => {
  it('calculateSSF: 11% of basic when enabled', () => {
    expect(calculateSSF(10000, true)).toBe(1100)
    expect(calculateSSF(10000, false)).toBe(0)
    expect(calculateSSF(5000, true)).toBe(0)
  })

  it('calculatePF: 10% of basic when enabled', () => {
    expect(calculatePF(10000, true)).toBe(1000)
    expect(calculatePF(10000, false)).toBe(0)
  })

  it('calculateAnnualTax: first slab 1% up to 500k', () => {
    // 50000*12 = 600000 − 500000 std deduction = 100000 → 1% = 1000
    expect(calculateAnnualTax(50000, 12, true)).toBeCloseTo(1000, 0)
  })

  it('calculateNepalStatutory: SSF takes precedence over PF', () => {
    const r = calculateNepalStatutory(
      { basicSalary: 10000, grossSalary: 10000 },
      { ssfEnabled: true, pfEnabled: true, citEnabled: false },
    )
    expect(r.ssfEmployee).toBe(1100)
    expect(r.pfEmployee).toBe(0)
    expect(r.ssfEmployer).toBe(1100)
    expect(r.netSalary).toBe(8900)
  })

  it('calculateNepalStatutory: CIT on gross above standard deduction', () => {
    const r = calculateNepalStatutory(
      { basicSalary: 50000, grossSalary: 50000, payPeriodsInYear: 12 },
      { ssfEnabled: false, pfEnabled: false, citEnabled: true },
    )
    expect(r.annualTaxableIncome).toBe(100000)
    expect(r.citMonthly).toBeGreaterThan(0)
  })
})
