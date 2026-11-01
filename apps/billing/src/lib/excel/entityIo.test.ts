/**
 * Per-entity Excel I/O tests (MISSION.md M2, ADR-0004).
 *
 * Covers buildEntityExcel (registry-driven sheet + _Meta), parseEntityExcel
 * (round-trip, header aliases, `_`-prefixed derived columns skipped), and
 * buildTemplate (headers + example row + _ReadMe glossary).
 */
import { describe, it, expect } from 'vitest'
import { Workbook } from 'exceljs'
import {
  buildEntityExcel,
  parseEntityExcel,
  buildTemplate,
  getDocValue,
} from './entityIo'
import { ENTITY_REGISTRY } from './entities'

async function loadWorkbook(blob: Blob): Promise<Workbook> {
  const wb = new Workbook()
  await wb.xlsx.load(await blob.arrayBuffer())
  return wb
}

const parties = [
  {
    type: 'customer',
    name: 'किरण ट्रेडिङ',
    email: 'kiran@example.com',
    phone: '9841234567',
    taxId: '301234567',
    address: 'मंगलबजार, काठमाडौं',
    openingBalance: 1500,
    donor: false,
  },
  {
    type: 'vendor',
    name: 'Everest Supplies',
    email: 'sales@everest.example',
    phone: '9851029384',
    taxId: '601112223',
    address: 'पोखरा',
    openingBalance: 0,
    donor: true,
  },
]

describe('buildEntityExcel', () => {
  it('creates the registry sheet name plus a _Meta sheet', async () => {
    const blob = await buildEntityExcel('parties', parties, { tenantName: 'Test Org' })
    const wb = await loadWorkbook(blob)
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Parties', '_Meta'])
  })

  it('writes registry headers in order on row 1', async () => {
    const blob = await buildEntityExcel('parties', parties)
    const wb = await loadWorkbook(blob)
    const sheet = wb.getWorksheet('Parties')!
    const headers: string[] = []
    sheet.getRow(1).eachCell((cell, col) => {
      headers[col - 1] = String(cell.value ?? '')
    })
    const expected = ENTITY_REGISTRY.get('parties')!.columns.map((c) => c.header)
    expect(headers).toEqual(expected)
  })

  it('records the collection slug in _Meta (drives import routing)', async () => {
    const blob = await buildEntityExcel('parties', parties, { tenantName: 'Org' })
    const wb = await loadWorkbook(blob)
    const meta = wb.getWorksheet('_Meta')!
    const kv: Record<string, unknown> = {}
    meta.eachRow((row, n) => {
      if (n > 1) kv[String(row.getCell(1).value)] = row.getCell(2).value
    })
    expect(kv.Collection).toBe('parties')
    expect(kv.Tenant).toBe('Org')
    expect(kv['Record Count']).toBe(2)
  })

  it('preserves Devanagari text and numbers', async () => {
    const blob = await buildEntityExcel('parties', parties)
    const wb = await loadWorkbook(blob)
    const sheet = wb.getWorksheet('Parties')!
    expect(sheet.getCell('B2').value).toBe('किरण ट्रेडिङ')
    expect(sheet.getCell('G2').value).toBe(1500)
  })

  it('flattens relation objects to their display name', async () => {
    const docs = [
      { number: 'SI-2083-84-0001', docType: 'sales-invoice', date: '2026-04-01', party: { id: 7, name: 'Kiran Trading' }, narration: 'Sale', status: 'posted' },
    ]
    const blob = await buildEntityExcel('documents', docs)
    const wb = await loadWorkbook(blob)
    const sheet = wb.getWorksheet('Vouchers')!
    expect(sheet.getCell('D2').value).toBe('Kiran Trading')
  })

  it('reads nested fields via column source paths (members)', async () => {
    const docs = [
      {
        memberId: 'M-001',
        fullName: 'अनिता श्रेष्ठ',
        email: 'anita@example.com',
        phoneNumber: '9803948123',
        idCardDetails: { bloodGroup: 'B+' },
        application: { appliedDateBs: '2081-07-10' },
        status: 'active',
      },
    ]
    const blob = await buildEntityExcel('members', docs)
    const wb = await loadWorkbook(blob)
    const sheet = wb.getWorksheet('Members')!
    // headers: Member ID | Full Name | Email | Phone | Blood Group | ...
    expect(sheet.getCell('D2').value).toBe('9803948123') // phone ← phoneNumber
    expect(sheet.getCell('E2').value).toBe('B+') // bloodGroup ← idCardDetails
    expect(sheet.getCell('G2').value).toBe('2081-07-10') // appliedDateBs ← application
  })

  it('serializes array columns (rows/lines) as JSON text', async () => {
    const docs = [
      {
        accountCode: '1010',
        periodStart: '2083-04-01',
        periodEnd: '2083-04-30',
        openingBalance: 1000,
        closingBalance: 2500,
        rows: [{ date: '2083-04-05', amount: 1500, description: 'Deposit' }],
      },
    ]
    const blob = await buildEntityExcel('bank-statements', docs)
    const wb = await loadWorkbook(blob)
    const sheet = wb.getWorksheet('Bank Statements')!
    const cell = String(sheet.getCell('F2').value)
    expect(cell).toContain('"Deposit"')
    expect(() => JSON.parse(cell)).not.toThrow()
  })

  it('handles an empty dataset (headers only)', async () => {
    const blob = await buildEntityExcel('parties', [])
    const wb = await loadWorkbook(blob)
    const sheet = wb.getWorksheet('Parties')!
    expect(sheet.rowCount).toBe(1)
    expect(blob.size).toBeGreaterThan(0)
  })

  it('throws for an unknown slug', async () => {
    await expect(buildEntityExcel('not-an-entity', [])).rejects.toThrow(/not in the registry/)
  })

  it('exports the chart of accounts hierarchically via the CoA builder', async () => {
    const docs = [
      { code: '1000', name: 'Cash', type: 'asset', class: 'cash', group: 'Current Assets', openingBalance: 50000 },
      { code: '1010', name: 'Bank', type: 'asset', class: 'bank', group: 'Current Assets', openingBalance: 250000 },
    ]
    const blob = await buildEntityExcel('gl-accounts', docs)
    const wb = await loadWorkbook(blob)
    expect(wb.worksheets.map((w) => w.name)).toContain('Chart of Accounts')
    const sheet = wb.getWorksheet('Chart of Accounts')!
    // Group header row: name may land in A or B depending on merge handling
    const groupCell = sheet.getCell('A2').value ?? sheet.getCell('B2').value
    expect(String(groupCell)).toBe('Current Assets')
  })

  it('expands journal entries into one row per line', async () => {
    const docs = [
      {
        date: '2026-04-01',
        narration: 'Sale',
        status: 'posted',
        referenceDoc: { id: 1, number: 'SI-2083-84-0001' },
        lines: [
          { account: { code: '1000', name: 'Cash' }, debit: 565, credit: 0, memo: 'cash' },
          { account: { code: '4000', name: 'Membership Sales' }, debit: 0, credit: 565, memo: '' },
        ],
      },
    ]
    const blob = await buildEntityExcel('journal-entries', docs)
    const wb = await loadWorkbook(blob)
    const sheet = wb.getWorksheet('Journal Entries')!
    expect(sheet.rowCount).toBe(3) // header + 2 lines
    expect(sheet.getCell('A2').value).toBe('2026-04-01')
    expect(sheet.getCell('B2').value).toBe('SI-2083-84-0001') // voucherNo ← referenceDoc.number
    expect(sheet.getCell('E2').value).toBe('1000') // accountCode
    expect(sheet.getCell('H3').value).toBe(565) // credit (column H) on second line
  })
})

describe('getDocValue', () => {
  it('follows dotted paths', () => {
    expect(getDocValue({ a: { b: { c: 42 } } }, 'a.b.c')).toBe(42)
  })

  it('returns undefined for missing paths', () => {
    expect(getDocValue({}, 'a.b')).toBeUndefined()
    expect(getDocValue({ a: null }, 'a')).toBeUndefined()
  })

  it('flattens relation objects with name/title/fullName fallbacks', () => {
    expect(getDocValue({ p: { name: 'X' } }, 'p')).toBe('X')
    expect(getDocValue({ p: { title: 'T' } }, 'p')).toBe('T')
    expect(getDocValue({ p: { id: 9 } }, 'p')).toBe(9)
  })

  it('keeps falsy primitives (0 / false / empty string)', () => {
    expect(getDocValue({ n: 0 }, 'n')).toBe(0)
    expect(getDocValue({ b: false }, 'b')).toBe(false)
    expect(getDocValue({ s: '' }, 's')).toBe('')
  })
})

describe('parseEntityExcel', () => {
  it('round-trips a buildEntityExcel export', async () => {
    const blob = await buildEntityExcel('parties', parties)
    const file = new File([blob], 'download.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const parsed = await parseEntityExcel(file)
    expect(parsed.collection).toBe('parties')
    expect(parsed.docs).toHaveLength(2)
    expect(parsed.docs[0].name).toBe('किरण ट्रेडिङ')
    expect(parsed.docs[0].phone).toBe('9841234567')
    expect(parsed.docs[1].openingBalance).toBe(0)
    expect(parsed.meta.format).toBe('excel')
  })

  it('takes the collection from _Meta over the filename', async () => {
    const blob = await buildEntityExcel('gl-accounts', [
      { code: '1000', name: 'Cash', type: 'asset', class: 'cash', group: 'Current Assets', openingBalance: 0, active: true },
    ])
    const file = new File([blob], 'mystery-file.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const parsed = await parseEntityExcel(file)
    expect(parsed.collection).toBe('gl-accounts')
    expect(parsed.docs[0].code).toBe('1000')
  })

  it('applies per-entity header aliases (members name → fullName)', async () => {
    const { Workbook: WB } = await import('exceljs')
    const wb = new WB()
    const meta = wb.addWorksheet('_Meta')
    meta.addRow(['Property', 'Value'])
    meta.addRow(['Collection', 'members'])
    const sheet = wb.addWorksheet('Members')
    sheet.addRow(['name', 'phone'])
    sheet.addRow(['गोपाल ढकाल', '9800000000'])
    const file = new File([await wb.xlsx.writeBuffer()], 'members.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

    const parsed = await parseEntityExcel(file)
    expect(parsed.collection).toBe('members')
    expect(parsed.docs[0].fullName).toBe('गोपाल ढकाल')
    expect(parsed.docs[0].phone).toBe('9800000000')
  })

  it('skips `_`-prefixed derived columns (round-trip rule)', async () => {
    const { Workbook: WB } = await import('exceljs')
    const wb = new WB()
    const meta = wb.addWorksheet('_Meta')
    meta.addRow(['Property', 'Value'])
    meta.addRow(['Collection', 'journal-entries'])
    const sheet = wb.addWorksheet('Journal Entries')
    sheet.addRow(['date', 'voucherNo', 'accountCode', 'debit', 'credit', '_accountName'])
    sheet.addRow(['2026-04-01', 'SI-1', '1000', 500, 0, 'Cash'])
    const file = new File([await wb.xlsx.writeBuffer()], 'journal.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

    const parsed = await parseEntityExcel(file)
    expect(parsed.docs[0]).not.toHaveProperty('_accountName')
    expect(parsed.docs[0].accountCode).toBe('1000')
  })

  it('throws on a corrupt file', async () => {
    const file = new File(['not an xlsx'], 'corrupt.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    await expect(parseEntityExcel(file)).rejects.toThrow()
  })
})

describe('buildTemplate', () => {
  it('produces headers plus one marked example row', async () => {
    const blob = await buildTemplate('parties')
    const wb = await loadWorkbook(blob)
    const sheet = wb.getWorksheet('Parties')!
    expect(sheet.rowCount).toBe(2) // header + example
    expect(String(sheet.getCell('B2').value)).toContain('Example')
  })

  it('includes a _ReadMe glossary listing every column', async () => {
    const blob = await buildTemplate('items')
    const wb = await loadWorkbook(blob)
    const readme = wb.getWorksheet('_ReadMe')!
    expect(readme).toBeDefined()
    const text: string[] = []
    readme.eachRow((row) =>
      row.eachCell((cell) => text.push(String(cell.value ?? ''))),
    )
    const joined = text.join(' | ')
    expect(joined).toContain('Valuation') // items column header
    expect(joined).toContain('How to use')
  })

  it('records the collection in _Meta for import routing', async () => {
    const blob = await buildTemplate('tax-types')
    const wb = await loadWorkbook(blob)
    const meta = wb.getWorksheet('_Meta')!
    let collection = ''
    meta.eachRow((row, n) => {
      if (n > 1 && String(row.getCell(1).value) === 'Collection') {
        collection = String(row.getCell(2).value)
      }
    })
    expect(collection).toBe('tax-types')
  })

  it('throws for an unknown slug', async () => {
    await expect(buildTemplate('nope')).rejects.toThrow(/not in the registry/)
  })
})
