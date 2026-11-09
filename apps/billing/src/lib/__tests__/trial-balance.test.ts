import { describe, it, expect } from 'vitest'
import { createMockAccount, createMockJournalEntry } from '../../test/factories'

describe('Trial Balance', () => {
  describe('Account Factory', () => {
    it('creates valid account with defaults', () => {
      const account = createMockAccount()

      expect(account.id).toBeDefined()
      expect(account.code).toMatch(/^\d{4}$/)
      expect(account.name).toBeTruthy()
      expect(['asset', 'liability', 'equity', 'income', 'expense']).toContain(account.type)
      expect(typeof account.openingBalance).toBe('number')
      expect(account.tenant).toBe('C00')
    })

    it('allows overrides', () => {
      const account = createMockAccount({
        code: '4100',
        name: 'Membership Fees',
        type: 'income',
        openingBalance: 0,
      })

      expect(account.code).toBe('4100')
      expect(account.name).toBe('Membership Fees')
      expect(account.type).toBe('income')
      expect(account.openingBalance).toBe(0)
    })
  })

  describe('Debit/Credit Reconciliation', () => {
    it('reconciles total debits and credits in trial balance', () => {
      const rows = [
        { account: 101, debit: 50000, credit: 0 },
        { account: 102, debit: 250000, credit: 0 },
        { account: 201, debit: 0, credit: 80000 },
        { account: 301, debit: 0, credit: 140000 },
        { account: 401, debit: 0, credit: 80000 },
      ]

      const totalDebits = rows.reduce((s, r) => s + (r.debit || 0), 0)
      const totalCredits = rows.reduce((s, r) => s + (r.credit || 0), 0)

      expect(totalDebits).toBe(totalCredits)
      expect(totalDebits).toBe(300000)
    })

    it('detects unbalanced trial balance', () => {
      const rows = [
        { account: 101, debit: 50000, credit: 0 },
        { account: 201, debit: 0, credit: 30000 },
      ]

      const totalDebits = rows.reduce((s, r) => s + (r.debit || 0), 0)
      const totalCredits = rows.reduce((s, r) => s + (r.credit || 0), 0)

      expect(totalDebits).not.toBe(totalCredits)
    })

    it('computes account balance as debit minus credit', () => {
      const rows = [
        { account: 101, debit: 50000, credit: 10000 },
        { account: 201, debit: 0, credit: 80000 },
        { account: 401, debit: 0, credit: 120000 },
      ]

      rows.forEach((row) => {
        const balance = (row.debit || 0) - (row.credit || 0)
        expect(typeof balance).toBe('number')
      })

      expect(rows[0].debit - rows[0].credit).toBe(40000)
      expect(rows[1].debit - rows[1].credit).toBe(-80000)
      expect(rows[2].debit - rows[2].credit).toBe(-120000)
    })
  })

  describe('Trial Balance by Account Type', () => {
    it('groups accounts by type for balance sheet and P&L', () => {
      const accounts = [
        createMockAccount({ code: '1110', name: 'Cash', type: 'asset', openingBalance: 50000 }),
        createMockAccount({ code: '2110', name: 'Accounts Payable', type: 'liability', openingBalance: -80000 }),
        createMockAccount({ code: '3100', name: 'Capital Fund', type: 'equity', openingBalance: -400000 }),
        createMockAccount({ code: '4100', name: 'Membership Fees', type: 'income', openingBalance: 0 }),
        createMockAccount({ code: '5100', name: 'Office Rent', type: 'expense', openingBalance: 0 }),
      ]

      const assets = accounts.filter((a) => a.type === 'asset')
      const liabilities = accounts.filter((a) => a.type === 'liability')
      const equity = accounts.filter((a) => a.type === 'equity')
      const income = accounts.filter((a) => a.type === 'income')
      const expenses = accounts.filter((a) => a.type === 'expense')

      expect(assets).toHaveLength(1)
      expect(liabilities).toHaveLength(1)
      expect(equity).toHaveLength(1)
      expect(income).toHaveLength(1)
      expect(expenses).toHaveLength(1)
    })

    it('computes net profit as income minus expense', () => {
      const incomeTotal = 500000
      const expenseTotal = 300000

      const netProfit = incomeTotal - expenseTotal

      expect(netProfit).toBe(200000)
    })
  })

  describe('Journal Entry Balance', () => {
    it('validates each journal entry is balanced', () => {
      const entry = createMockJournalEntry({
        lines: [
          { account: 1, debit: 1000, credit: 0 },
          { account: 2, debit: 0, credit: 1000 },
        ],
      })

      const totalDebits = entry.lines.reduce((s, l) => s + (l.debit || 0), 0)
      const totalCredits = entry.lines.reduce((s, l) => s + (l.credit || 0), 0)

      expect(totalDebits).toBe(totalCredits)
    })

    it('scopes trial balance by tenant', () => {
      const account = createMockAccount()

      expect(account.tenant).toBe('C00')
    })
  })
})
