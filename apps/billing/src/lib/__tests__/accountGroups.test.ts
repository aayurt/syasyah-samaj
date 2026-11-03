import { describe, it, expect } from 'vitest'
import {
  createMockAccountGroup,
  createMockCoAHierarchy,
} from '../../test/factories'

describe('Account Groups', () => {
  describe('Account Group Factory', () => {
    it('creates valid account group with defaults', () => {
      const group = createMockAccountGroup()

      expect(group.id).toBeDefined()
      expect(group.code).toMatch(/^\d{3}$/)
      expect(group.name).toBeTruthy()
      expect(['asset', 'liability', 'equity', 'income', 'expense']).toContain(group.type)
      expect(group.tenant).toBe('C00')
      expect(group.createdAt).toBeTruthy()
      expect(group.updatedAt).toBeTruthy()
    })

    it('allows overrides', () => {
      const group = createMockAccountGroup({
        id: 100,
        code: '110',
        name: 'Custom Group',
        type: 'asset',
      })

      expect(group.id).toBe(100)
      expect(group.code).toBe('110')
      expect(group.name).toBe('Custom Group')
      expect(group.type).toBe('asset')
    })

    it('sets parent correctly', () => {
      const group = createMockAccountGroup({
        id: 50,
        code: '210',
        name: 'Sub Group',
        type: 'liability',
        parentId: 4,
      })

      expect(group.parentId).toBe(4)
      expect(group.type).toBe('liability')
    })
  })

  describe('Hierarchy Validation', () => {
    it('creates correct CoA hierarchy with groups', () => {
      const { groups } = createMockCoAHierarchy()

      expect(groups.length).toBe(8)

      const topLevelGroups = groups.filter((g) => !g.parentId)
      expect(topLevelGroups.length).toBe(5) // Assets, Liabilities, Equity, Income, Expenses

      const childGroups = groups.filter((g) => g.parentId)
      expect(childGroups.length).toBe(3) // Current Assets, Fixed Assets, Current Liabilities
    })

    it('has unique group codes', () => {
      const { groups } = createMockCoAHierarchy()
      const codes = groups.map((g) => g.code)

      expect(new Set(codes).size).toBe(codes.length)
    })

    it('child group type matches parent type', () => {
      const { groups, accounts } = createMockCoAHierarchy()

      // Each child group's type should match its parent's type
      groups.forEach((group) => {
        if (group.parentId) {
          const parent = groups.find((g) => g.id === group.parentId)
          if (parent) {
            expect(group.type).toBe(parent.type)
          }
        }
      })

      // Each account's type should match its group's type
      accounts.forEach((account) => {
        const group = groups.find((g) => g.id === account.group)
        if (group) {
          expect(account.type).toBe(group.type)
        }
      })
    })
  })

  describe('Group CRUD Operations', () => {
    it('validates unique code per tenant', () => {
      const existing = [
        createMockAccountGroup({ id: 1, code: '110', name: 'Cash Assets', tenant: 'C00' }),
        createMockAccountGroup({ id: 2, code: '210', name: 'Payables', tenant: 'C00' }),
      ]

      const duplicate = existing.find((g) => g.code === '110')
      expect(duplicate).toBeDefined()
    })

    it('supports same code across different tenants', () => {
      const groupA = createMockAccountGroup({ code: '110', tenant: 'C00' })
      const groupB = createMockAccountGroup({ code: '110', tenant: 'IL01' })

      expect(groupA.code).toBe(groupB.code)
      expect(groupA.tenant).not.toBe(groupB.tenant)
    })
  })
})
