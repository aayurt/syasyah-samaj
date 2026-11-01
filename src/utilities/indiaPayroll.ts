import { round2 } from './journalValidation'

/**
 * India payroll statutory engine — a faithful TypeScript port of the
 * frappe/india-payroll computation modules:
 *
 *   epf.py              S.O. 5109(E) wage ceilings (₹15,000 → ₹25,000 from
 *                       17 Sept 2026), day-weighted split for straddling
 *                       periods, EPFO half-up rounding, post-1 Sept 2014 EPS
 *                       rule (no pension above the ceiling).
 *   esi.py              0.75 % / 3.25 % split, ₹21,000 ceiling (₹25,000 PwD),
 *                       coverage judged on the cycle wage.
 *   professional_tax.py State slabs with revisions, the February ₹300 rule,
 *                       half-yearly/yearly incremental deduction, women's
 *                       exemption (Maharashtra).
 *   lwf.py              State Labour Welfare Fund amounts + deduction months.
 *   income_tax_utils.py New/old regime slabs (FY 2025-26), 87A rebate,
 *                       surcharge with marginal relief, 4 % cess.
 *
 * All money math is pure — no Payload, no DB — so the same functions serve
 * the payroll-runs generate endpoint, the statutory register reports, and
 * unit tests.
 */

/* ───────────────────────── EPF (epf.py) ───────────────────────── */

export const EPF_WAGE_CEILING = 25_000 // S.O. 5109(E)
export const EPF_PREVIOUS_WAGE_CEILING = 15_000
/** Day the revised ceiling takes effect. */
export const EPF_WAGE_CEILING_REVISED_ON = '2026-09-17'
export const EPF_EMPLOYEE_RATE = 0.12
export const EPS_RATE = 0.0833
export const EDLI_RATE = 0.005
export const EPF_ADMIN_RATE = 0.005

/**
 * EPFO rounds to the nearest rupee, half-up — never Python's banker's
 * rounding (EPS 8.33 % × 15,000 = 1249.5 must become ₹1,250).
 */
export function epfoRound(amount: number): number {
  const a = Number(amount) || 0
  return a >= 0 ? Math.floor(a + 0.5) : -Math.floor(-a + 0.5)
}

const PF_WAGE_RE = /\b(basic|dearness|da)\b/
const ESI_WAGE_RE = /\b(basic|dearness|da|retaining|ra)\b/

function normalise(label: string | null | undefined): string {
  if (!label) return ''
  return label.toLowerCase().replace(/\./g, '').replace(/[^a-z0-9]+/g, ' ')
}

/**
 * Heuristic wage-component matchers, exactly as frappe ports them: a name
 * reads as Basic/Dearness Allowance when the normalised label matches.
 */
export function isPFWageComponent(label: string | null | undefined): boolean {
  return PF_WAGE_RE.test(normalise(label))
}

export function isESIWageComponent(label: string | null | undefined): boolean {
  return ESI_WAGE_RE.test(normalise(label))
}

/**
 * PF wage = Basic + Dearness-matching earnings; ESI wage adds Retaining/RA.
 * The basic salary always counts as Basic.
 */
export function computeStatutoryWages(
  basic: number,
  allowances: Array<{ label?: string; amount?: number | string | null }>,
): { pfWage: number; esiWage: number } {
  let pfWage = round2(Number(basic) || 0)
  let esiWage = round2(Number(basic) || 0)
  for (const a of allowances || []) {
    const amount = round2(Number(a.amount) || 0)
    if (isPFWageComponent(a.label)) pfWage = round2(pfWage + amount)
    if (isESIWageComponent(a.label)) esiWage = round2(esiWage + amount)
  }
  return { pfWage, esiWage }
}

/** (ceiling, share-of-days) pairs in force over a pay period. */
export type EPFCeilings = Array<[number, number]>

function utcDate(iso: string): number {
  return Date.parse(iso + 'T00:00:00Z')
}

function daysInclusive(fromIso: string, toIso: string): number {
  return Math.round((utcDate(toIso) - utcDate(fromIso)) / 86_400_000) + 1
}

/**
 * Ceilings in force over a pay period. A period straddling 17 Sept 2026 is
 * split by calendar days: September 2026 → [(15 000, 16/30), (25 000, 14/30)].
 */
export function getEPFCeilings(
  periodStart: string,
  periodEnd?: string,
): EPFCeilings {
  const start = periodStart
  const end = periodEnd || periodStart
  const revised = utcDate(EPF_WAGE_CEILING_REVISED_ON)
  if (utcDate(start) >= revised) return [[EPF_WAGE_CEILING, 1]]
  if (utcDate(end) < revised) return [[EPF_PREVIOUS_WAGE_CEILING, 1]]
  const total = daysInclusive(start, end)
  const revisedDays = daysInclusive(EPF_WAGE_CEILING_REVISED_ON, end)
  return [
    [EPF_PREVIOUS_WAGE_CEILING, (total - revisedDays) / total],
    [EPF_WAGE_CEILING, revisedDays / total],
  ]
}

/**
 * Cap the PF wage under each ceiling separately, weighted by days —
 * 20,000 in September 2026 → 15,000×16/30 + 20,000×14/30 = 17,333.33,
 * not min(20,000, weighted-average-ceiling) = 19,666.67.
 */
export function capPFWage(pfWage: number, ceilings: EPFCeilings): number {
  const wage = Number(pfWage) || 0
  return round2(
    ceilings.reduce(
      (sum, [ceiling, share]) => sum + Math.min(wage, ceiling) * share,
      0,
    ),
  )
}

/**
 * EPS wage: post-1 Sept 2014 members whose PF wage exceeds the ceiling get
 * no pension on the excess — only days under a ceiling that covers the wage
 * contribute.
 */
export function getEPSWage(pfWage: number, ceilings: EPFCeilings): number {
  const wage = Number(pfWage) || 0
  return round2(
    ceilings.reduce(
      (sum, [ceiling, share]) => (wage <= ceiling ? sum + wage * share : sum),
      0,
    ),
  )
}

export interface EPFSplit {
  /** PF wage after day-weighted capping. */
  cappedWage: number
  employee: number
  /** Employer pension diversion (8.33 %). */
  eps: number
  /** Employer EPF share (12 % − EPS). */
  employerEpf: number
  edli: number
  admin: number
}

/**
 * Full canonical EPF split for a period — employee deduction plus the
 * employer EPF/EPS/EDLI/admin breakdown the EPF register and ECR expect.
 */
export function computeEPF(input: {
  pfWage: number
  periodStart: string
  periodEnd?: string
}): EPFSplit {
  const ceilings = getEPFCeilings(input.periodStart, input.periodEnd)
  const capped = capPFWage(input.pfWage, ceilings)
  const epsWage = getEPSWage(input.pfWage, ceilings)
  const total = epfoRound(capped * EPF_EMPLOYEE_RATE)
  const eps = epfoRound(epsWage * EPS_RATE)
  return {
    cappedWage: capped,
    employee: total,
    eps,
    employerEpf: total - eps,
    edli: epfoRound(capped * EDLI_RATE),
    admin: epfoRound(capped * EPF_ADMIN_RATE),
  }
}

/* ───────────────────────── ESI (esi.py) ───────────────────────── */

export const EMPLOYEE_ESI_RATE = 0.0075
export const EMPLOYER_ESI_RATE = 0.0325
export const ESI_WAGE_CEILING = 21_000
export const ESI_WAGE_CEILING_DISABILITY = 25_000

export interface ESISplit {
  covered: boolean
  ceiling: number
  employee: number
  employer: number
}

/**
 * Split ESI on the ESI wage. `cycleGross` (the full-cycle wage) judges
 * coverage when it differs from the paid wage, so an LOP month cannot pull
 * a high earner into ESI.
 */
export function computeESI(input: {
  wage: number
  cycleGross?: number
  isDisabled?: boolean
}): ESISplit {
  const wage = round2(Number(input.wage) || 0)
  const ceiling = input.isDisabled
    ? ESI_WAGE_CEILING_DISABILITY
    : ESI_WAGE_CEILING
  const judged = round2(
    Number(input.cycleGross ?? input.wage ?? 0) || 0,
  )
  const covered = judged <= ceiling && wage > 0
  if (!covered) {
    return { covered: false, ceiling, employee: 0, employer: 0 }
  }
  return {
    covered: true,
    ceiling,
    employee: round2(wage * EMPLOYEE_ESI_RATE),
    employer: round2(wage * EMPLOYER_ESI_RATE),
  }
}

/* ────────── Professional Tax (professional_tax.py) ────────── */

interface PTSlab {
  upto: number | null
  amount: number
  month_amounts?: Record<number, number>
}

export interface StatePTConfig {
  frequency: 'monthly' | 'half-yearly' | 'yearly'
  slabs: PTSlab[]
  revisions?: Array<{ effective_from: string; slabs: PTSlab[] }>
  special_rules?: { women_exemption_upto?: number }
}

/**
 * State-wise PT configuration, ported verbatim from frappe's
 * professional_tax.py (including the Odisha repeal from 1 April 2026 and the
 * West Bengal revision from 1 October 2026).
 */
export const STATE_PT_CONFIG: Record<string, StatePTConfig> = {
  'Andhra Pradesh': {
    frequency: 'monthly',
    slabs: [
      { upto: 15000, amount: 0 },
      { upto: 20000, amount: 150 },
      { upto: null, amount: 200 },
    ],
  },
  Assam: {
    frequency: 'monthly',
    slabs: [
      { upto: 15000, amount: 0 },
      { upto: 25000, amount: 180 },
      { upto: null, amount: 208 },
    ],
  },
  Gujarat: {
    frequency: 'monthly',
    slabs: [
      { upto: 11999, amount: 0 },
      { upto: null, amount: 200 },
    ],
  },
  Jharkhand: {
    frequency: 'monthly',
    slabs: [
      { upto: 25000, amount: 0 },
      { upto: 41666, amount: 100 },
      { upto: 66666, amount: 150 },
      { upto: 83333, amount: 175 },
      { upto: null, amount: 208, month_amounts: { 3: 212 } },
    ],
  },
  Karnataka: {
    frequency: 'monthly',
    slabs: [
      { upto: 24999, amount: 0 },
      { upto: null, amount: 200, month_amounts: { 2: 300 } },
    ],
  },
  'Madhya Pradesh': {
    frequency: 'monthly',
    slabs: [
      { upto: 18750, amount: 0 },
      { upto: 25000, amount: 125 },
      { upto: 33333, amount: 166, month_amounts: { 3: 174 } },
      { upto: null, amount: 208, month_amounts: { 3: 212 } },
    ],
  },
  Maharashtra: {
    frequency: 'monthly',
    // 11 × ₹200 + February ₹300 = ₹2,500 constitutional cap.
    slabs: [
      { upto: 7500, amount: 0 },
      { upto: 10000, amount: 175 },
      { upto: null, amount: 200, month_amounts: { 2: 300 } },
    ],
    special_rules: { women_exemption_upto: 25000 },
  },
  Meghalaya: {
    frequency: 'monthly',
    slabs: [
      { upto: 4166, amount: 0 },
      { upto: 6250, amount: 16 },
      { upto: 8333, amount: 25 },
      { upto: 12500, amount: 41 },
      { upto: 16666, amount: 62 },
      { upto: 20833, amount: 83 },
      { upto: 25000, amount: 104 },
      { upto: 29166, amount: 125 },
      { upto: 33333, amount: 150 },
      { upto: 37500, amount: 175 },
      { upto: 41666, amount: 200 },
      { upto: null, amount: 208 },
    ],
  },
  Odisha: {
    frequency: 'monthly',
    slabs: [
      { upto: 13333, amount: 0 },
      { upto: 25000, amount: 125 },
      { upto: null, amount: 200, month_amounts: { 3: 300 } },
    ],
    // Professional Tax repealed in Odisha from 1 April 2026.
    revisions: [{ effective_from: '2026-04-01', slabs: [] }],
  },
  Sikkim: {
    frequency: 'monthly',
    slabs: [
      { upto: 20000, amount: 0 },
      { upto: 30000, amount: 125 },
      { upto: 40000, amount: 150 },
      { upto: null, amount: 200 },
    ],
  },
  Telangana: {
    frequency: 'monthly',
    slabs: [
      { upto: 15000, amount: 0 },
      { upto: 20000, amount: 150 },
      { upto: null, amount: 200 },
    ],
  },
  Tripura: {
    frequency: 'monthly',
    slabs: [
      { upto: 7500, amount: 0 },
      { upto: 15000, amount: 150 },
      { upto: null, amount: 208 },
    ],
  },
  'West Bengal': {
    frequency: 'monthly',
    slabs: [
      { upto: 10000, amount: 0 },
      { upto: 15000, amount: 110 },
      { upto: 25000, amount: 130 },
      { upto: 40000, amount: 150 },
      { upto: null, amount: 200 },
    ],
    revisions: [
      {
        effective_from: '2026-10-01',
        slabs: [
          { upto: 20000, amount: 0 },
          { upto: 30000, amount: 100 },
          { upto: 50000, amount: 140 },
          { upto: 100000, amount: 170 },
          { upto: null, amount: 208 },
        ],
      },
    ],
  },
  'Tamil Nadu': {
    frequency: 'half-yearly',
    slabs: [
      { upto: 21000, amount: 0 },
      { upto: 30000, amount: 180 },
      { upto: 45000, amount: 425 },
      { upto: 60000, amount: 930 },
      { upto: 75000, amount: 1025 },
      { upto: null, amount: 1250 },
    ],
  },
  Kerala: {
    frequency: 'half-yearly',
    slabs: [
      { upto: 11999, amount: 0 },
      { upto: 17999, amount: 320 },
      { upto: 29999, amount: 450 },
      { upto: 44999, amount: 600 },
      { upto: 99999, amount: 750 },
      { upto: 124999, amount: 1000 },
      { upto: null, amount: 1250 },
    ],
  },
  Bihar: {
    frequency: 'yearly',
    slabs: [
      { upto: 300000, amount: 0 },
      { upto: 500000, amount: 1000 },
      { upto: 1000000, amount: 2000 },
      { upto: null, amount: 2500 },
    ],
  },
}

/** State config with the revision in force on `asOf` applied. */
function getPTConfig(state: string, asOf: string): StatePTConfig | null {
  const base = STATE_PT_CONFIG[state]
  if (!base) return null
  const applicable = (base.revisions || []).filter(
    (r) => utcDate(r.effective_from) <= utcDate(asOf),
  )
  if (applicable.length === 0) return base
  const latest = applicable.reduce((a, b) =>
    utcDate(a.effective_from) >= utcDate(b.effective_from) ? a : b,
  )
  return { ...base, ...latest }
}

/** First slab whose `upto` is unbounded or ≥ salary, with month override. */
function slabAmount(salary: number, slabs: PTSlab[], month?: number): number {
  for (const slab of slabs) {
    if (slab.upto === null || salary <= slab.upto) {
      const override = month != null ? slab.month_amounts?.[month] : undefined
      return override ?? slab.amount
    }
  }
  return 0
}

/**
 * Professional Tax for one pay period.
 *
 * Monthly states: slab on the month's gross (with month overrides and the
 * Maharashtra women's exemption). Half-yearly/yearly states accumulate:
 * the caller passes the prior gross and PT already deducted inside the
 * period; we deduct the incremental slab amount, never below zero.
 */
export function computeProfessionalTax(input: {
  state: string
  gross: number
  /** Month 1–12 of the pay period start. */
  month: number
  gender?: string
  /** Period date for revision lookup (YYYY-MM-DD); defaults to today. */
  asOf?: string
  /** Cumulative gross already paid inside a half-year/yearly period. */
  priorGross?: number
  /** PT already deducted inside a half-year/yearly period. */
  priorDeducted?: number
}): number {
  const asOf = input.asOf || new Date().toISOString().slice(0, 10)
  const config = getPTConfig(input.state, asOf)
  if (!config || config.slabs.length === 0) return 0
  const gross = round2(Number(input.gross) || 0)

  if (config.frequency === 'monthly') {
    const womenUpto = config.special_rules?.women_exemption_upto
    if (
      womenUpto != null &&
      input.gender === 'Female' &&
      gross <= womenUpto
    ) {
      return 0
    }
    return round2(slabAmount(gross, config.slabs, input.month))
  }

  // Half-yearly / yearly: incremental deduction on the cumulative wage.
  const cumulative = round2((Number(input.priorGross) || 0) + gross)
  const totalDue = round2(slabAmount(cumulative, config.slabs))
  return Math.max(0, round2(totalDue - (Number(input.priorDeducted) || 0)))
}

/* ─────────────────── LWF (lwf.py) ─────────────────── */

interface LWFConfig {
  employee: number
  employer: number
  frequency: 'monthly' | 'half-yearly' | 'annual'
}

export const LWF_STATE_CONFIG: Record<string, LWFConfig> = {
  Haryana: { employee: 34, employer: 68, frequency: 'monthly' },
  Kerala: { employee: 50, employer: 50, frequency: 'monthly' },
  Punjab: { employee: 5, employer: 20, frequency: 'monthly' },
  Chandigarh: { employee: 5, employer: 20, frequency: 'monthly' },
  Chhattisgarh: { employee: 15, employer: 45, frequency: 'half-yearly' },
  Delhi: { employee: 0.75, employer: 2.25, frequency: 'half-yearly' },
  Goa: { employee: 60, employer: 180, frequency: 'half-yearly' },
  Gujarat: { employee: 6, employer: 12, frequency: 'half-yearly' },
  'Madhya Pradesh': { employee: 10, employer: 30, frequency: 'half-yearly' },
  Maharashtra: { employee: 25, employer: 75, frequency: 'half-yearly' },
  Odisha: { employee: 20, employer: 40, frequency: 'half-yearly' },
  'West Bengal': { employee: 3, employer: 30, frequency: 'half-yearly' },
  'Andhra Pradesh': { employee: 30, employer: 70, frequency: 'annual' },
  Karnataka: { employee: 50, employer: 100, frequency: 'annual' },
  'Tamil Nadu': { employee: 20, employer: 40, frequency: 'annual' },
  Telangana: { employee: 2, employer: 5, frequency: 'annual' },
}

/**
 * LWF deduction for a month, or null when the month is not a deduction
 * month for that state's frequency (half-yearly → June + December,
 * annual → December only) or the state has no LWF.
 */
export function computeLWF(input: {
  state: string
  month: number
}): { employee: number; employer: number } | null {
  const config = LWF_STATE_CONFIG[input.state]
  if (!config) return null
  const { frequency } = config
  const isDue =
    frequency === 'monthly' ||
    (frequency === 'half-yearly' && (input.month === 6 || input.month === 12)) ||
    (frequency === 'annual' && input.month === 12)
  if (!isDue) return null
  return { employee: config.employee, employer: config.employer }
}

/* ────── Income tax / TDS (income_tax_utils.py + slabs) ────── */

export type TaxRegime = 'new' | 'old'

interface TaxSlab {
  upto: number | null
  rate: number
}

/** FY 2025-26 slabs — new regime (post-Budget 2025) and old regime. */
export const NEW_REGIME_SLABS: TaxSlab[] = [
  { upto: 400000, rate: 0 },
  { upto: 800000, rate: 0.05 },
  { upto: 1200000, rate: 0.1 },
  { upto: 1600000, rate: 0.15 },
  { upto: 2000000, rate: 0.2 },
  { upto: 2400000, rate: 0.25 },
  { upto: null, rate: 0.3 },
]

export const OLD_REGIME_SLABS: TaxSlab[] = [
  { upto: 250000, rate: 0 },
  { upto: 500000, rate: 0.05 },
  { upto: 1000000, rate: 0.2 },
  { upto: null, rate: 0.3 },
]

export const STANDARD_DEDUCTION: Record<TaxRegime, number> = {
  new: 75000,
  old: 50000,
}

/** 87A rebate: new regime ₹60,000 up to ₹12L taxable; old ₹12,500 up to ₹5L. */
export const REBATE_87A: Record<TaxRegime, { limit: number; max: number }> = {
  new: { limit: 1200000, max: 60000 },
  old: { limit: 500000, max: 12500 },
}

export const HEALTH_AND_EDUCATION_CESS = 0.04

interface SurchargeTier {
  min: number
  rate: number
}

/** Surcharge tiers; the new regime caps at 25 %. */
const SURCHARGE_TIERS: Record<TaxRegime, SurchargeTier[]> = {
  new: [
    { min: 5000000, rate: 0.1 },
    { min: 10000000, rate: 0.15 },
    { min: 20000000, rate: 0.25 },
  ],
  old: [
    { min: 5000000, rate: 0.1 },
    { min: 10000000, rate: 0.15 },
    { min: 20000000, rate: 0.25 },
    { min: 50000000, rate: 0.37 },
  ],
}

function slabTax(income: number, slabs: TaxSlab[]): number {
  let tax = 0
  let prev = 0
  for (const slab of slabs) {
    const upper = slab.upto ?? Infinity
    if (income > prev) {
      tax += (Math.min(income, upper) - prev) * slab.rate
    }
    prev = upper
    if (income <= upper) break
  }
  return tax
}

export interface IncomeTaxResult {
  taxableIncome: number
  baseTax: number
  rebate: number
  surcharge: number
  cess: number
  totalTax: number
  /** Monthly TDS instalment (annual ÷ 12). */
  monthlyTDS: number
}

/**
 * Annual income tax for one employee: slab tax on (income − standard
 * deduction), 87A rebate, surcharge with marginal relief, 4 % cess.
 * This is the projection used for monthly TDS — not a substitute for the
 * year-end computation with declarations.
 */
export function computeIncomeTax(input: {
  annualIncome: number
  regime: TaxRegime
}): IncomeTaxResult {
  const regime: TaxRegime = input.regime === 'old' ? 'old' : 'new'
  const slabs = regime === 'new' ? NEW_REGIME_SLABS : OLD_REGIME_SLABS
  const taxable = Math.max(
    0,
    round2((Number(input.annualIncome) || 0) - STANDARD_DEDUCTION[regime]),
  )

  let baseTax = round2(slabTax(taxable, slabs))

  // 87A rebate — only while taxable income stays under the limit.
  const rebateRule = REBATE_87A[regime]
  const rebate =
    taxable <= rebateRule.limit ? Math.min(baseTax, rebateRule.max) : 0
  baseTax = round2(baseTax - rebate)

  // Surcharge with marginal relief: the tax plus surcharge above a tier
  // can never exceed the tax at the threshold plus the excess income.
  let surcharge = 0
  const tiers = SURCHARGE_TIERS[regime]
  const tier = [...tiers].reverse().find((t) => taxable >= t.min)
  if (tier && baseTax > 0) {
    const tierIndex = tiers.indexOf(tier)
    const prevRate = tierIndex > 0 ? (tiers[tierIndex - 1]?.rate ?? 0) : 0
    const raw = round2(baseTax * tier.rate)
    const taxAtThreshold = round2(slabTax(tier.min, slabs))
    const totalAtThreshold = round2(taxAtThreshold * (1 + prevRate))
    const excessIncome = taxable - tier.min
    const excessTax = baseTax + raw - totalAtThreshold
    surcharge =
      excessTax <= excessIncome
        ? raw
        : Math.max(0, round2(raw - (excessTax - excessIncome)))
  }

  const cess = round2((baseTax + surcharge) * HEALTH_AND_EDUCATION_CESS)
  const totalTax = round2(baseTax + surcharge + cess)
  return {
    taxableIncome: taxable,
    baseTax,
    rebate: round2(rebate),
    surcharge,
    cess,
    totalTax,
    monthlyTDS: round2(totalTax / 12),
  }
}
