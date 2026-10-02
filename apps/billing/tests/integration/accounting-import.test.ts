import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  buildExportExcel,
  parseImportFile,
  validateImportRows,
} from '../../src/lib/importExport'

// Mock api to prevent actual calls during executeImport
vi.mock('../../src/lib/api', () => ({
  api: vi.fn(),
}))

describe('CoA hierarchical import/export', () => {
  it('should format chart of accounts hierarchy on export correctly', async () => {
    const docs = [
      { id: 1, name: 'Current Assets', type: 'asset', code: '1000' },
      { id: 2, name: 'Cash', type: 'asset', parent: 1, group: 'Current Assets', code: '1010' },
    ]
    const blob = await buildExportExcel('accounts', docs)
    expect(blob.size).toBeGreaterThan(0)
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  })

  it('validates account structure with groups on import correctly', async () => {
    const docs = [
      { name: 'Current Assets', type: 'asset', code: '1000', group: 'Assets' },
      { name: 'Cash', type: 'asset', parent: 1, group: 'Current Assets', code: '1010' },
      { name: 'Bank', type: 'asset', group: 'Current Assets', code: '1010' }, // duplicate code
      { name: 'Inventory', type: 'invalid_type', group: 'Current Assets', code: '1020' }, // invalid type
      { name: 'Petty Cash', type: 'asset', code: '1030' }, // missing parent group
    ]
    const { errors } = validateImportRows(docs, 'accounts')

    // First two are valid initially except duplicate code on third makes it invalid, invalid type on 4th, missing group on 5th
    expect(errors.some(e => e.field === 'code' && e.message.includes('Duplicate account code: 1010'))).toBe(true)
    expect(errors.some(e => e.field === 'type' && e.message.includes('Invalid account type'))).toBe(true)
    expect(errors.some(e => e.field === 'group' && e.message.includes('Parent group is required'))).toBe(true)
  })

  it('round-trip export -> import preserves hierarchy', async () => {
    const originalDocs = [
      { id: 1, name: 'Assets', type: 'asset', group: 'Ungrouped', code: '1000' },
      { id: 2, name: 'Current Assets', type: 'asset', group: 'Assets', code: '1100' },
      { id: 3, name: 'Cash', type: 'asset', group: 'Current Assets', code: '1110' },
    ]

    // 1. Export
    const blob = await buildExportExcel('accounts', originalDocs)

    // 2. Mock a file to simulate File input for parse
    const file = new File([await blob.arrayBuffer()], 'accounts.xlsx', { type: blob.type })

    // 3. Import
    const parsed = await parseImportFile(file)

    // Ensure we used the accounts specific parser
    expect(parsed.collection).toBe('accounts')

    // Validate output structure
    // Since parseExcelFile maps "name" header to "fullName" under the hood due to normalization
    // the actual parsed field could be "fullName". parseCoaExcel does remap it to "name".
    const cashDoc = parsed.docs.find((d: any) => d.name === 'Cash')
    expect(cashDoc).toBeDefined()
    expect((cashDoc as any).group).toBe('Current Assets')

    const currentAssetsDoc = parsed.docs.find((d: any) => d.name === 'Current Assets')
    expect(currentAssetsDoc).toBeDefined()
    expect((currentAssetsDoc as any).group).toBe('Assets')
  })
})
