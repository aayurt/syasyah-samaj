/**
 * Statutory Registers page tests — PF register rendering from run
 * snapshots, empty-state messaging, and CSV export wiring.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import PayrollRegisters from './PayrollRegisters'

const apiMock = vi.hoisted(() => vi.fn())

vi.mock('../lib/api', () => ({
  api: apiMock,
  fmt: (n: number | undefined | null) =>
    (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
}))

vi.mock('../lib/tenant', () => ({
  useTenant: () => ({ isCentral: true, tenantId: '9' }),
  useTenantQuery: () => ({ tenant: '9' }),
}))

vi.mock('../lib/toast', () => ({ pushToast: vi.fn() }))

const RUN = {
  id: 10,
  runNumber: 'PR-2026-10',
  period: '2026-10',
  payDate: '2026-10-30',
  status: 'posted',
  lines: [
    {
      employee: 1,
      empCode: 'EMP-001',
      name: 'Aama Gurung',
      basic: 30000,
      allowances: [],
      gross: 30000,
      deductions: [],
      net: 27000,
      statutory: {
        pfWage: 30000,
        esiWage: 30000,
        epf: { cappedWage: 25000, employee: 3000, eps: 0, employerEpf: 3000, edli: 125, admin: 125 },
        pt: 200,
      },
    },
    {
      employee: 2,
      empCode: 'EMP-002',
      name: 'Hari Thapa',
      basic: 15000,
      allowances: [],
      gross: 15000,
      deductions: [],
      net: 14742.5,
      statutory: {
        pfWage: 15000,
        esiWage: 15000,
        epf: { cappedWage: 15000, employee: 1800, eps: 1250, employerEpf: 550, edli: 75, admin: 75 },
        esi: { covered: true, ceiling: 21000, employee: 112.5, employer: 487.5 },
        pt: 200,
        lwf: { employee: 25, employer: 75 },
      },
    },
  ],
  grossPay: 45000,
  totalDeductions: 5112.5,
  netPay: 39887.5,
  tenant: 9,
}

function mockApi(responses: Record<string, unknown>) {
  apiMock.mockImplementation(async (url: string) => {
    if (responses[url] !== undefined) return responses[url]
    throw new Error(`unexpected url ${url}`)
  })
}

beforeEach(() => {
  apiMock.mockReset()
})

describe('Statutory Registers — PF register', () => {
  it('renders per-employee PF rows with the EPF split and totals', async () => {
    mockApi({
      '/payroll-runs': { docs: [RUN] },
      '/globals/payroll-settings': { pfNumber: 'MH/BOM/12345' },
    })
    render(<PayrollRegisters />)
    await screen.findByText('EMP-001')

    // EMP-001: capped 25,000 → employee 3,000 and employer EPF 3,000 (both
    // cells show 3,000.00), EPS 0 because the wage is above the ceiling.
    const table = screen.getByRole('table')
    const row1 = within(table).getByText('Aama Gurung').closest('tr')!
    expect(within(row1).getAllByText('3,000.00')).toHaveLength(2)
    // EMP-002: EPS 1,250 (8.33 % × 15,000, half-up).
    const row2 = within(table).getByText('Hari Thapa').closest('tr')!
    expect(within(row2).getByText('1,250.00')).toBeInTheDocument()
    // Totals footer sums both employees' employee-share: 3,000 + 1,800.
    expect(screen.getByText(/TOTAL \(2 employees\)/)).toBeInTheDocument()
    expect(within(table).getAllByText('4,800.00').length).toBeGreaterThan(0)
    // Registration number prints in the header.
    expect(screen.getByText('MH/BOM/12345')).toBeInTheDocument()
  })

  it('shows the empty state when the run has no snapshot rows', async () => {
    mockApi({
      '/payroll-runs': {
        docs: [{ ...RUN, lines: [{ ...RUN.lines[0], statutory: undefined }] }],
      },
      '/globals/payroll-settings': {},
    })
    render(<PayrollRegisters />)
    await waitFor(() =>
      expect(screen.getByText(/No PF Register rows/i)).toBeInTheDocument(),
    )
  })

  it('offers CSV export once rows exist', async () => {
    mockApi({
      '/payroll-runs': { docs: [RUN] },
      '/globals/payroll-settings': {},
    })
    const createObjectURL = vi.fn(() => 'blob:x')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
    render(<PayrollRegisters />)
    await screen.findByText('EMP-001')
    fireEvent.click(screen.getByRole('button', { name: /Export CSV/i }))
    expect(createObjectURL).toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
