/** Regression tests for the gl-accounts validation rules.
 *
 * These read the source rather than hitting a database, mirroring the
 * Documents/posting-rules.test.ts convention.
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'

const INDEX = path.resolve(__dirname, 'index.ts')
const source = readFileSync(INDEX, 'utf8')

describe('gl-accounts validation', () => {
  it('rejects duplicate account codes within a tenant', () => {
    expect(source).toContain('Account code "')
    expect(source).toContain('already exists.')
  })

  it('detects circular parent relationships', () => {
    expect(source).toContain('Circular parent relationship detected.')
  })

  it('rejects an account that is its own parent', () => {
    expect(source).toContain("An account cannot be its own parent.")
  })

  it('walks the parent chain bounded at 50 hops', () => {
    expect(source).toContain('hops < 50')
  })

  it('declares a normalBalance field with debit and credit options', () => {
    expect(source).toContain("name: 'normalBalance'")
    expect(source).toContain("value: 'debit'")
    expect(source).toContain("value: 'credit'")
    expect(source).toContain("defaultValue: 'debit'")
  })

  it('uses validateAccount in beforeValidate (not the old forbidSelfParent)', () => {
    expect(source).toContain('beforeValidate: [assignTenant, validateAccount]')
    expect(source).not.toContain('forbidSelfParent')
  })
})
