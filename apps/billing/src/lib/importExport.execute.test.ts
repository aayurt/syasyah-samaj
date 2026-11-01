/**
 * executeImport integration tests (MISSION.md M3, ADR-0004).
 *
 * Covers the registry-driven import pipeline:
 *   - FK resolution (business key → existing record id, via fkLinks)
 *   - per-entity mapForApi (members nesting, boolean coercion)
 *   - journal-entries row grouping (one API doc per voucher, lines[])
 *   - unresolved FK → error recorded, no POST issued
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { executeImport } from './importExport'

const mockApi = vi.hoisted(() => vi.fn())

vi.mock('./api', () => ({
  api: mockApi,
}))

/** Reference data served to fetchAllDocs on GETs (no method → list read). */
const REFS: Record<string, Record<string, unknown>[]> = {
  '/membership-types': [{ id: 3, name: 'Annual Member' }],
  '/account-groups': [{ id: 5, name: 'Current Assets' }],
  '/gl-accounts': [
    { id: 10, code: '1000', name: 'Cash in Hand' },
    { id: 11, code: '4000', name: 'Membership Sales' },
  ],
  '/documents': [
    { id: 77, number: 'SI-2083-84-0001' },
    { id: 78, number: 'SI-2083-84-0002' },
  ],
  '/parties': [{ id: 42, name: 'Kiran Trading' }],
  '/items': [{ id: 9, code: 'ITM-001', name: 'Pen' }],
  '/fiscal-years': [{ id: 1, label: '2083-84' }],
}

function postCalls(): [string, { body: Record<string, unknown> }][] {
  return mockApi.mock.calls.filter(
    (call: unknown[]) => (call[1] as { method?: string } | undefined)?.method === 'POST',
  ) as [string, { body: Record<string, unknown> }][]
}

beforeEach(() => {
  mockApi.mockReset()
  mockApi.mockImplementation(async (path: string, opts?: { method?: string }) => {
    if (opts?.method === 'POST' || opts?.method === 'PATCH') return { doc: {} }
    return { docs: REFS[path] ?? [] }
  })
})

describe('executeImport — FK resolution', () => {
  it('resolves members membershipType name → id', async () => {
    const records = [
      {
        doc: {
          memberId: 'M-001',
          fullName: 'अनिता श्रेष्ठ',
          email: 'a@example.com',
          phone: '9803948123',
          membershipType: 'Annual Member',
        },
        action: 'create' as const,
      },
    ]
    const result = await executeImport('members', records)
    expect(result.created).toBe(1)
    const posts = postCalls()
    expect(posts).toHaveLength(1)
    expect(posts[0][0]).toBe('/members')
    expect(posts[0][1].body.membershipType).toBe(3)
  })

  it('resolves gl-accounts group name → id', async () => {
    const records = [
      {
        doc: { code: '1020', name: 'Petty Cash', type: 'asset', class: 'cash', group: 'Current Assets' },
        action: 'create' as const,
      },
    ]
    const result = await executeImport('gl-accounts', records)
    expect(result.created).toBe(1)
    expect(postCalls()[0][1].body.group).toBe(5)
  })

  it('records an error and skips the POST when a FK cannot be resolved', async () => {
    const records = [
      {
        doc: { code: '1020', name: 'Petty Cash', type: 'asset', group: 'Does Not Exist' },
        action: 'create' as const,
      },
    ]
    const result = await executeImport('gl-accounts', records)
    expect(result.created).toBe(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('Does Not Exist')
    expect(result.errors[0]).toContain('account-groups')
    expect(postCalls()).toHaveLength(0)
  })

  it('treats an already-numeric FK value as an id (depth-0 round-trip)', async () => {
    const records = [
      { doc: { code: '1020', name: 'Petty Cash', type: 'asset', group: 5 }, action: 'create' as const },
    ]
    const result = await executeImport('gl-accounts', records)
    expect(result.created).toBe(1)
    expect(postCalls()[0][1].body.group).toBe(5)
  })
})

describe('executeImport — members mapForApi', () => {
  it('nests phone / bloodGroup / appliedDateBs into payload shape', async () => {
    const records = [
      {
        doc: {
          fullName: 'गोपाल ढकाल',
          email: 'g@example.com',
          phone: '9800000000',
          bloodGroup: 'O+',
          appliedDateBs: '2081-05-15',
        },
        action: 'create' as const,
      },
    ]
    const result = await executeImport('members', records)
    expect(result.created).toBe(1)
    const body = postCalls()[0][1].body
    expect(body.phoneNumber).toBe('9800000000')
    expect(body).not.toHaveProperty('phone')
    expect(body.idCardDetails).toEqual({ bloodGroup: 'O+' })
    expect(body.application).toEqual({ appliedDateBs: '2081-05-15' })
    expect(body).not.toHaveProperty('bloodGroup')
    expect(body).not.toHaveProperty('appliedDateBs')
  })

  it('coerces boolean-ish fields (fiscal-years isActive)', async () => {
    const records = [
      { doc: { label: '2084-85', startDate: '2027-07-16', endDate: '2028-07-15', status: 'active', isActive: 'TRUE' }, action: 'create' as const },
      { doc: { label: '2085-86', startDate: '2028-07-16', endDate: '2029-07-15', status: 'active', isActive: '' }, action: 'create' as const },
    ]
    const result = await executeImport('fiscal-years', records)
    expect(result.created).toBe(2)
    const bodies = postCalls().map(([, o]) => o.body)
    expect(bodies[0].isActive).toBe(true)
    expect(bodies[1].isActive).toBe(false)
  })
})

describe('executeImport — journal-entries grouping', () => {
  const rows = [
    { date: '2026-04-01', voucherNo: 'SI-2083-84-0001', narration: 'April fee', status: 'posted', accountCode: '1000', accountName: 'Cash in Hand', debit: 565, credit: 0, memo: 'cash' },
    { date: '2026-04-01', voucherNo: 'SI-2083-84-0001', narration: 'April fee', status: 'posted', accountCode: '4000', accountName: 'Membership Sales', debit: 0, credit: 565, memo: '' },
  ]

  it('groups rows by voucherNo into ONE journal-entries document', async () => {
    const result = await executeImport(
      'journal-entries',
      rows.map((doc) => ({ doc: doc as Record<string, unknown>, action: 'create' as const })),
    )
    expect(result.created).toBe(1)
    const posts = postCalls()
    expect(posts).toHaveLength(1)
    expect(posts[0][0]).toBe('/journal-entries')

    const body = posts[0][1].body
    expect(body.date).toBe('2026-04-01')
    expect(body.narration).toBe('April fee')
    expect(body.referenceDoc).toBe(77) // voucherNo → documents.number → id
    expect(body).not.toHaveProperty('voucherNo')
    const lines = body.lines as Record<string, unknown>[]
    expect(lines).toHaveLength(2)
    expect(lines[0]).toEqual({ account: 10, debit: 565, credit: 0, memo: 'cash' })
    expect(lines[1]).toEqual({ account: 11, debit: 0, credit: 565, memo: '' })
  })

  it('creates separate documents for different vouchers', async () => {
    const extra = { ...rows[0], voucherNo: 'SI-2083-84-0002' }
    const result = await executeImport(
      'journal-entries',
      [...rows, extra].map((doc) => ({ doc: doc as Record<string, unknown>, action: 'create' as const })),
    )
    expect(result.created).toBe(2)
    expect(postCalls()).toHaveLength(2)
  })

  it('rejects a voucher line whose account code is unknown', async () => {
    const bad = { ...rows[0], accountCode: '9999' }
    const result = await executeImport(
      'journal-entries',
      [bad].map((doc) => ({ doc: doc as Record<string, unknown>, action: 'create' as const })),
    )
    expect(result.created).toBe(0)
    expect(result.errors[0]).toContain('9999')
    expect(postCalls()).toHaveLength(0)
  })

  it('imports vouchers without a voucherNo as unlinked drafts (referenceDoc null)', async () => {
    const orphan = { ...rows[0], voucherNo: '', narration: 'Opening entry' }
    const result = await executeImport(
      'journal-entries',
      [orphan].map((doc) => ({ doc: doc as Record<string, unknown>, action: 'create' as const })),
    )
    expect(result.created).toBe(1)
    expect(postCalls()[0][1].body.referenceDoc).toBeNull()
  })
})
