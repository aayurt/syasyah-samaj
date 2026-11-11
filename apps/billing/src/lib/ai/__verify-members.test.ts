import { describe, it, expect } from 'vitest'
import { validateAgainstModel } from './validate'

const ctx = { tenantName: 'Syasyah Samaj', tenantId: 't1', currentUser: { id: 'u1', role: 'admin' } }

describe('members import verification with test data', () => {
  it('validates minimal valid members doc', () => {
    const r = validateAgainstModel({ docs: [{ fullName: 'Ram Bahadur' }] }, 'members', ctx)
    expect(r.valid).toBe(true)
    expect(r.errors).toEqual([])
  })

  it('validates full members doc with all fields', () => {
    const r = validateAgainstModel(
      { docs: [{ fullName: 'Ram Bahadur', email: 'ram@example.com', role: 'member', status: 'active' }] },
      'members',
      ctx,
    )
    expect(r.valid).toBe(true)
  })

  it('rejects members doc missing fullName', () => {
    const r = validateAgainstModel({ docs: [{ email: 'ram@example.com' }] }, 'members', ctx)
    expect(r.valid).toBe(false)
    expect(r.errors.some((e) => e.field === 'fullName')).toBe(true)
  })

  it('rejects members doc with empty fullName', () => {
    const r = validateAgainstModel({ docs: [{ fullName: '' }] }, 'members', ctx)
    expect(r.valid).toBe(false)
  })

  it('rejects members doc with invalid status', () => {
    const r = validateAgainstModel({ docs: [{ fullName: 'Ram', status: 'bogus' }] }, 'members', ctx)
    expect(r.valid).toBe(false)
    expect(r.errors.some((e) => e.field === 'status')).toBe(true)
  })

  it('accepts members doc with inactive status', () => {
    const r = validateAgainstModel({ docs: [{ fullName: 'Sita', status: 'inactive' }] }, 'members', ctx)
    expect(r.valid).toBe(true)
  })

  it('handles multiple members docs in one import batch', () => {
    const docs = [
      { fullName: 'Ram Bahadur', email: 'ram@example.com', role: 'member', status: 'active' },
      { fullName: 'Sita Devi', email: 'sita@example.com', role: 'member', status: 'active' },
      { fullName: 'Hari Sharma', email: 'hari@example.com', role: 'treasurer', status: 'inactive' },
    ]
    const r = validateAgainstModel({ docs }, 'members', ctx)
    expect(r.valid).toBe(true)
  })

  it('accepts mixed valid/invalid docs and reports per-row errors', () => {
    const docs = [
      { fullName: 'Valid Member', email: 'valid@example.com', status: 'active' },
      { fullName: '', email: 'bad@example.com', status: 'active' },
      { fullName: 'Bad Status', email: 'bad2@example.com', status: 'bogus' },
    ]
    const r = validateAgainstModel({ docs }, 'members', ctx)
    expect(r.valid).toBe(false)
    expect(r.errors.length).toBeGreaterThan(0)
    expect(r.errors.some((e) => e.field === 'fullName' && e.row === 2)).toBe(true)
    expect(r.errors.some((e) => e.field === 'status' && e.row === 3)).toBe(true)
  })
})
