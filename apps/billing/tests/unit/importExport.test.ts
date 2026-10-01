/* ─────────────────────────────────────────────────────────────
   Import/Export Unit Tests
   ───────────────────────────────────────────────────────────── */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  buildExportJson,
  buildExportCsv,
  buildExportExcel,
  parseCsvText,
  parseExcelFile,
  parseImportFile,
  classifyRecords,
  executeImport,
  validateImportRows,
  EXPORT_COLUMNS,
  type ParsedImport,
  type ValidationError,
} from '../../src/lib/importExport'

vi.mock('../../src/lib/api', () => ({
  api: vi.fn(),
}))

// Mock data
const sampleMembers = [
  { memberId: 'M-001', fullName: 'रत्नकाजी शाक्य', phone: '9841234567', email: 'ratna@example.com', address: 'मंगलबजार, १२', ward: '12', bloodGroup: 'O+', membershipType: 'Lifetime', appliedDateBs: '2081-05-15' },
  { memberId: 'M-002', fullName: 'सुरेन्द्र मानन्धर', phone: '9851029384', email: 'surendra@example.com', address: 'इखालखु, १६', ward: '16', bloodGroup: 'B+', membershipType: 'Annual', appliedDateBs: '2081-06-20' },
  { memberId: 'M-003', fullName: 'अनिता श्रेष्ठ', phone: '9803948123', email: '', address: 'हौगल, ८', ward: '8', bloodGroup: '', membershipType: 'Lifetime', appliedDateBs: '2081-07-10' },
]

const sampleAccounts = [
  { code: '1000', name: 'Cash', type: 'asset', class: 'cash', group: 'Current Assets', openingBalance: 50000 },
  { code: '1010', name: 'Bank - Nepal Bank', type: 'asset', class: 'bank', group: 'Current Assets', openingBalance: 250000 },
  { code: '2000', name: 'Accounts Payable', type: 'liability', class: 'other', group: 'Current Liabilities', openingBalance: -30000 },
  { code: '4000', name: 'Membership Revenue', type: 'income', class: 'other', group: 'Revenue', openingBalance: 0 },
  { code: '5000', name: 'Office Expenses', type: 'expense', class: 'other', group: 'Expenses', openingBalance: 0 },
]

const existingMembers = [
  { id: 1, memberId: 'M-001', fullName: 'रत्नकाजी शाक्य', phone: '9841234567' },
  { id: 2, memberId: 'M-002', fullName: 'सुरेन्द्र मानन्धर', phone: '9851029384' },
]

const existingAccounts = [
  { id: 10, code: '1000', name: 'Cash', type: 'asset' },
  { id: 11, code: '1010', name: 'Bank - Nepal Bank', type: 'asset' },
]

describe('buildExportJson', () => {
  it('creates valid JSON blob with metadata', () => {
    const blob = buildExportJson('members', sampleMembers, 'Test Tenant')
    expect(blob.type).toBe('application/json')
    expect(blob.size).toBeGreaterThan(0)
  })

  it('includes _export metadata and docs', async () => {
    const blob = buildExportJson('members', sampleMembers)
    const text = await blob.text()
    const parsed = JSON.parse(text)
    expect(parsed._export).toBeDefined()
    expect(parsed._export.collection).toBe('members')
    expect(parsed._export.count).toBe(3)
    expect(parsed.docs).toHaveLength(3)
  })

  it('handles empty docs array', () => {
    const blob = buildExportJson('members', [])
    expect(blob.size).toBeGreaterThan(0)
  })
})

describe('buildExportCsv', () => {
  it('creates valid CSV blob with BOM', () => {
    const blob = buildExportCsv(sampleMembers)
    expect(blob.type).toBe('text/csv;charset=utf-8;')
    expect(blob.size).toBeGreaterThan(0)
  })

  it('includes headers and all rows', async () => {
    const blob = buildExportCsv(sampleMembers)
    const text = await blob.text()
    const lines = text.split('\r\n')
    expect(lines[0]).toContain('memberId')
    expect(lines[0]).toContain('fullName')
    expect(lines.length).toBe(4) // header + 3 data rows
  })

  it('handles empty docs array', () => {
    const blob = buildExportCsv([])
    expect(blob.size).toBeGreaterThan(0)
    // Should still have BOM (length 3 in UTF-8 bytes)
    expect(blob.size).toBe(3) // Just BOM
  })

  it('escapes commas and quotes', async () => {
    const data = [{ name: 'Test, Inc.', description: 'Has "quotes"' }]
    const blob = buildExportCsv(data)
    const text = await blob.text()
    expect(text).toContain('"Test, Inc."')
    expect(text).toContain('"Has ""quotes"""')
  })

  it('respects custom columns', async () => {
    const blob = buildExportCsv(sampleMembers, ['fullName', 'phone'])
    const text = await blob.text()
    const lines = text.split('\r\n')
    expect(lines[0]).toBe('fullName,phone')
    expect(lines[1]).toContain('रत्नकाजी शाक्य')
    expect(lines[1]).toContain('9841234567')
  })
})

describe('buildExportExcel', () => {
  it('creates valid Excel blob', async () => {
    const blob = await buildExportExcel('members', sampleMembers)
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    expect(blob.size).toBeGreaterThan(0)
  })

  it('creates workbook with data sheet and meta sheet', async () => {
    const blob = await buildExportExcel('members', sampleMembers)
    const arrayBuffer = await blob.arrayBuffer()
    const workbook = await import('exceljs').then((m) => {
      const wb = new m.Workbook()
      return wb.xlsx.load(arrayBuffer)
    })
    const sheetNames = workbook.worksheets.map((s: any) => s.name)
    expect(sheetNames).toContain('members')
    expect(sheetNames).toContain('_Meta')
  })

  it('includes metadata in _Meta sheet', async () => {
    const blob = await buildExportExcel('members', sampleMembers, { tenantName: 'Test Tenant' })
    const arrayBuffer = await blob.arrayBuffer()
    const { Workbook } = await import('exceljs')
    const workbook = new Workbook()
    await workbook.xlsx.load(arrayBuffer)
    const metaSheet = workbook.getWorksheet('_Meta')
    const metaData: Record<string, string> = {}
    metaSheet?.eachRow((row: any, rowNumber: number) => {
      if (rowNumber > 1) {
        const prop = row.getCell(1).value as string
        const val = row.getCell(2).value
        if (prop) metaData[prop] = String(val)
      }
    })
    expect(metaData['Collection']).toBe('members')
    expect(metaData['Tenant']).toBe('Test Tenant')
    expect(metaData['Record Count']).toBe('3')
  })

  it('applies header styling', async () => {
    const blob = await buildExportExcel('members', sampleMembers)
    const arrayBuffer = await blob.arrayBuffer()
    const { Workbook } = await import('exceljs')
    const workbook = new Workbook()
    await workbook.xlsx.load(arrayBuffer)
    const dataSheet = workbook.getWorksheet('members')
    const headerRow = dataSheet?.getRow(1)
    expect(headerRow?.font?.bold).toBe(true)
    expect(headerRow?.fill?.fgColor?.argb).toBe('FFBE1A1A') // crimson-700
  })

  it('freezes header row', async () => {
    const blob = await buildExportExcel('members', sampleMembers)
    const arrayBuffer = await blob.arrayBuffer()
    const { Workbook } = await import('exceljs')
    const workbook = new Workbook()
    await workbook.xlsx.load(arrayBuffer)
    const dataSheet = workbook.getWorksheet('members')
    expect(dataSheet?.views?.[0]?.ySplit).toBe(1)
  })

  it('applies auto-filter', async () => {
    const blob = await buildExportExcel('members', sampleMembers)
    const arrayBuffer = await blob.arrayBuffer()
    const { Workbook } = await import('exceljs')
    const workbook = new Workbook()
    await workbook.xlsx.load(arrayBuffer)
    const dataSheet = workbook.getWorksheet('members')
    expect(dataSheet?.autoFilter).toBeDefined()
    expect(dataSheet?.autoFilter).toBe('A1:I4') // depends on data length
  })

  it('uses custom columns when provided', async () => {
    const customColumns = [
      { key: 'fullName', header: 'Name', width: 40 },
      { key: 'phone', header: 'Phone', width: 20 },
    ]
    const blob = await buildExportExcel('members', sampleMembers, { columns: customColumns })
    const arrayBuffer = await blob.arrayBuffer()
    const { Workbook } = await import('exceljs')
    const workbook = new Workbook()
    await workbook.xlsx.load(arrayBuffer)
    const dataSheet = workbook.getWorksheet('members')
    expect(dataSheet?.getCell('A1').value).toBe('Name')
    expect(dataSheet?.getCell('B1').value).toBe('Phone')
    expect(dataSheet?.getCell('C1').value).toBeNull()
  })

  it('handles empty docs array', async () => {
    const blob = await buildExportExcel('members', [])
    expect(blob.size).toBeGreaterThan(0)
  })

  it('handles Nepali/Devanagari text', async () => {
    const blob = await buildExportExcel('members', sampleMembers)
    const arrayBuffer = await blob.arrayBuffer()
    const { Workbook } = await import('exceljs')
    const workbook = new Workbook()
    await workbook.xlsx.load(arrayBuffer)
    const dataSheet = workbook.getWorksheet('members')
    const nameCell = dataSheet?.getCell('B2')
    expect(nameCell?.value).toBe('रत्नकाजी शाक्य')
  })
})

describe('parseCsvText', () => {
  it('parses simple CSV', () => {
    const csv = 'name,phone\nJohn,123456\nJane,789012'
    const result = parseCsvText(csv)
    expect(result).toHaveLength(2)
    expect(result[0].fullName).toBe('John') // normalized from name
    expect(result[1].phone).toBe('789012')
  })

  it('handles quoted fields with commas', () => {
    const csv = 'name,description\n"Test, Inc.","Has, comma"'
    const result = parseCsvText(csv)
    expect(result[0].fullName).toBe('Test, Inc.') // normalized from name
    expect(result[0].description).toBe('Has, comma')
  })

  it('handles escaped quotes', () => {
    const csv = 'name,description\n"Has ""quotes""","Normal"'
    const result = parseCsvText(csv)
    expect(result[0].fullName).toBe('Has "quotes"') // normalized from name
  })

  it('normalizes Nepali headers', () => {
    const csv = 'नाम,फोन\nरत्न,9841234567'
    const result = parseCsvText(csv)
    expect(result[0]).toHaveProperty('fullName')
    expect(result[0]).toHaveProperty('phone')
  })

  it('handles empty lines', () => {
    const csv = 'name,phone\n\nJohn,123\n\n'
    const result = parseCsvText(csv)
    expect(result).toHaveLength(1)
  })

  it('strips BOM', () => {
    const csv = '\uFEFFname,phone\nJohn,123'
    const result = parseCsvText(csv)
    expect(result[0].fullName).toBe('John') // normalized from name
  })
})

describe('parseExcelFile', () => {
  it('parses Excel file to ParsedImport', async () => {
    // Create a test Excel file
    const { Workbook } = await import('exceljs')
    const workbook = new Workbook()
    const sheet = workbook.addWorksheet('Members')
    sheet.addRow(['fullName', 'phone'])
    sheet.addRow(['रत्नकाजी शाक्य', '9841234567'])
    const buffer = await workbook.xlsx.writeBuffer()
    const file = new File([buffer], 'members.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

    const result = await parseExcelFile(file)
    expect(result.collection).toBe('members')
    expect(result.docs).toHaveLength(1)
    expect(result.docs[0].fullName).toBe('रत्नकाजी शाक्य')
    expect(result.meta.format).toBe('excel')
  })

  it('reads meta sheet if present', async () => {
    const { Workbook } = await import('exceljs')
    const workbook = new Workbook()
    const metaSheet = workbook.addWorksheet('_Meta')
    metaSheet.addRow(['Property', 'Value'])
    metaSheet.addRow(['Collection', 'members'])
    metaSheet.addRow(['Tenant', 'Test Tenant'])
    metaSheet.addRow(['Record Count', 1])

    const dataSheet = workbook.addWorksheet('Members')
    dataSheet.addRow(['fullName', 'phone'])
    dataSheet.addRow(['Test User', '123456'])

    const buffer = await workbook.xlsx.writeBuffer()
    const file = new File([buffer], 'members.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

    const result = await parseExcelFile(file)
    expect(result.meta.tenant).toBe('Test Tenant')
    expect(result.collection).toBe('members')
  })

  it('normalizes headers (same as CSV)', async () => {
    const { Workbook } = await import('exceljs')
    const workbook = new Workbook()
    const sheet = workbook.addWorksheet('Data')
    sheet.addRow(['नाम', 'फोन']) // Nepali headers
    sheet.addRow(['टेस्ट', '9876543210'])
    const buffer = await workbook.xlsx.writeBuffer()
    const file = new File([buffer], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

    const result = await parseExcelFile(file)
    expect(result.docs[0]).toHaveProperty('fullName')
    expect(result.docs[0]).toHaveProperty('phone')
  })

  it('handles date cells', async () => {
    const { Workbook } = await import('exceljs')
    const workbook = new Workbook()
    const sheet = workbook.addWorksheet('Data')
    sheet.addRow(['name', 'date'])
    const date = new Date('2024-01-15')
    sheet.addRow(['Test', date])
    const buffer = await workbook.xlsx.writeBuffer()
    const file = new File([buffer], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

    const result = await parseExcelFile(file)
    expect(result.docs[0].date).toContain('2024-01-15')
  })

  it('throws on corrupt file', async () => {
    const file = new File(['not excel'], 'corrupt.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    await expect(parseExcelFile(file)).rejects.toThrow()
  })
})

describe('parseImportFile (unified)', () => {
  it('routes .json to JSON parser', async () => {
    const json = JSON.stringify({ docs: [{ name: 'Test' }], _export: { collection: 'test' } })
    const file = new File([json], 'test.json', { type: 'application/json' })
    const result = await parseImportFile(file)
    expect(result.collection).toBe('test')
    expect(result.meta.format).toBe('json')
  })

  it('routes .csv to CSV parser', async () => {
    const csv = 'name,phone\nJohn,123'
    const file = new File([csv], 'test.csv', { type: 'text/csv' })
    const result = await parseImportFile(file)
    expect(result.meta.format).toBe('csv')
  })

  it('routes .xlsx to Excel parser', async () => {
    const { Workbook } = await import('exceljs')
    const workbook = new Workbook()
    const sheet = workbook.addWorksheet('Data')
    sheet.addRow(['name', 'phone'])
    sheet.addRow(['John', '123'])
    const buffer = await workbook.xlsx.writeBuffer()
    const file = new File([buffer], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

    const result = await parseImportFile(file)
    expect(result.meta.format).toBe('excel')
  })

  it('handles bare array JSON', async () => {
    const json = JSON.stringify([{ name: 'Test' }])
    const file = new File([json], 'test.json', { type: 'application/json' })
    const result = await parseImportFile(file)
    expect(result.docs).toHaveLength(1)
    expect(result.meta.format).toBe('json')
  })

  it('guesses collection from filename', async () => {
    const csv = 'name,phone\nJohn,123'
    const file = new File([csv], 'members_export.csv', { type: 'text/csv' })
    const result = await parseImportFile(file)
    expect(result.collection).toBe('members')
  })
})

describe('classifyRecords', () => {
  it('detects exact ID duplicates for members', () => {
    const imported = [
      { id: 1, fullName: 'रत्नकाजी शाक्य', phone: '9841234567' },
      { fullName: 'नयाँ सदस्य', phone: '9800000000' },
    ]
    const result = classifyRecords(imported, existingMembers, 'members')
    expect(result.exactDuplicates).toHaveLength(1)
    expect(result.exactDuplicates[0].imported.id).toBe(1)
    expect(result.newRecords).toHaveLength(1)
  })

  it('detects fuzzy name/phone duplicates for members', () => {
    const imported = [
      { fullName: 'रत्नकाजी शाक्य', phone: '9841234567' }, // exact match on phone
      { fullName: 'नयाँ सदस्य', phone: '9800000000' },
    ]
    const result = classifyRecords(imported, existingMembers, 'members')
    expect(result.similarRecords).toHaveLength(1)
    expect(result.similarRecords[0].matchField).toBe('fullName') // Matches fullName first since it's earlier in the DEDUP_KEYS list
    expect(result.newRecords).toHaveLength(1)
  })

  it('detects code duplicates for accounts', () => {
    const imported = [
      { code: '1000', name: 'Cash Updated', type: 'asset' },
      { code: '9999', name: 'New Account', type: 'asset' },
    ]
    const result = classifyRecords(imported, existingAccounts, 'accounts')
    expect(result.similarRecords).toHaveLength(1)
    expect(result.similarRecords[0].matchField).toBe('code')
    expect(result.newRecords).toHaveLength(1)
  })

  it('returns all newRecords when existing is empty', () => {
    const imported = [{ fullName: 'Test', phone: '123' }]
    const result = classifyRecords(imported, [], 'members')
    expect(result.newRecords).toHaveLength(1)
    expect(result.exactDuplicates).toHaveLength(0)
    expect(result.similarRecords).toHaveLength(0)
  })

  it('handles missing id field', () => {
    const imported = [{ fullName: 'रत्नकाजी शाक्य', phone: '9841234567' }] // no id
    const result = classifyRecords(imported, existingMembers, 'members')
    // Should match by phone (fuzzy)
    expect(result.similarRecords).toHaveLength(1)
  })
})

describe('validateImportRows', () => {
  it('validates required fields for members', () => {
    const docs = [
      { fullName: 'Valid User', phone: '9841234567' },
      { fullName: '', phone: '9851029384' }, // missing name
      { fullName: 'Another User', phone: 'invalid' }, // invalid phone
    ]
    const { valid, errors } = validateImportRows(docs, 'members')
    expect(valid).toHaveLength(2)
    expect(errors.filter((e) => e.severity === 'error')).toHaveLength(1)
    expect(errors.filter((e) => e.severity === 'warning')).toHaveLength(1)
  })

  it('validates account type', () => {
    const docs = [
      { name: 'Valid Account', type: 'asset' },
      { name: '', type: 'asset' }, // missing name
      { name: 'Invalid Type', type: 'invalid' }, // invalid type
    ]
    const { valid, errors } = validateImportRows(docs, 'accounts')
    expect(valid).toHaveLength(1)
    expect(errors.filter((e) => e.severity === 'error')).toHaveLength(2)
  })

  it('validates party name', () => {
    const docs = [
      { name: 'Valid Party' },
      { name: '' }, // missing name
    ]
    const { valid, errors } = validateImportRows(docs, 'parties')
    expect(valid).toHaveLength(1)
    expect(errors.filter((e) => e.severity === 'error')).toHaveLength(1)
  })

  it('validates item name', () => {
    const docs = [
      { name: 'Valid Item' },
      { name: '' }, // missing name
    ]
    const { valid, errors } = validateImportRows(docs, 'items')
    expect(valid).toHaveLength(1)
    expect(errors.filter((e) => e.severity === 'error')).toHaveLength(1)
  })

  it('passes unknown collections through', () => {
    const docs = [{ foo: 'bar' }]
    const { valid, errors } = validateImportRows(docs, 'unknown')
    expect(valid).toHaveLength(1)
    expect(errors).toHaveLength(0)
  })
})

import { api } from '../../src/lib/api'

describe('executeImport', () => {
  const mockApi = api as unknown as import('vitest').Mock

  beforeEach(() => {
    mockApi.mockClear()
  })

  it('creates new records via POST', async () => {
    mockApi.mockResolvedValue({ id: 999 })
    const records = [{ doc: { name: 'New' }, action: 'create' as const }]
    const result = await executeImport('test', records)
    expect(result.created).toBe(1)
    expect(mockApi).toHaveBeenCalledWith('/test', { method: 'POST', body: { name: 'New' } })
  })

  it('updates existing records via PATCH', async () => {
    mockApi.mockResolvedValue({})
    const records = [{ doc: { id: 1, name: 'Updated' }, action: 'update' as const }]
    const result = await executeImport('test', records)
    expect(result.updated).toBe(1)
    expect(mockApi).toHaveBeenCalledWith('/test/1', { method: 'PATCH', body: { name: 'Updated' } })
  })

  it('skips when action is skip', async () => {
    const records = [{ doc: { id: 1, name: 'Skip' }, action: 'skip' as const }]
    const result = await executeImport('test', records)
    expect(result.skipped).toBe(1)
    expect(mockApi).not.toHaveBeenCalled()
  })

  it('tracks errors', async () => {
    mockApi.mockRejectedValue(new Error('Network error'))
    const records = [{ doc: { name: 'Fail' }, action: 'create' as const }]
    const result = await executeImport('test', records)
    expect(result.created).toBe(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('Network error')
  })

  it('calls onProgress callback', async () => {
    mockApi.mockResolvedValue({})
    const onProgress = vi.fn()
    const records = [
      { doc: { name: 'A' }, action: 'create' as const },
      { doc: { name: 'B' }, action: 'create' as const },
    ]
    await executeImport('test', records, onProgress)
    expect(onProgress).toHaveBeenCalledTimes(2)
    expect(onProgress).toHaveBeenCalledWith(1, 2)
    expect(onProgress).toHaveBeenCalledWith(2, 2)
  })
})

describe('EXPORT_COLUMNS', () => {
  it('defines columns for all collections', () => {
    expect(EXPORT_COLUMNS.members).toBeDefined()
    expect(EXPORT_COLUMNS.parties).toBeDefined()
    expect(EXPORT_COLUMNS.items).toBeDefined()
    expect(EXPORT_COLUMNS.accounts).toBeDefined()
    expect(EXPORT_COLUMNS.documents).toBeDefined()
    expect(EXPORT_COLUMNS['journal-entries']).toBeDefined()
  })

  it('has key and header for each column', () => {
    for (const cols of Object.values(EXPORT_COLUMNS)) {
      for (const col of cols) {
        expect(col.key).toBeTruthy()
        expect(col.header).toBeTruthy()
        expect(col.width).toBeGreaterThan(0)
      }
    }
  })
})