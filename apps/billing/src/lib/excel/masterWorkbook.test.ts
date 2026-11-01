/**
 * Master workbook export tests (MISSION.md M4, OBJ-3).
 *
 * One .xlsx with _Index + _Manifest + one sheet per registry entity, sheets
 * linked via FK business keys, INDEX/MATCH display columns, SUMIF cross-sheet
 * totals, and data-validation dropdowns on FK columns.
 */
import { describe, it, expect } from 'vitest'
import { Workbook } from 'exceljs'
import { buildMasterWorkbook } from './masterWorkbook'
import { ENTITY_REGISTRY } from './entities'

async function load(blob: Blob): Promise<Workbook> {
  const wb = new Workbook()
  await wb.xlsx.load(await blob.arrayBuffer())
  return wb
}

/** Sample docs — only 4 entities carry data; the rest are header-only. */
const DOCS = {
  'fiscal-years': [
    { label: '2083-84', startDate: '2026-07-16', endDate: '2027-07-15', status: 'active', isActive: true },
  ],
  'account-groups': [
    { code: 'CA', name: 'Current Assets', type: 'asset', parent: '', description: '', sortOrder: 1 },
  ],
  'gl-accounts': [
    { code: '1000', name: 'Cash in Hand', type: 'asset', class: 'cash', group: 'Current Assets', openingBalance: 50000, active: true },
    { code: '4000', name: 'Membership Sales', type: 'income', class: 'other', group: 'Revenue', openingBalance: 0, active: true },
  ],
  parties: [
    { type: 'customer', name: 'किरण ट्रेडिङ', email: '', phone: '9841234567', taxId: '', address: 'काठमाडौं', openingBalance: 0, donor: false },
  ],
  documents: [
    { number: 'SI-2083-84-0001', docType: 'sales-invoice', date: '2026-04-01', party: 'किरण ट्रेडिङ', narration: 'April fee', status: 'posted' },
  ],
  'journal-entries': [
    { date: '2026-04-01', voucherNo: 'SI-2083-84-0001', narration: 'April fee', status: 'posted', accountCode: '1000', accountName: 'Cash in Hand', debit: 565, credit: 0, memo: 'cash' },
    { date: '2026-04-01', voucherNo: 'SI-2083-84-0001', narration: 'April fee', status: 'posted', accountCode: '4000', accountName: 'Membership Sales', debit: 0, credit: 565, memo: '' },
  ],
} as Record<string, Record<string, unknown>[]>

describe('buildMasterWorkbook — structure', () => {
  it('produces _Index, _Manifest, then every registry sheet in import order', async () => {
    const wb = await load(await buildMasterWorkbook(DOCS, { tenantName: 'Test Org' }))
    const names = wb.worksheets.map((w) => w.name)
    expect(names[0]).toBe('_Index')
    expect(names[1]).toBe('_Manifest')

    const expected = [...ENTITY_REGISTRY].sort((a, b) => a.importOrder - b.importOrder).map((e) => e.sheetName)
    expect(names.slice(2)).toEqual(expected)
    expect(names).toHaveLength(2 + ENTITY_REGISTRY.length)
  })

  it('includes header-only sheets for entities with no data', async () => {
    const wb = await load(await buildMasterWorkbook(DOCS))
    const sheet = wb.getWorksheet('Fixed Assets')!
    expect(sheet).toBeDefined()
    expect(sheet.rowCount).toBe(1)
    expect(sheet.getCell('A1').value).toBe('Asset Code')
  })

  it('writes entity data rows under registry headers', async () => {
    const wb = await load(await buildMasterWorkbook(DOCS))
    const sheet = wb.getWorksheet('Members')! // no member data → headers only
    expect(sheet.getCell('A1').value).toBe('Member ID')
    const journal = wb.getWorksheet('Journal Entries')!
    expect(journal.getCell('A1').value).toBe('Date')
    expect(journal.getCell('E1').value).toBe('Account Code')
    expect(journal.rowCount).toBe(3) // header + 2 lines
    expect(journal.getCell('B2').value).toBe('SI-2083-84-0001')
  })
})

describe('buildMasterWorkbook — _Manifest', () => {
  it('records format version, tenant and timestamp', async () => {
    const wb = await load(await buildMasterWorkbook(DOCS, { tenantName: 'स्यस्यः' }))
    const sheet = wb.getWorksheet('_Manifest')!
    const kv: Record<string, unknown> = {}
    sheet.eachRow((row, n) => {
      if (n > 4) return
      kv[String(row.getCell(1).value)] = row.getCell(2).value
    })
    expect(kv.FormatVersion).toBe(1)
    expect(kv.Tenant).toBe('स्यस्यः')
    expect(kv.ExportedAt).toBeTruthy()
    expect(kv.EntityCount).toBe(ENTITY_REGISTRY.length)
  })

  it('maps every sheet → slug → import order → columns (excluding `_` derived)', async () => {
    const wb = await load(await buildMasterWorkbook(DOCS))
    const sheet = wb.getWorksheet('_Manifest')!
    const rows: Record<string, string>[] = []
    let inTable = false
    sheet.eachRow((row, n) => {
      const c1 = String(row.getCell(1).value ?? '')
      if (c1 === 'Sheet') {
        inTable = true
        return
      }
      if (inTable && c1) {
        rows.push({
          sheet: c1,
          slug: String(row.getCell(2).value ?? ''),
          order: String(row.getCell(3).value ?? ''),
          columns: String(row.getCell(4).value ?? ''),
        })
      }
    })
    expect(rows).toHaveLength(ENTITY_REGISTRY.length)
    const journal = rows.find((r) => r.slug === 'journal-entries')!
    expect(journal.sheet).toBe('Journal Entries')
    expect(journal.order).toBe('110')
    expect(journal.columns.split(',')).toContain('accountCode')
    expect(journal.columns.split(',').every((c) => !c.startsWith('_'))).toBe(true)
  })
})

describe('buildMasterWorkbook — linking', () => {
  it('adds INDEX/MATCH display columns for FK links', async () => {
    const wb = await load(await buildMasterWorkbook(DOCS))
    const journal = wb.getWorksheet('Journal Entries')!
    // Find a derived (`_`-prefixed) column whose formula looks up accounts.
    let found = false
    journal.getRow(1).eachCell((c, i) => {
      const h = String(c.value ?? '')
      if (!h.startsWith('_')) return
      const f = journal.getCell(2, i).value as { formula?: string }
      if (f && typeof f === 'object' && f.formula?.includes("'Chart of Accounts'")) {
        found = true
        expect(f.formula).toContain('MATCH')
        expect(f.formula).toContain('IFERROR')
      }
    })
    expect(found).toBe(true)
  })

  it('adds SUMIF cross-sheet totals and a balance check on Vouchers', async () => {
    const wb = await load(await buildMasterWorkbook(DOCS))
    const vouchers = wb.getWorksheet('Vouchers')!
    const headers: string[] = []
    vouchers.getRow(1).eachCell((c, i) => (headers[i - 1] = String(c.value ?? '')))
    const debitIdx = headers.indexOf('_debitTotal')
    const balancedIdx = headers.indexOf('_balanced')
    expect(debitIdx).toBeGreaterThan(0)
    expect(balancedIdx).toBeGreaterThan(0)

    const debitCell = vouchers.getCell(2, debitIdx + 1).value as { formula?: string }
    expect(debitCell.formula).toContain('SUMIF')
    expect(debitCell.formula).toContain("'Journal Entries'")
  })

  it('adds data-validation dropdowns on FK columns', async () => {
    const wb = await load(await buildMasterWorkbook(DOCS))
    const journal = wb.getWorksheet('Journal Entries')!
    // accountCode = column E
    const dv = journal.getCell('E2').dataValidation
    expect(dv).toBeDefined()
    expect(dv?.type).toBe('list')
    const formulae = JSON.stringify(dv?.formulae ?? [])
    expect(formulae).toContain('Chart of Accounts')
  })

  it('adds hyperlinks and live record counts to _Index', async () => {
    const wb = await load(await buildMasterWorkbook(DOCS))
    const index = wb.getWorksheet('_Index')!
    const text: string[] = []
    const formulas: string[] = []
    index.eachRow((row) =>
      row.eachCell((c) => {
        const v = c.value as { text?: unknown; hyperlink?: string } | string | { formula?: string } | null
        if (v && typeof v === 'object' && 'hyperlink' in v) {
          text.push(String(v.text ?? ''))
          expect(v.hyperlink).toMatch(/^#'/)
        }
        if (v && typeof v === 'object' && 'formula' in v) formulas.push(String(v.formula))
      }),
    )
    expect(text).toContain('Journal Entries')
    expect(text).toContain('Chart of Accounts')
    expect(formulas.some((f) => f.includes('COUNTA'))).toBe(true)
    // Trial-balance check: debit sum − credit sum must show 0
    expect(formulas.some((f) => f.includes('Journal Entries') && f.includes('SUM'))).toBe(true)
  })

  it('preserves Devanagari across sheets', async () => {
    const wb = await load(await buildMasterWorkbook(DOCS))
    expect(wb.getWorksheet('Parties')!.getCell('B2').value).toBe('किरण ट्रेडिङ')
  })
})
