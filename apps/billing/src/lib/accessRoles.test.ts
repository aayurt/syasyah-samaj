import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utilities/extractID', () => ({
  extractID: vi.fn((v: any) => v),
}))

import { isBillingUser, isCentralUser, isIllakaUser } from '@/access/tenantScoped'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('isBillingUser — who can run billing actions (seed, DataOps CRUD)', () => {
  it('rejects unauthenticated users', () => {
    expect(isBillingUser(null)).toBe(false)
    expect(isBillingUser(undefined)).toBe(false)
  })

  it('rejects plain users with no billing role', () => {
    expect(isBillingUser({ role: 'user' })).toBe(false)
    expect(isBillingUser({ role: 'member' })).toBe(false)
  })

  it('admits central roles', () => {
    expect(isBillingUser({ role: 'super-admin' })).toBe(true)
    expect(isBillingUser({ role: 'admin' })).toBe(true)
    expect(isBillingUser({ role: 'central-exec' })).toBe(true)
    expect(isBillingUser({ role: 'central-treasurer' })).toBe(true)
    expect(isBillingUser({ role: 'central-auditor' })).toBe(true)
  })

  it('admits illaka roles', () => {
    expect(isBillingUser({ role: 'illaka-chair', tenants: [{ tenant: 1 }] })).toBe(true)
    expect(isBillingUser({ role: 'illaka-treasurer', tenants: [{ tenant: 2 }] })).toBe(true)
    expect(isBillingUser({ role: 'illaka-accountant', tenants: [{ tenant: 3 }] })).toBe(true)
  })

  it('admits viewers', () => {
    expect(isBillingUser({ role: 'viewer' })).toBe(true)
  })
})

describe('role split', () => {
  it('central vs illaka vs viewer', () => {
    expect(isCentralUser({ role: 'super-admin' })).toBe(true)
    expect(isCentralUser({ role: 'illaka-treasurer' })).toBe(false)
    expect(isIllakaUser({ role: 'illaka-secretary' })).toBe(true)
    expect(isIllakaUser({ role: 'viewer' })).toBe(false)
  })
})
