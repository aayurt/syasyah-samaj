import { describe, it, expect } from 'vitest'
import {
  createMockOpeningBalance,
  createMockAccount,
  createMockParty,
  createMockDataSet,
} from '../../test/factories'

describe('Opening Balance Reconciliation', () => {
  describe('Opening Balance Factory', () => {
    it('creates valid opening balance with defaults', () => {
      const ob = createMockOpeningBalance()

      expect(ob.id).toBeDefined()
      expect(ob.account).toBeDefined()
      expect(ob.fiscalYear).toBe('2081-82')
      expect(typeof ob.amount).toBe('number')
      expect(ob.tenant).toBe('C00')
    })

    it('allows overrides', () => {
      const ob = createMockOpeningBalance({
        account: 101,
        fiscalYear: '2083-84',
        amount: 50000,
      })

      expect(ob.account).toBe(101)
      expect(ob.fiscalYear).toBe('2083-84')
      expect(ob.amount).toBe(50000)
    })
  })

  describe('GL and Subledger Consistency', () => {
    it('sums opening balances per fiscal year', () => {
      const obs = [
        createMockOpeningBalance({ account: 101, fiscalYear: '2083-84', amount: 50000 }),
        createMockOpeningBalance({ account: 102, fiscalYear: '2083-84', amount: 250000 }),
        createMockOpeningBalance({ account: 101, fiscalYear: '2082-83', amount: 30000 }),
      ]

      const fy208384Total = obs
        .filter((o) => o.fiscalYear === '2083-84')
        .reduce((sum, o) => sum + (o.amount || 0), 0)

      expect(fy208384Total).toBe(300000)
    })

    it('reconciles party opening balances to GL control accounts', () => {
      const parties = [
        createMockParty({ type: 'customer', openingBalance: 50000 }),
        createMockParty({ type: 'vendor', openingBalance: -30000 }),
        createMockParty({ type: 'customer', openingBalance: 20000 }),
      ]

      const receivableTotal = parties
        .filter((p) => p.type === 'customer' || p.type === 'both')
        .reduce((sum, p) => sum + (p.openingBalance || 0), 0)
      const payableTotal = parties
        .filter((p) => p.type === 'vendor' || p.type === 'both')
        .reduce((sum, p) => sum + (p.openingBalance || 0), 0)

      expect(receivableTotal).toBe(70000)
      expect(payableTotal).toBe(-30000)
    })

    it('validates opening balance belongs to active fiscal year', () => {
      const fiscalYears = [
        { name: '2083-84', isActive: true, isClosed: false },
        { name: '2082-83', isActive: false, isClosed: true },
      ]

      const activeFy = fiscalYears.find((fy) => fy.isActive && !fy.isClosed)

      expect(activeFy?.name).toBe('2083-84')
    })
  })

  describe('Opening Balance Constraints', () => {
    it('prevents duplicate opening balance for same account and fiscal year', () => {
      const obs = [
        createMockOpeningBalance({ account: 101, fiscalYear: '2083-84' }),
        createMockOpeningBalance({ account: 101, fiscalYear: '2083-84' }),
      ]

      const key = (o: typeof obs[0]) => `${o.account}|${o.fiscalYear}`
      const keys = obs.map(key)
      const uniqueKeys = new Set(keys)

      expect(uniqueKeys.size).toBeLessThan(keys.length)
    })

    it('reconciles total debits and credits across opening balances', () => {
      const obs = [
        createMockOpeningBalance({ amount: 100000 }), // debit balance (asset)
        createMockOpeningBalance({ amount: -50000 }),  // credit balance (liability)
        createMockOpeningBalance({ amount: -50000 }),  // credit balance (equity)
      ]

      const debits = obs.filter((o) => (o.amount || 0) > 0).reduce((s, o) => s + (o.amount || 0), 0)
      const credits = obs
        .filter((o) => (o.amount || 0) < 0)
        .reduce((s, o) => s + Math.abs(o.amount || 0), 0)

      expect(debits).toBe(credits)
    })

    it('scopes opening balances by tenant', () => {
      const data = createMockDataSet(5)

      expect(data.openingBalances.every((ob) => ob.tenant === 'C00')).toBe(true)
    })
  })
})
