/**
 * Master workbook import tests (MISSION.md M5, OBJ-3).
 *
 * The mission's key test: export a master workbook → parse it back →
 * every sheet's docs round-trip with 0 diffs; FK orphans are reported;
 * import executes entities in dependency order with mocked api.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Workbook } from 'exceljs'
import { buildMasterWorkbook, readMasterManifest } from './masterWorkbook'
import { parseMasterWorkbook, importMasterWorkbook } from './masterWorkbook.import'
import { parseEntityExcel } from '../importExport'
import { ENTITY_REGISTRY } from './entities'

const DOCS = {
  'fiscal-years': [
    { label: '2083-84', startDate: '2026-07-16', endDate: '2027-07-15', status: 'active', isActive: true },
  ],
  'account-groups': [
    { code: 'CA', name: 'Current Assets', type: 'asset', parent: '', description: '', sortOrder: 1 },
    { code: 'REV', name: 'Revenue', type: 'income', parent: '', description: '', sortOrder: 2 },
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
    { number: 'JV-ORPHAN', docType: 'journal-voucher', date: '2026-04-02', party: 'किरण ट्रेडिङ', narration: 'Orphan-account test voucher', status: 'draft' },
  ],
  'journal-entries': [
    { date: '2026-04-01', voucherNo: 'SI-2083-84-0001', narration: 'April fee', status: 'posted', accountCode: '1000', accountName: 'Cash in Hand', debit: 565, credit: 0, memo: 'cash' },
    { date: '2026-04-01', voucherNo: 'SI-2083-84-0001', narration: 'April fee', status: 'posted', accountCode: '4000', accountName: 'Membership Sales', debit: 0, credit: 565, memo: '' },
  ],
} as Record<string, Record<string, unknown>[]>

async function masterFile(docs = DOCS): Promise<File> {
  const blob = await buildMasterWorkbook(docs, { tenantName: 'रुणी' })
  return new File([blob], 'master.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

describe('parseMasterWorkbook — round-trip', () => {
  it('reads back the manifest', async () => {
    const parsed = await parseMasterWorkbook(await masterFile())
    expect(parsed.manifest.version).toBe(1)
    expect(parsed.manifest.tenant).toBe('रुणी')
    expect(parsed.manifest.entities).toHaveLength(ENTITY_REGISTRY.length)
  })

  it('round-trips every provided sheet with 0 diffs', async () => {
    const parsed = await parseMasterWorkbook(await masterFile())
    for (const [slug, source] of Object.entries(DOCS)) {
      expect(parsed.sheets[slug], `sheet for ${slug}`).toBeDefined()
      expect(parsed.sheets[slug], `${slug} row count`).toHaveLength(source.length)
      source.forEach((srcRow, i) => {
        for (const [field, value] of Object.entries(srcRow)) {
          expect(parsed.sheets[slug][i][field], `${slug}[${i}].${field}`).toEqual(value)
        }
      })
    }
  })

  it('round-trips empty entities as empty arrays (not missing)', async () => {
    const parsed = await parseMasterWorkbook(await masterFile())
    expect(parsed.sheets['fixed-assets']).toEqual([])
    expect(parsed.sheets.members).toEqual([])
  })

  it('excludes `_`-prefixed derived columns from parsed docs', async () => {
    const parsed = await parseMasterWorkbook(await masterFile())
    for (const doc of parsed.sheets['journal-entries']) {
      for (const key of Object.keys(doc)) {
        expect(key.startsWith('_')).toBe(false)
      }
    }
    const voucher = parsed.sheets.documents[0]
    expect(Object.keys(voucher).some((k) => k.startsWith('_'))).toBe(false)
  })

  it('rejects single-entity import of a master workbook with a clear message', async () => {
    await expect(parseEntityExcel(await masterFile())).rejects.toThrow(/master workbook/i)
  })
})

describe('parseMasterWorkbook — integrity', () => {
  it('reports no orphans for a consistent workbook', async () => {
    const parsed = await parseMasterWorkbook(await masterFile())
    expect(parsed.orphans).toEqual([])
  })

  it('reports FK orphans with sheet, row and value', async () => {
    const docs = {
      ...DOCS,
      'journal-entries': [
        { date: '2026-04-01', voucherNo: 'SI-2083-84-0001', narration: 'x', status: 'posted', accountCode: '9999', accountName: 'Ghost', debit: 100, credit: 0, memo: '' },
      ],
      documents: [{ number: 'NOPE-1', docType: 'sales-invoice', date: '2026-04-01', party: 'Ghost Party', narration: '', status: 'draft' }],
    }
    const parsed = await parseMasterWorkbook(await masterFile(docs))
    const fields = parsed.orphans.map((o) => `${o.sheet}.${o.field}:${o.value}`)
    expect(fields).toContain('Journal Entries.accountCode:9999')
    expect(fields).toContain('Vouchers.party:Ghost Party')
    expect(parsed.orphans[0].row).toBeGreaterThanOrEqual(2)
  })

  it('lists sheets missing from the workbook', async () => {
    const blob = await buildMasterWorkbook(DOCS)
    const wb = new Workbook()
    await wb.xlsx.load(await blob.arrayBuffer())
    const fixed = wb.getWorksheet('Fixed Assets')!
    wb.removeWorksheet(fixed.id)
    const out = await wb.xlsx.writeBuffer()
    const file = new File([out], 'master.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

    const parsed = await parseMasterWorkbook(file)
    expect(parsed.missingSheets).toContain('fixed-assets')
  })
})

/* ── import orchestration (simulated database via mocked api) ────────── */

const mockApi = vi.hoisted(() => vi.fn())

vi.mock('../api', () => ({
  api: mockApi,
}))

let db: Record<string, Record<string, unknown>[]> = {}
let nextId = 1

beforeEach(() => {
  mockApi.mockReset()
  db = {}
  nextId = 1
  // Minimal persistent store: GET lists return posted docs (so FK
  // resolution across sheets works as it would against a real API),
  // POST appends with a generated id, PATCH updates in place.
  mockApi.mockImplementation(async (path: string, opts?: { method?: string; body?: Record<string, unknown> }) => {
    const slug = path.replace(/^\//, '').split('/')[0]
    if (opts?.method === 'POST') {
      const doc = { id: nextId++, ...(opts.body ?? {}) }
      ;(db[slug] ||= []).push(doc)
      return { doc }
    }
    if (opts?.method === 'PATCH') {
      const id = Number(path.split('/').pop())
      const existing = (db[slug] || []).find((d) => d.id === id)
      if (existing) Object.assign(existing, opts.body)
      return { doc: existing ?? {} }
    }
    return { docs: db[slug] ?? [] }
  })
})

function postPaths(): string[] {
  return mockApi.mock.calls
    .filter((call: unknown[]) => (call[1] as { method?: string } | undefined)?.method === 'POST')
    .map((call: unknown[]) => String(call[0]))
}

describe('importMasterWorkbook', () => {
  it('writes entities in dependency order (masters before transactions)', async () => {
    const parsed = await parseMasterWorkbook(await masterFile())
    const summary = await importMasterWorkbook(parsed)

    const paths = postPaths()
    expect(paths.length).toBeGreaterThan(0)

    const firstIndexOf = (slug: string) => paths.findIndex((p) => p === `/${slug}`)
    expect(firstIndexOf('fiscal-years')).toBeGreaterThanOrEqual(0)
    expect(firstIndexOf('gl-accounts')).toBeGreaterThan(firstIndexOf('fiscal-years'))
    expect(firstIndexOf('parties')).toBeGreaterThan(firstIndexOf('gl-accounts'))
    expect(firstIndexOf('documents')).toBeGreaterThan(firstIndexOf('parties'))
    expect(firstIndexOf('journal-entries')).toBeGreaterThan(firstIndexOf('documents'))

    // Counts flow back per sheet
    expect(summary.perSlug['parties'].created).toBe(1)
    expect(summary.perSlug['journal-entries'].created).toBe(1) // 2 rows → 1 grouped doc
    expect(summary.totals.created).toBe(
      Object.values(summary.perSlug).reduce((n, s) => n + s.created, 0),
    )
  })

  it('collects per-sheet errors without aborting later sheets', async () => {
    const badVoucher = {
      date: '2026-04-02',
      voucherNo: 'JV-ORPHAN',
      narration: 'ghost line',
      status: 'posted',
      accountCode: '9999',
      accountName: 'Ghost',
      debit: 100,
      credit: 0,
      memo: '',
    }
    const parsed = await parseMasterWorkbook(
      await masterFile({ ...DOCS, 'journal-entries': [...DOCS['journal-entries'], badVoucher] }),
    )
    const summary = await importMasterWorkbook(parsed)

    // Good voucher grouped into one doc; orphan voucher rejected with an error.
    expect(summary.perSlug['journal-entries'].created).toBe(1)
    expect(summary.perSlug['journal-entries'].errors).toHaveLength(1)
    expect(summary.perSlug['journal-entries'].errors[0]).toContain('9999')
    expect(summary.totals.errors).toHaveLength(1)
    // Sheets after journal still ran.
    expect(summary.perSlug['recurring-schedules']).toEqual({
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    })
  })

  it('reports per-entity progress via onProgress', async () => {
    const parsed = await parseMasterWorkbook(await masterFile())
    const seen: string[] = []
    await importMasterWorkbook(parsed, { onProgress: (slug) => seen.push(slug) })
    expect(new Set(seen).size).toBe(seen.length) // each slug announced once
    expect(seen[0]).toBe('fiscal-years')
    expect(seen[seen.length - 1]).toBe('recurring-schedules')
  })
})
