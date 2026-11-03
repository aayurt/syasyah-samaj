import { describe, it, expect } from 'vitest'
import {
  createMockOpeningBalance,
  createMockAccount,
  createMockFiscalYear,
  createMockDataSet,
} from '../../test/factories'

describe('Opening Balances', () => {
  describe('Opening Balance Factory', () => {
    it('creates valid opening balance with defaults', () => {
      const ob = createMockOpeningBalance()

      expect(ob.id).toBeDefined()
      expect(ob.account).toBeDefined()
      expect(typeof ob.account).toBe('number')
      expect(ob.fiscalYear).toBe('2081-82')
      expect(typeof ob.amount).toBe('number')
      expect(ob.tenant).toBe('C00')
    })

    it('allows overrides', () => {
      const ob = createMockOpeningBalance({
        id: 999,
        account: 101,
        fiscalYear: '2082-83',
        amount: 50000,
      })

      expect(ob.id).toBe(999)
      expect(ob.account).toBe(101)
      expect(ob.fiscalYear).toBe('2082-83')
      expect(ob.amount).toBe(50000)
    })
  })

  describe('Opening Balance Validation', () => {
    it('supports positive and negative balances', () => {
      const debitBalance = createMockOpeningBalance({ amount: 50000 })   // Asset debit
      const creditBalance = createMockOpeningBalance({ amount: -30000 }) // Liability credit

      expect(debitBalance.amount).toBeGreaterThan(0)
      expect(creditBalance.amount).toBeLessThan(0)
    })

    it('validates amount is numeric', () => {
      const ob = createMockOpeningBalance()
      expect(typeof ob.amount).toBe('number')
      expect(!isNaN(ob.amount)).toBe(true)
    })

    it('links to valid account', () => {
      const account = createMockAccount({ id: 101, code: '1110', name: 'Cash' })
      const ob = createMockOpeningBalance({ account: account.id })

      expect(ob.account).toBe(account.id)
    })
  })

  describe('Fiscal Year Scope', () => {
    it('associates opening balance with fiscal year', () => {
      const fy = createMockFiscalYear({ name: '2081-82' })
      const ob = createMockOpeningBalance({ fiscalYear: fy.name })

      expect(ob.fiscalYear).toBe(fy.name)
    })

    it('supports multiple fiscal years', () => {
      const fy1 = createMockFiscalYear({ name: '2080-81' })
      const fy2 = createMockFiscalYear({ name: '2081-82' })
      const fy3 = createMockFiscalYear({ name: '2082-83' })

      const obs = [
        createMockOpeningBalance({ fiscalYear: fy1.name }),
        createMockOpeningBalance({ fiscalYear: fy2.name }),
        createMockOpeningBalance({ fiscalYear: fy3.name }),
      ]

      expect(obs.map((o) => o.fiscalYear)).toEqual(['2080-81', '2081-82', '2082-83'])
    })
  })

  describe('Tenant Scoping', () => {
    it('scopes opening balance to tenant', () => {
      const central = createMockOpeningBalance({ tenant: 'C00' })
      const illaka = createMockOpeningBalance({ tenant: 'IL01' })

      expect(central.tenant).toBe('C00')
      expect(illaka.tenant).toBe('IL01')
    })
  })

  describe('Dataset', () => {
    it('creates consistent dataset', () => {
      const data = createMockDataSet(5)

      expect(data.openingBalances).toHaveLength(5)
      expect(data.openingBalances.every((o) => o.tenant === 'C00')).toBe(true)
    })
  })
})
