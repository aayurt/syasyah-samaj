/**
 * Endpoint handler tests for the PayrollRuns collection (MVP payroll).
 *
 * Handlers are plain functions taking a PayloadRequest-shaped object, so the
 * workflow logic (roster → lines → journal entry) is testable without a DB.
 */
import { generatePayrollRun, postPayrollRun, voidPayrollRun } from './handlers'

const ACTIVE_ROSTER = [
  {
    id: 1,
    employeeId: 'EMP-001',
    name: 'Aama Gurung',
    active: true,
    basicSalary: 30000,
    allowances: [{ label: 'House', amount: 5000 }],
    deductions: [{ label: 'PF', amount: 3000, account: 55 }],
    tenant: 9,
  },
  {
    id: 2,
    employeeId: 'EMP-002',
    name: 'Hari Thapa',
    active: true,
    basicSalary: 20000,
    allowances: [],
    deductions: [{ label: 'TDS', amount: 1000 }],
    tenant: 9,
  },
]

const SETTINGS = {
  expenseAccount: 700,
  cashAccount: 100,
  accruedPayableAccount: 210,
}

function makePayload(over: Record<string, unknown> = {}) {
  return {
    find: jest.fn(async ({ collection }: { collection: string }) => {
      if (collection === 'employees') return { docs: ACTIVE_ROSTER }
      if (collection === 'payroll-runs') return { docs: [] }
      return { docs: [] }
    }),
    findByID: jest.fn(async () => null),
    findGlobal: jest.fn(async () => SETTINGS),
    create: jest.fn(async ({ collection, data }: any) => ({ id: 77, ...data })),
    update: jest.fn(async ({ id, data }: any) => ({ id, ...data })),
    db: {
      beginTransaction: jest.fn(async () => 'tx1'),
      commitTransaction: jest.fn(async () => {}),
      rollbackTransaction: jest.fn(async () => {}),
    },
    ...over,
  }
}

function makeReq(over: Record<string, unknown> = {}) {
  const payload = (over.payload as ReturnType<typeof makePayload>) || makePayload()
  return {
    user: { role: 'admin', email: 'admin@example.com' },
    routeParams: { id: '10' },
    json: async () => ({}),
    payload,
    ...over,
  } as any
}

describe('POST /payroll-runs/generate', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const res = await generatePayrollRun(makeReq({ user: null }))
    expect(res.status).toBe(401)
  })

  it('requires a period', async () => {
    const res = await generatePayrollRun(makeReq({ json: async () => ({}) }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/period/i)
  })

  it('rejects when there are no active employees', async () => {
    const payload = makePayload()
    ;(payload.find as jest.Mock).mockImplementation(async ({ collection }: any) =>
      collection === 'employees' ? { docs: [] } : { docs: [] },
    )
    const res = await generatePayrollRun(
      makeReq({ payload, json: async () => ({ period: '2026-10' }) }),
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/active employee/i)
  })

  it('rejects a duplicate period with 409 (ignoring voided runs)', async () => {
    const payload = makePayload()
    ;(payload.find as jest.Mock).mockImplementation(async ({ collection }: any) => {
      if (collection === 'employees') return { docs: ACTIVE_ROSTER }
      if (collection === 'payroll-runs')
        return { docs: [{ id: 5, period: '2026-10', status: 'posted' }] }
      return { docs: [] }
    })
    const res = await generatePayrollRun(
      makeReq({ payload, json: async () => ({ period: '2026-10', tenant: 9 }) }),
    )
    expect(res.status).toBe(409)
  })

  it('creates a draft run with computed lines and totals', async () => {
    const payload = makePayload()
    const res = await generatePayrollRun(
      makeReq({
        payload,
        json: async () => ({ period: '2026-10', payDate: '2026-10-30', tenant: 9 }),
      }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.doc.status).toBe('draft')
    expect(body.doc.runNumber).toBe('PR-2026-10')
    expect(body.doc.lines).toHaveLength(2)
    expect(body.doc.lines[0].empCode).toBe('EMP-001')
    expect(body.doc.grossPay).toBe(55000) // 35000 + 20000
    expect(body.doc.totalDeductions).toBe(4000) // 3000 + 1000
    expect(body.doc.netPay).toBe(51000)
    // Default accounts resolved from billing settings when not overridden
    expect(body.doc.expenseAccount).toBe(700)
    expect(body.doc.paymentAccount).toBe(100)

    const createArgs = (payload.create as jest.Mock).mock.calls[0][0]
    expect(createArgs.collection).toBe('payroll-runs')
    expect(createArgs.data.tenant).toBe(9)
  })

  it('lets the caller override expense and payment accounts', async () => {
    const payload = makePayload()
    const res = await generatePayrollRun(
      makeReq({
        payload,
        json: async () => ({
          period: '2026-11',
          expenseAccount: 701,
          paymentAccount: 101,
          tenant: 9,
        }),
      }),
    )
    const body = await res.json()
    expect(body.doc.expenseAccount).toBe(701)
    expect(body.doc.paymentAccount).toBe(101)
  })

  it('applies india-payroll statutes when the payroll settings enable them', async () => {
    const payload = makePayload()
    ;(payload.findGlobal as jest.Mock).mockImplementation(async ({ slug }: any) =>
      slug === 'payroll-settings'
        ? {
            epfEnabled: true,
            esicEnabled: true,
            professionalTaxEnabled: true,
            defaultEmploymentState: 'Maharashtra',
            epfPayableAccount: 210,
            esicPayableAccount: 213,
            ptPayableAccount: 214,
            statutoryExpenseAccount: 720,
          }
        : SETTINGS,
    )
    const res = await generatePayrollRun(
      makeReq({ payload, json: async () => ({ period: '2026-10', tenant: 9 }) }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()

    const l1 = body.doc.lines.find((l: any) => l.empCode === 'EMP-001')
    // PF wage 30,000 → capped at 25,000 (Oct 2026) → 12 % = 3,000.
    expect(l1.deductions).toContainEqual(
      expect.objectContaining({ label: 'Provident Fund', amount: 3000, account: 210 }),
    )
    // Maharashtra PT on gross 35,000 → 200.
    expect(l1.deductions).toContainEqual(
      expect.objectContaining({ label: 'Professional Tax', amount: 200, account: 214 }),
    )
    // ESI: 30,000 wage > ceiling → none; second employee 20,000 → covered.
    const l2 = body.doc.lines.find((l: any) => l.empCode === 'EMP-002')
    expect(l2.deductions).toContainEqual(
      expect.objectContaining({ label: 'Employee State Insurance', amount: 150, account: 213 }),
    )
    // Statutory snapshot persisted per line for the register reports.
    expect(l2.statutory).toMatchObject({ pfWage: 20000, esiWage: 20000, pt: 200 })

    // Employer contributions stored on the run, EPS falling back to EPF payable.
    const ec = Object.fromEntries(
      (body.doc.employerContributions as any[]).map((c) => [c.label, c]),
    )
    expect(ec['EPS']).toMatchObject({ amount: 1666, account: 210 }) // 8.33 % × 20,000
    expect(ec['EPF (Employer)']).toMatchObject({ amount: 3734 }) // 3,000 + 734
    expect(ec['EDLI']).toMatchObject({ amount: 225 }) // 0.5 % × (25,000 + 20,000)
    expect(ec['EPF Admin']).toMatchObject({ amount: 225 })
    expect(ec['ESI (Employer)']).toMatchObject({ amount: 650, account: 213 })
    expect(body.doc.statutoryExpenseAccount).toBe(720)

    // Totals include the statutory rows: 6,200 + 3,750 deductions.
    expect(body.doc.totalDeductions).toBe(9950)
    expect(body.doc.netPay).toBe(45050)
  })
})

describe('POST /payroll-runs/:id/post', () => {
  const draftRun = (over: Record<string, unknown> = {}) => ({
    id: 10,
    runNumber: 'PR-2026-10',
    period: '2026-10',
    payDate: '2026-10-30',
    status: 'draft',
    lines: [
      {
        employee: 1,
        empCode: 'EMP-001',
        name: 'Aama Gurung',
        basic: 30000,
        allowances: [{ label: 'House', amount: 5000 }],
        gross: 35000,
        deductions: [{ label: 'PF', amount: 3000, account: 55 }],
        net: 32000,
      },
    ],
    grossPay: 35000,
    totalDeductions: 3000,
    netPay: 32000,
    expenseAccount: 700,
    paymentAccount: 100,
    tenant: 9,
    ...over,
  })

  it('rejects unauthenticated requests with 401', async () => {
    const res = await postPayrollRun(makeReq({ user: null }))
    expect(res.status).toBe(401)
  })

  it('returns 404 for an unknown run', async () => {
    const payload = makePayload()
    ;(payload.findByID as jest.Mock).mockResolvedValue(null)
    const res = await postPayrollRun(makeReq({ payload }))
    expect(res.status).toBe(404)
  })

  it('returns 409 when the run is not a draft', async () => {
    const payload = makePayload()
    ;(payload.findByID as jest.Mock).mockResolvedValue(draftRun({ status: 'posted' }))
    const res = await postPayrollRun(makeReq({ payload }))
    expect(res.status).toBe(409)
    expect((payload.create as jest.Mock)).not.toHaveBeenCalled()
  })

  it('returns 409 when the run has no lines', async () => {
    const payload = makePayload()
    ;(payload.findByID as jest.Mock).mockResolvedValue(
      draftRun({ lines: [], grossPay: 0, totalDeductions: 0, netPay: 0 }),
    )
    const res = await postPayrollRun(makeReq({ payload }))
    expect(res.status).toBe(409)
    expect((payload.create as jest.Mock)).not.toHaveBeenCalled()
  })

  it('posts a balanced journal entry and marks the run posted', async () => {
    const payload = makePayload()
    ;(payload.findByID as jest.Mock).mockResolvedValue(draftRun())
    const res = await postPayrollRun(makeReq({ payload }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.journalEntry).toBe(77)

    const createArgs = (payload.create as jest.Mock).mock.calls[0][0]
    expect(createArgs.collection).toBe('journal-entries')
    expect(createArgs.data.status).toBe('posted')
    const jeLines = createArgs.data.lines
    const totalDebit = jeLines.reduce((s: number, l: any) => s + (l.debit || 0), 0)
    const totalCredit = jeLines.reduce((s: number, l: any) => s + (l.credit || 0), 0)
    expect(totalDebit).toBe(totalCredit)
    expect(totalDebit).toBe(35000)
    // Dr expense, Cr PF account 55, Cr cash 100 (net)
    expect(jeLines[0]).toMatchObject({ account: 700, debit: 35000 })
    expect(jeLines).toContainEqual(expect.objectContaining({ account: 55, credit: 3000 }))
    expect(jeLines).toContainEqual(expect.objectContaining({ account: 100, credit: 32000 }))

    const updateArgs = (payload.update as jest.Mock).mock.calls[0][0]
    expect(updateArgs.collection).toBe('payroll-runs')
    expect(updateArgs.data.status).toBe('posted')
    expect(updateArgs.data.journalEntry).toBe(77)

    expect((payload.db.commitTransaction as jest.Mock)).toHaveBeenCalledTimes(1)
    expect((payload.db.rollbackTransaction as jest.Mock)).not.toHaveBeenCalled()
  })

  it('rolls back and returns 400 when journal creation fails', async () => {
    const payload = makePayload()
    ;(payload.findByID as jest.Mock).mockResolvedValue(draftRun())
    ;(payload.create as jest.Mock).mockRejectedValue(new Error('db down'))
    const res = await postPayrollRun(makeReq({ payload }))
    expect(res.status).toBe(400)
    expect((payload.db.rollbackTransaction as jest.Mock)).toHaveBeenCalledTimes(1)
    expect((payload.db.commitTransaction as jest.Mock)).not.toHaveBeenCalled()
  })

  it('accrues employer statutory contributions in the journal', async () => {
    const payload = makePayload()
    ;(payload.findByID as jest.Mock).mockResolvedValue(
      draftRun({
        employerContributions: [
          { label: 'EPS', amount: 1250, account: 211 },
          { label: 'EPF (Employer)', amount: 550, account: 210 },
        ],
        statutoryExpenseAccount: 720,
      }),
    )
    const res = await postPayrollRun(makeReq({ payload }))
    expect(res.status).toBe(200)

    const jeLines = (payload.create as jest.Mock).mock.calls[0][0].data.lines
    const totalDebit = jeLines.reduce((s: number, l: any) => s + (l.debit || 0), 0)
    const totalCredit = jeLines.reduce((s: number, l: any) => s + (l.credit || 0), 0)
    expect(totalDebit).toBe(totalCredit)
    expect(totalDebit).toBe(36800) // 35,000 gross + 1,800 employer
    expect(jeLines).toContainEqual(
      expect.objectContaining({ account: 720, debit: 1800 }),
    )
    expect(jeLines).toContainEqual(
      expect.objectContaining({ account: 211, credit: 1250 }),
    )
    expect(jeLines).toContainEqual(
      expect.objectContaining({ account: 210, credit: 550 }),
    )
  })

  it('returns 400 when required accounts are missing', async () => {
    const payload = makePayload()
    ;(payload.findByID as jest.Mock).mockResolvedValue(
      draftRun({ expenseAccount: null, paymentAccount: null }),
    )
    const res = await postPayrollRun(makeReq({ payload }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/account/i)
    expect((payload.create as jest.Mock)).not.toHaveBeenCalled()
  })
})

describe('POST /payroll-runs/:id/void', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const res = await voidPayrollRun(makeReq({ user: null }))
    expect(res.status).toBe(401)
  })

  it('returns 404 for an unknown run', async () => {
    const payload = makePayload()
    ;(payload.findByID as jest.Mock).mockResolvedValue(null)
    const res = await voidPayrollRun(makeReq({ payload }))
    expect(res.status).toBe(404)
  })

  it('returns 409 unless the run is posted', async () => {
    const payload = makePayload()
    ;(payload.findByID as jest.Mock).mockResolvedValue({ id: 10, status: 'draft' })
    const res = await voidPayrollRun(makeReq({ payload }))
    expect(res.status).toBe(409)
  })

  it('voids the run and its journal entry in a transaction', async () => {
    const payload = makePayload()
    ;(payload.findByID as jest.Mock).mockResolvedValue({
      id: 10,
      status: 'posted',
      journalEntry: 77,
      tenant: 9,
    })
    const res = await voidPayrollRun(makeReq({ payload }))
    expect(res.status).toBe(200)

    const updates = (payload.update as jest.Mock).mock.calls.map((c) => c[0])
    const runUpdate = updates.find((u) => u.collection === 'payroll-runs')
    const jeUpdate = updates.find((u) => u.collection === 'journal-entries')
    expect(runUpdate.data.status).toBe('void')
    expect(jeUpdate.id).toBe(77)
    expect(jeUpdate.data.status).toBe('void')
    expect((payload.db.commitTransaction as jest.Mock)).toHaveBeenCalledTimes(1)
  })
})
