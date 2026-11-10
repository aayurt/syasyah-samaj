/** AI Workspace — pure-function checks (no Payload, no network).
 *
 * Run: pnpm --filter @afno/billing test --run src/lib/ai/__checks__.test.ts
 */

import { describe, expect, it } from 'vitest'
import { AI_MODELS, modelDef } from './schemas'
import { validateAgainstModel } from './validate'

describe('AI Workspace model registry', () => {
  it('exposes the seven import models with required fields', () => {
    expect(AI_MODELS.map((m) => m.value)).toEqual([
      'gl-accounts',
      'opening-balances',
      'tax-types',
      'account-groups',
      'company-profile',
      'sub-companies',
      'fiscal-year',
    ])
    for (const m of AI_MODELS) {
      expect(typeof m.prompt).toBe('function')
      expect(m.prompt({ tenantName: 'Syasyah Samaj' })).toContain('{ "docs":')
      expect(m.required.length).toBeGreaterThan(0)
    }
    expect(modelDef('tax-types').label).toBe('Tax Types')
    expect(modelDef('company-profile').label).toBe('Company Profile')
    expect(modelDef('sub-companies').label).toBe('Sub-companies')
    expect(modelDef('fiscal-year').label).toBe('Fiscal Year')
  })
})

describe('validateAgainstModel', () => {
  const ctx = {
    tenantName: 'Syasyah Samaj',
    accounts: [{ code: '1101', name: 'Cash' }, { code: '1201', name: 'Bank' }],
  }

  it('accepts a valid chart of accounts', () => {
    const parsed = {
      docs: [
        { code: '1101', name: 'Cash', type: 'asset', class: 'cash', group: 'Bank & Cash', openingBalance: 50000, active: true },
      ],
    }
    const result = validateAgainstModel(parsed, 'gl-accounts', ctx)
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('rejects missing fields, bad enums and duplicate codes', () => {
    const parsed = {
      docs: [
        { code: '1101', name: 'Cash', type: 'asset', class: 'cash', group: 'G', openingBalance: 0, active: true },
        { name: 'Dup', type: 'asset', class: 'cash', group: 'G', openingBalance: 0, active: true }, // missing code + dup code below
        { code: '1101', name: 'Dup', type: 'bogus', class: 'cash', group: 'G', openingBalance: 0, active: true },
      ],
    }
    const result = validateAgainstModel(parsed, 'gl-accounts', ctx)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.field === 'code' && e.message.includes('Missing'))).toBe(true)
    expect(result.errors.some((e) => e.field === 'type' && e.message.includes('must be'))).toBe(true)
    expect(result.errors.some((e) => e.message.includes('Duplicate'))).toBe(true)
  })

  it('opening-balances requires accountCode to exist in chart of accounts', () => {
    const parsed = {
      docs: [{ accountCode: '9999', accountName: 'Ghost', fiscalYear: '2026-27', amount: 100 }],
    }
    const result = validateAgainstModel(parsed, 'opening-balances', ctx)
    expect(result.valid).toBe(false)
    expect(result.warnings.some((w) => w.field === 'accountCode' && w.message.includes('not found'))).toBe(true)
    expect(result.errors.some((e) => e.field === 'amount' && e.message.includes('number'))).toBe(false)
  })

  it('rejects non-object root and empty docs', () => {
    expect(validateAgainstModel([1, 2], 'gl-accounts', ctx).valid).toBe(false)
    expect(validateAgainstModel({ docs: [] }, 'gl-accounts', ctx).valid).toBe(false)
    expect(validateAgainstModel('not json', 'gl-accounts', ctx).valid).toBe(false)
  })

  it('tax-types validates sales/purchase enum and numeric rate', () => {
    const parsed = { docs: [{ name: 'VAT', type: 'sales', rate: 13, active: true }] }
    expect(validateAgainstModel(parsed, 'tax-types', ctx).valid).toBe(true)
    const bad = { docs: [{ name: 'VAT', type: 'import', rate: 'high', active: true }] }
    expect(validateAgainstModel(bad, 'tax-types', ctx).valid).toBe(false)
  })

  it('account-groups validates debit/credit nature', () => {
    const parsed = { docs: [{ name: 'Banks', type: 'asset', nature: 'debit', active: true }] }
    expect(validateAgainstModel(parsed, 'account-groups', ctx).valid).toBe(true)
    const bad = { docs: [{ name: 'Banks', type: 'asset', nature: 'sideways', active: true }] }
    expect(validateAgainstModel(bad, 'account-groups', ctx).valid).toBe(false)
  })

  it('company-profile requires companyName', () => {
    const good = { docs: [{ companyName: 'Syasyah Samaj', companyPan: '603774469' }] }
    expect(validateAgainstModel(good, 'company-profile', ctx).valid).toBe(true)
    const bad = { docs: [{ companyPan: '603774469' }] }
    const result = validateAgainstModel(bad, 'company-profile', ctx)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.field === 'companyName')).toBe(true)
  })

  it('sub-companies validates required name/code, optional active', () => {
    const good = { docs: [{ name: 'Illaka A', code: 'ILLAKA-A', slug: 'illaka-a', active: true }] }
    expect(validateAgainstModel(good, 'sub-companies', ctx).valid).toBe(true)

    const badName = { docs: [{ code: 'ILLAKA-A' }] }
    const r1 = validateAgainstModel(badName, 'sub-companies', ctx)
    expect(r1.valid).toBe(false)
    expect(r1.errors.some((e) => e.field === 'name')).toBe(true)

    const badCode = { docs: [{ name: 'Illaka A' }] }
    const r2 = validateAgainstModel(badCode, 'sub-companies', ctx)
    expect(r2.valid).toBe(false)
    expect(r2.errors.some((e) => e.field === 'code')).toBe(true)

    const badActive = { docs: [{ name: 'Illaka A', code: 'ILLAKA-A', active: 'yes' }] }
    const r3 = validateAgainstModel(badActive, 'sub-companies', ctx)
    expect(r3.valid).toBe(false)
    expect(r3.errors.some((e) => e.field === 'active')).toBe(true)
  })

  it('fiscal-year requires label/startDate/endDate and validates status enum', () => {
    const good = { docs: [{ label: '2026-27', startDate: '2026-04-01', endDate: '2027-03-31', status: 'active' }] }
    expect(validateAgainstModel(good, 'fiscal-year', ctx).valid).toBe(true)
    const bad = { docs: [{ startDate: '2026-04-01', endDate: '2027-03-31' }] }
    let result = validateAgainstModel(bad, 'fiscal-year', ctx)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.field === 'label')).toBe(true)
    const badStatus = { docs: [{ label: '2026-27', startDate: '2026-04-01', endDate: '2027-03-31', status: 'bogus' }] }
    result = validateAgainstModel(badStatus, 'fiscal-year', ctx)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.field === 'status')).toBe(true)
  })
})
