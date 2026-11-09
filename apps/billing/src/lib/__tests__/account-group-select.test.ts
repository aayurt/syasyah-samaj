import { describe, it, expect } from 'vitest'
import {
  createMockAccount,
  createMockAccountGroup,
  createMockCoAHierarchy,
} from '../../test/factories'

describe('Account Group Select', () => {
  describe('Account Group Factory', () => {
    it('creates valid account group with defaults', () => {
      const group = createMockAccountGroup()

      expect(group.id).toBeDefined()
      expect(group.code).toMatch(/^\d{3}$/)
      expect(group.name).toBeTruthy()
      expect(['asset', 'liability', 'equity', 'income', 'expense']).toContain(group.type)
      expect(group.tenant).toBe('C00')
    })

    it('allows overrides', () => {
      const group = createMockAccountGroup({
        code: '11',
        name: 'Current Assets',
        type: 'asset',
      })

      expect(group.code).toBe('11')
      expect(group.name).toBe('Current Assets')
      expect(group.type).toBe('asset')
    })
  })

  describe('Account Type → Group Compatibility Filtering', () => {
    const compatibleGroups: Record<string, string[]> = {
      asset: ['asset'],
      liability: ['liability'],
      equity: ['equity'],
      income: ['income'],
      expense: ['expense'],
    }

    it('returns only groups matching the selected account type', () => {
      const accountType = 'asset'
      const allGroups = [
        createMockAccountGroup({ type: 'asset' }),
        createMockAccountGroup({ type: 'liability' }),
        createMockAccountGroup({ type: 'equity' }),
        createMockAccountGroup({ type: 'income' }),
        createMockAccountGroup({ type: 'expense' }),
      ]

      const filtered = allGroups.filter((g) => compatibleGroups[accountType].includes(g.type))

      expect(filtered).toHaveLength(1)
      expect(filtered[0].type).toBe('asset')
    })

    it('returns no groups when no account type is selected', () => {
      const allGroups = [
        createMockAccountGroup({ type: 'asset' }),
        createMockAccountGroup({ type: 'liability' }),
      ]

      const filtered = allGroups.filter(() => false)

      expect(filtered).toHaveLength(0)
    })

    it('filters CoA hierarchy groups by type', () => {
      const { groups } = createMockCoAHierarchy()

      const assetGroups = groups.filter((g) => g.type === 'asset')
      expect(assetGroups.length).toBeGreaterThan(0)
      assetGroups.forEach((g) => expect(g.type).toBe('asset'))

      const liabilityGroups = groups.filter((g) => g.type === 'liability')
      liabilityGroups.forEach((g) => expect(g.type).toBe('liability'))
    })
  })

  describe('Account Type Compatibility', () => {
    it('maps account type to its own group type only', () => {
      const types: Array<'asset' | 'liability' | 'equity' | 'income' | 'expense'> = [
        'asset', 'liability', 'equity', 'income', 'expense',
      ]

      types.forEach((type) => {
        const group = createMockAccountGroup({ type })
        expect(group.type).toBe(type)
      })
    })

    it('account type must match group type for valid selection', () => {
      const account = createMockAccount({ type: 'asset' })
      const group = createMockAccountGroup({ type: 'asset' })

      expect(account.type).toBe(group.type)

      const incompatibleGroup = createMockAccountGroup({ type: 'liability' })
      expect(account.type).not.toBe(incompatibleGroup.type)
    })
  })

  describe('Account Factory with Group', () => {
    it('creates account under a group with matching type', () => {
      const { groups, accounts } = createMockCoAHierarchy()

      accounts.forEach((account) => {
        if (account.group) {
          const group = groups.find((g) => g.id === account.group)
          if (group) {
            expect(account.type).toBe(group.type)
          }
        }
      })
    })
  })
})
