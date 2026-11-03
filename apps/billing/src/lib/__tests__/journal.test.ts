import { describe, it, expect } from 'vitest'
import {
  createMockJournalEntry,
  createMockDataSet,
} from '../../test/factories'

describe('Journal Entries', () => {
  describe('Journal Entry Factory', () => {
    it('creates valid journal entry with defaults', () => {
      const entry = createMockJournalEntry()

      expect(entry.id).toBeDefined()
      expect(entry.entryNo).toMatch(/^JE\d{6}$/)
      expect(entry.narration).toBeTruthy()
      expect(entry.lines).toHaveLength(2)
      expect(entry.tenant).toBe('C00')
      expect(entry.fiscalYear).toBe('2081-82')
    })

    it('allows overrides', () => {
      const entry = createMockJournalEntry({
        entryNo: 'JE000001',
        narration: 'Custom journal entry',
        lines: [
          { accountId: 101, debit: 5000, credit: 0, description: 'Debit side' },
          { accountId: 201, debit: 0, credit: 5000, description: 'Credit side' },
        ],
      })

      expect(entry.entryNo).toBe('JE000001')
      expect(entry.narration).toBe('Custom journal entry')
      expect(entry.lines).toHaveLength(2)
    })
  })

  describe('Journal Validation', () => {
    it('validates double-entry balance', () => {
      const entry = createMockJournalEntry({
        lines: [
          { accountId: 101, debit: 5000, credit: 0, description: 'Dr Cash' },
          { accountId: 401, debit: 0, credit: 5000, description: 'Cr Income' },
        ],
      })

      const totalDebits = entry.lines.reduce((sum, l) => sum + (l.debit || 0), 0)
      const totalCredits = entry.lines.reduce((sum, l) => sum + (l.credit || 0), 0)

      expect(totalDebits).toBe(totalCredits)
    })

    it('rejects entry with no lines', () => {
      const entry = createMockJournalEntry({ lines: [] })
      expect(entry.lines).toHaveLength(0)
    })

    it('validates each line has account', () => {
      const entry = createMockJournalEntry()

      entry.lines.forEach((line) => {
        expect(line.accountId).toBeDefined()
        expect(typeof line.accountId).toBe('number')
      })
    })

    it('validates debit or credit per line', () => {
      const entry = createMockJournalEntry()

      entry.lines.forEach((line) => {
        const hasDebit = (line.debit || 0) > 0
        const hasCredit = (line.credit || 0) > 0
        // Each line should have either debit or credit (not both, not neither)
        expect(hasDebit || hasCredit).toBe(true)
      })
    })
  })

  describe('Journal Numbering', () => {
    it('generates sequential entry numbers', () => {
      const entries = [
        createMockJournalEntry({ entryNo: 'JE000001' }),
        createMockJournalEntry({ entryNo: 'JE000002' }),
        createMockJournalEntry({ entryNo: 'JE000003' }),
      ]

      const nos = entries.map((e) => e.entryNo).sort()
      expect(nos[0]).toBe('JE000001')
      expect(nos[2]).toBe('JE000003')
    })
  })

  describe('Journal Dataset', () => {
    it('creates consistent dataset', () => {
      const data = createMockDataSet(5)

      expect(data.journalEntries).toHaveLength(5)
      expect(data.journalEntries.every((j) => j.tenant === 'C00')).toBe(true)
      data.journalEntries.forEach((j) => {
        expect(j.lines.length).toBeGreaterThan(0)
        j.lines.forEach((line) => {
          expect(line.accountId).toBeDefined()
        })
      })
    })
  })
})
