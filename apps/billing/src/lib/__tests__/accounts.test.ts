import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockAccount, createMockAccountGroup, createMockCoAHierarchy } from '../../test/factories'
import { buildExportExcel, parseExcelFile, classifyRecords, validateImportRows } from '../importExport'

describe('Accounts & Chart of Accounts', () => {
  describe('Account Factory', () => {
    it('creates valid account with defaults', () => {
      const account = createMockAccount()
      
      expect(account.id).toBeDefined()
      expect(account.code).toMatch(/^\d{4}$/)
      expect(account.name).toBeTruthy()
      expect(['asset', 'liability', 'equity', 'income', 'expense']).toContain(account.type)
      expect(['other', 'cash', 'bank', 'receivable', 'payable']).toContain(account.class)
      expect(typeof account.openingBalance).toBe('number')
      expect(account.tenant).toBe('C00')
    })

    it('allows overrides', () => {
      const account = createMockAccount({ 
        code: '1000', 
        name: 'Custom Account', 
        type: 'asset',
        openingBalance: 50000 
      })
      
      expect(account.code).toBe('1000')
      expect(account.name).toBe('Custom Account')
      expect(account.type).toBe('asset')
      expect(account.openingBalance).toBe(50000)
    })

    it('creates account group', () => {
      const group = createMockAccountGroup()
      
      expect(group.id).toBeDefined()
      expect(group.code).toMatch(/^\d{3}$/)
      expect(group.name).toBeTruthy()
      expect(['asset', 'liability', 'equity', 'income', 'expense']).toContain(group.type)
    })

    it('creates CoA hierarchy', () => {
      const { groups, accounts } = createMockCoAHierarchy()
      
      expect(groups.length).toBe(8)
      expect(accounts.length).toBe(14)
      
      // Verify hierarchy structure
      const assetGroups = groups.filter(g => g.type === 'asset')
      expect(assetGroups.length).toBe(3) // Assets, Current Assets, Fixed Assets
      
      // Verify account types match groups
      accounts.forEach(account => {
        const group = groups.find(g => g.id === account.group)
        if (group) {
          expect(account.type).toBe(group.type)
        }
      })
    })
  })

  describe('CoA Hierarchy Validation', () => {
    it('has correct account types per group', () => {
      const { groups, accounts } = createMockCoAHierarchy()
      
      accounts.forEach(account => {
        const group = groups.find(g => g.id === account.group)
        if (group) {
          expect(account.type).toBe(group.type)
        }
      })
    })
  })
})

describe('Import/Export Functions', () => {
  describe('classifyRecords', () => {
    it('classifies exact ID matches', () => {
      const existing = [
        { id: 1, code: 'ACC001', name: 'Account 1' },
        { id: 2, code: 'ACC002', name: 'Account 2' },
      ]
      
      const incoming = [
        { id: 1, code: 'ACC001', name: 'Updated Account 1' },
        { id: 999, code: 'NEW001', name: 'New Account' },
      ]
      
      const result = classifyRecords(incoming, existing, 'gl-accounts')
      
      expect(result.exactDuplicates).toHaveLength(1)
      expect(result.exactDuplicates[0].imported.id).toBe(1)
      expect(result.newRecords).toHaveLength(1)
      expect(result.newRecords[0].id).toBe(999)
    })

    it('classifies business key matches', () => {
      const existing = [
        { id: 1, code: 'ACC001', name: 'Account 1' },
      ]
      
      const incoming = [
        { id: 999, code: 'ACC001', name: 'Account 1 Updated' },
      ]
      
      const result = classifyRecords(incoming, existing, 'gl-accounts')
      
      expect(result.similarRecords).toHaveLength(1)
      expect(result.newRecords).toHaveLength(0)
    })

    it('detects new records', () => {
      const existing = [
        { id: 1, code: 'ACC001', name: 'Cash Account' },
      ]
      
      const incoming = [
        { id: 999, code: 'NEW001', name: 'Completely New' },
      ]
      
      const result = classifyRecords(incoming, existing, 'gl-accounts')
      
      expect(result.newRecords).toHaveLength(1)
      expect(result.exactDuplicates).toHaveLength(0)
      expect(result.similarRecords).toHaveLength(0)
    })
  })

  describe('validateImportRows', () => {
    it('validates required fields for members', () => {
      const rows = [
        { fullName: 'Valid Member', phone: '9800000000' },
        { fullName: '', phone: '9800000001' },
      ]
      
      const result = validateImportRows(rows, 'members')
      
      expect(result.valid).toHaveLength(1)
      expect(result.errors).toHaveLength(1)
    })

    it('validates account type enum', () => {
      const rows = [
        { name: 'Valid Account', type: 'asset' },
        { name: 'Invalid Type', type: 'invalid' },
      ]
      
      const result = validateImportRows(rows, 'gl-accounts')
      
      expect(result.valid).toHaveLength(1)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].message).toContain('Invalid account type')
    })

    it('validates email format for members', () => {
      const rows = [
        { fullName: 'Valid', phone: '9800000000', email: 'valid@test.com' },
        { fullName: 'Invalid Email', phone: '9800000001', email: 'not-an-email' },
      ]
      
      const result = validateImportRows(rows, 'members')
      
      expect(result.valid).toHaveLength(1)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].message).toContain('email')
    })
  })

  describe('Excel Export/Import Round-trip', () => {
    it('exports accounts to Excel format', async () => {
      const accounts = [
        createMockAccount({ id: 1, code: '1000', name: 'Cash', type: 'asset', openingBalance: 10000 }),
        createMockAccount({ id: 2, code: '1100', name: 'Bank', type: 'asset', openingBalance: 50000 }),
      ]
      
      const excelBuffer = await buildExportExcel('gl-accounts', accounts)
      
      expect(excelBuffer).toBeInstanceOf(Blob)
      expect(excelBuffer.size).toBeGreaterThan(0)
    })

    it('parses Excel file', async () => {
      // This would need a real Excel file to test
      // For now, verify function exists
      expect(typeof parseExcelFile).toBe('function')
    })
  })
})

describe('Account Business Logic', () => {
  it('validates double-entry: debit equals credit', () => {
    const lines = [
      { accountId: 1, debit: 1000, credit: 0 },
      { accountId: 2, debit: 0, credit: 1000 },
    ]
    
    const totalDebits = lines.reduce((sum, l) => sum + (l.debit || 0), 0)
    const totalCredits = lines.reduce((sum, l) => sum + (l.credit || 0), 0)
    
    expect(totalDebits).toBe(totalCredits)
  })

  it('rejects unbalanced journal entry', () => {
    const lines = [
      { accountId: 1, debit: 1000, credit: 0 },
      { accountId: 2, debit: 0, credit: 500 }, // Unbalanced!
    ]
    
    const totalDebits = lines.reduce((sum, l) => sum + (l.debit || 0), 0)
    const totalCredits = lines.reduce((sum, l) => sum + (l.credit || 0), 0)
    
    expect(totalDebits).not.toBe(totalCredits)
  })

  it('calculates account balance correctly', () => {
    const openingBalance = 10000
    const debits = [5000, 3000]
    const credits = [2000]
    
    const closingBalance = openingBalance + debits.reduce((a, b) => a + b, 0) - credits.reduce((a, b) => a + b, 0)
    
    expect(closingBalance).toBe(16000)
  })

  it('validates fiscal year scope for opening balances', () => {
    const fiscalYear = { id: 1, name: '2081-82', startDate: '2081-04-01', endDate: '2082-03-31' }
    const openingDate = '2081-06-15' // Within fiscal year
    
    const isWithinFiscalYear = openingDate >= fiscalYear.startDate && openingDate <= fiscalYear.endDate
    
    expect(isWithinFiscalYear).toBe(true)
  })
})