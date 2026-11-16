import {
  validateAccountData,
  validateOpeningBatch,
} from './accountingValidation'

const postableAccount = { accountId: 101, isPosting: true, isActive: true, amount: 1000 }
const creditAccount = { accountId: 102, isPosting: true, isActive: true, amount: -1000 }

describe('Opening Balance Workflow — validateOpeningBatch', () => {
  it('accepts a balanced batch', () => {
    const result = validateOpeningBatch({
      lines: [postableAccount, creditAccount],
      fiscalYearStatus: 'open',
      postingAllowed: true,
    })
    expect(result.valid).toBe(true)
    expect(result.issues).toHaveLength(0)
  })

  it('rejects an unbalanced batch (debits ≠ credits)', () => {
    const result = validateOpeningBatch({
      lines: [{ accountId: 101, amount: 1000 }, { accountId: 102, amount: -500 }],
      fiscalYearStatus: 'open',
    })
    expect(result.valid).toBe(false)
    expect(result.issues.some((i) => i.code === 'OPEN-010')).toBe(true)
  })

  it('rejects a closed fiscal year (OPEN-001)', () => {
    const result = validateOpeningBatch({
      lines: [postableAccount, creditAccount],
      fiscalYearStatus: 'closed',
    })
    expect(result.valid).toBe(false)
    expect(result.issues.some((i) => i.code === 'OPEN-001')).toBe(true)
  })

  it('rejects when a batch already exists for the FY (OPEN-002)', () => {
    const result = validateOpeningBatch({
      lines: [postableAccount, creditAccount],
      existingBatch: true,
    })
    expect(result.valid).toBe(false)
    expect(result.issues.some((i) => i.code === 'OPEN-002')).toBe(true)
  })

  it('rejects a line with no account (OPEN-003)', () => {
    const result = validateOpeningBatch({
      lines: [{ amount: 1000 }, { accountId: 102, amount: -1000 }],
      fiscalYearStatus: 'open',
    })
    expect(result.valid).toBe(false)
    expect(result.issues.some((i) => i.code === 'OPEN-003')).toBe(true)
  })

  it('rejects a non-posting account (OPEN-004)', () => {
    const result = validateOpeningBatch({
      lines: [{ accountId: 101, isPosting: false, amount: 1000 }, creditAccount],
      fiscalYearStatus: 'open',
    })
    expect(result.valid).toBe(false)
    expect(result.issues.some((i) => i.code === 'OPEN-004')).toBe(true)
  })

  it('rejects an inactive account (OPEN-005)', () => {
    const result = validateOpeningBatch({
      lines: [{ accountId: 101, isActive: false, amount: 1000 }, creditAccount],
      fiscalYearStatus: 'open',
    })
    expect(result.valid).toBe(false)
    expect(result.issues.some((i) => i.code === 'OPEN-005')).toBe(true)
  })

  it('rejects a zero amount (OPEN-008)', () => {
    const result = validateOpeningBatch({
      lines: [{ accountId: 101, amount: 0 }, { accountId: 102, amount: 0 }],
      fiscalYearStatus: 'open',
    })
    expect(result.valid).toBe(false)
    expect(result.issues.some((i) => i.code === 'OPEN-008')).toBe(true)
  })

  it('rejects a duplicate account in the batch (OPEN-009)', () => {
    const result = validateOpeningBatch({
      lines: [
        { accountId: 101, amount: 500 },
        { accountId: 101, amount: 500 },
        { accountId: 102, amount: -1000 },
      ],
      fiscalYearStatus: 'open',
    })
    expect(result.valid).toBe(false)
    expect(result.issues.some((i) => i.code === 'OPEN-009')).toBe(true)
  })

  it('rejects posting when not authorized (OPEN-011)', () => {
    const result = validateOpeningBatch({
      lines: [postableAccount, creditAccount],
      postingAllowed: false,
    })
    expect(result.valid).toBe(false)
    expect(result.issues.some((i) => i.code === 'OPEN-011')).toBe(true)
  })
})

// ponytail: OPEN-006 (negative amount) and OPEN-007 (debit & credit both positive) are unreachable
// with signed amounts — amount is always non-negative after sign split into debit/credit.
// Add these tests back if validateOpeningBatch ever switches to explicit debit/credit fields.

describe('COA Master Validation — validateAccountData', () => {
  const base = {
    data: { name: 'Cash', code: '1110', type: 'asset', normalBalance: 'debit' },
    existingCodes: ['1110'],
    tenant: 1,
  }

  it('rejects duplicate code per tenant (ACCT-003)', () => {
    const result = validateAccountData({
      ...base,
      data: { name: 'Bank', code: '1110', type: 'asset' },
    })
    expect(result.valid).toBe(false)
    expect(result.issues.some((i) => i.code === 'ACCT-003')).toBe(true)
  })

  it('rejects invalid account type (ACCT-005)', () => {
    const result = validateAccountData({
      ...base,
      data: { name: 'Cash', code: '1111', type: 'crypto' },
    })
    expect(result.valid).toBe(false)
    expect(result.issues.some((i) => i.code === 'ACCT-005')).toBe(true)
  })

  it('rejects blank name (ACCT-001)', () => {
    const result = validateAccountData({
      ...base,
      data: { name: '', code: '1111', type: 'asset' },
    })
    expect(result.valid).toBe(false)
    expect(result.issues.some((i) => i.code === 'ACCT-001')).toBe(true)
  })

  it('rejects parent from another company (ACCT-009)', () => {
    const result = validateAccountData({
      ...base,
      data: { name: 'Branch Cash', code: '1112', type: 'asset' },
      parentId: 5,
      parentTenant: 2,
      tenant: 1,
    })
    expect(result.valid).toBe(false)
    expect(result.issues.some((i) => i.code === 'ACCT-009')).toBe(true)
  })

  it('rejects deleting an account with children (ACCT-010)', () => {
    const result = validateAccountData({
      ...base,
      data: { name: 'Cash', code: '1110', type: 'asset' },
      hasChildren: true,
    })
    expect(result.valid).toBe(false)
    expect(result.issues.some((i) => i.code === 'ACCT-010')).toBe(true)
  })

  it('rejects deleting an account with activity (ACCT-011)', () => {
    const result = validateAccountData({
      ...base,
      data: { name: 'Cash', code: '1110', type: 'asset' },
      hasActivity: true,
    })
    expect(result.valid).toBe(false)
    expect(result.issues.some((i) => i.code === 'ACCT-011')).toBe(true)
  })

  it('accepts a valid new account', () => {
    const result = validateAccountData({
      ...base,
      data: { name: 'Bank', code: '1112', type: 'asset' },
    })
    expect(result.valid).toBe(true)
  })
})
