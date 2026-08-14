import { parse } from 'csv-parse/sync';

describe('CSV Parsing Utility', () => {
  it('should correctly parse Google Sheets CSV export', () => {
    const csvData = `Email,Full Name,Member ID,Phone
test@example.com,John Doe,SY-001,123456789
jane@example.com,Jane Smith,SY-002,987654321`;

    const records = parse(csvData, {
      columns: true,
      skip_empty_lines: true,
    }) as Record<string, string>[];

    expect(records).toHaveLength(2);
    expect(records[0]!['Email']).toBe('test@example.com');
    expect(records[0]!['Full Name']).toBe('John Doe');
    expect(records[1]!['Member ID']).toBe('SY-002');
  });

  it('should handle different column naming variations', () => {
    const csvData = `email,Name,ID,phoneNumber
test@example.com,John Doe,SY-001,123456789`;

    const records = parse(csvData, {
      columns: true,
      skip_empty_lines: true,
    }) as Record<string, string>[];

    const record = records[0]!;
    const email = record['Email'] || record['email'];
    const fullName = record['Full Name'] || record['Name'] || record['fullName'];

    expect(email).toBe('test@example.com');
    expect(fullName).toBe('John Doe');
  });
});

import { syncMembersFromGoogleSheet } from './syncSheets'

const makePayload = (overrides = {}) => ({
  find: jest.fn(async ({ collection, where }) => {
    if (collection === 'tenants') return { docs: [{ id: 7, name: 'Default Ilaka' }] }
    if (collection === 'users') {
      if (where?.email?.equals === 'existing@example.com') return { docs: [{ id: 99 }] }
      return { docs: [] }
    }
    if (collection === 'members') {
      if (where?.memberId?.equals === 'SY-001') return { docs: [{ id: 11 }] }
      if (where?.email?.equals === 'dup@example.com') return { docs: [{ id: 12 }] }
      return { docs: [] }
    }
    return { docs: [] }
  }),
  create: jest.fn(async ({ data }) => ({ id: 1, ...data })),
  update: jest.fn(async ({ id, data }) => ({ id, ...data })),
  delete: jest.fn(async () => ({})),
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  ...overrides,
})

describe('syncMembersFromGoogleSheet', () => {
  const originalFetch = global.fetch

  beforeAll(() => {
    global.fetch = jest.fn()
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  const mockCsv = (csv: string) => {
    ;(global.fetch as jest.Mock).mockResolvedValue(new Response(csv, { status: 200 }))
  }

  it('deletes rows flagged for removal even when excluded from selectedIndices', async () => {
    mockCsv(`Email,Member ID,Full Name\ngone@example.com,SY-001,Gone\nkeep@example.com,SY-002,Keep`)
    const payload = makePayload()

    const result = await syncMembersFromGoogleSheet(payload as any, 'https://example.com/sheet/edit', {
      selectedIndices: [1],
      removeIndices: [0],
    })

    expect(payload.delete).toHaveBeenCalledWith({ collection: 'members', id: 11 })
    expect(result.removed).toBe(1)
    expect(result.created).toBe(1)
    expect(result.skipped).toBe(0)
  })

  it('deletes a removal row that has a member ID but no email', async () => {
    mockCsv(`Email,Member ID,Full Name\n,SY-001,Gone`)
    const payload = makePayload()

    const result = await syncMembersFromGoogleSheet(payload as any, 'https://example.com/sheet/edit', {
      removeIndices: [0],
    })

    expect(payload.delete).toHaveBeenCalledWith({ collection: 'members', id: 11 })
    expect(result.removed).toBe(1)
  })

  it('auto-links a newly created member to a user with the same email', async () => {
    mockCsv(`Email,Full Name\nexisting@example.com,John`)
    const payload = makePayload()

    await syncMembersFromGoogleSheet(payload as any, 'https://example.com/sheet/edit', {
      selectedIndices: [0],
    })

    expect(payload.create).toHaveBeenCalledTimes(1)
    const createCall = payload.create.mock.calls[0]
    expect(createCall).toBeDefined()
    const data = createCall![0]!.data
    expect(data.user).toBe(99)
    expect(data.email).toBe('existing@example.com')
  })

  it('defaults to the first tenant when no tenantId is provided', async () => {
    mockCsv(`Email,Full Name\nnew@example.com,Jane`)
    const payload = makePayload()

    await syncMembersFromGoogleSheet(payload as any, 'https://example.com/sheet/edit', {
      selectedIndices: [0],
    })

    expect(payload.find).toHaveBeenCalledWith(expect.objectContaining({ collection: 'tenants', limit: 1 }))
    const createCall = payload.create.mock.calls[0]
    expect(createCall).toBeDefined()
    const data = createCall![0]!.data
    expect(data.tenant).toBe(7)
  })
})
