/**
 * Payroll page tests (MVP payroll run).
 * Runs tab: generate / post / void / line inspection.
 * Employees tab: roster list + employee create form.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import Payroll from './Payroll'

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

vi.mock('../lib/i18n', () => ({
  useT: () => (key: string, fallback?: string) => fallback ?? key,
}))

vi.mock('../lib/toast', () => ({ pushToast: vi.fn() }))

vi.mock('../lib/nepaliDate', () => ({ todayAD: () => '2026-10-10' }))

const DRAFT_RUN = {
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
}

const EMPLOYEES = [
  {
    id: 1,
    employeeId: 'EMP-001',
    name: 'Aama Gurung',
    position: 'Clerk',
    active: true,
    basicSalary: 30000,
    allowances: [{ label: 'House', amount: 5000 }],
    deductions: [{ label: 'PF', amount: 3000, account: 55 }],
    tenant: 9,
  },
]

function mockApi(routes: Record<string, unknown>) {
  apiMock.mockImplementation(async (path: string) => routes[path] ?? { docs: [] })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Payroll — runs tab', () => {
  it('lists runs with totals and status', async () => {
    mockApi({ '/payroll-runs': { docs: [DRAFT_RUN] } })
    render(<Payroll />)
    expect(await screen.findByText('PR-2026-10')).toBeInTheDocument()
    expect(screen.getByText('Draft')).toBeInTheDocument()
    expect(screen.getByText('35,000.00')).toBeInTheDocument() // gross
    expect(screen.getByText('32,000.00')).toBeInTheDocument() // net
  })

  it('shows an empty state when there are no runs', async () => {
    mockApi({})
    render(<Payroll />)
    expect(await screen.findByText(/no payroll runs/i)).toBeInTheDocument()
  })

  it('requires a period before generating', async () => {
    mockApi({})
    render(<Payroll />)
    const btn = await screen.findByRole('button', { name: 'Generate run' })
    fireEvent.change(screen.getByLabelText('Period'), { target: { value: '' } })
    fireEvent.click(btn)
    expect(screen.getByText(/period is required/i)).toBeInTheDocument()
    expect(apiMock).not.toHaveBeenCalledWith(
      '/payroll-runs/generate',
      expect.anything(),
    )
  })

  it('generates a draft run for the chosen period', async () => {
    mockApi({
      '/payroll-runs': { docs: [DRAFT_RUN] },
      '/payroll-runs/generate': { doc: { ...DRAFT_RUN, id: 11, runNumber: 'PR-2026-11', period: '2026-11' } },
    })
    render(<Payroll />)
    await screen.findByText('PR-2026-10')
    fireEvent.change(screen.getByLabelText('Period'), { target: { value: '2026-11' } })
    fireEvent.click(screen.getByRole('button', { name: 'Generate run' }))
    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith(
        '/payroll-runs/generate',
        expect.objectContaining({
          method: 'POST',
          body: expect.objectContaining({ period: '2026-11', tenant: '9' }),
        }),
      ),
    )
    // Reload after generate — the new run appears.
    expect(await screen.findByText('PR-2026-11')).toBeInTheDocument()
  })

  it('posts a draft run', async () => {
    mockApi({ '/payroll-runs': { docs: [DRAFT_RUN] } })
    render(<Payroll />)
    await screen.findByText('PR-2026-10')
    fireEvent.click(screen.getByRole('button', { name: 'Post' }))
    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith('/payroll-runs/10/post', {
        method: 'POST',
        // Workflow endpoints bypass the offline outbox — a replayed post
        // would double-pay the period.
        immediate: true,
      }),
    )
  })

  it('voids a posted run', async () => {
    mockApi({ '/payroll-runs': { docs: [{ ...DRAFT_RUN, status: 'posted', journalEntry: 77 }] } })
    render(<Payroll />)
    await screen.findByText('PR-2026-10')
    fireEvent.click(screen.getByRole('button', { name: 'Void' }))
    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith('/payroll-runs/10/void', {
        method: 'POST',
        immediate: true,
      }),
    )
  })

  it('expands a run to show its per-employee lines', async () => {
    mockApi({ '/payroll-runs': { docs: [DRAFT_RUN] } })
    render(<Payroll />)
    await screen.findByText('PR-2026-10')
    fireEvent.click(screen.getByRole('button', { name: 'View lines' }))
    const panel = await screen.findByTestId('run-lines')
    expect(within(panel).getByText('Aama Gurung')).toBeInTheDocument()
    expect(within(panel).getByText('EMP-001')).toBeInTheDocument()
    expect(within(panel).getByText('32,000.00')).toBeInTheDocument() // net of the line
  })
})

describe('Payroll — employees tab', () => {
  it('lists the roster', async () => {
    mockApi({ '/employees': { docs: EMPLOYEES } })
    render(<Payroll />)
    fireEvent.click(await screen.findByRole('button', { name: 'Employees' }))
    expect(await screen.findByText('EMP-001')).toBeInTheDocument()
    expect(screen.getByText('Aama Gurung')).toBeInTheDocument()
    expect(screen.getByText('30,000.00')).toBeInTheDocument() // basic
  })

  it('validates the employee form before saving', async () => {
    mockApi({})
    render(<Payroll />)
    fireEvent.click(await screen.findByRole('button', { name: 'Employees' }))
    fireEvent.click(await screen.findByRole('button', { name: 'New employee' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save employee' }))
    expect(screen.getByText(/name is required/i)).toBeInTheDocument()
    expect(apiMock).not.toHaveBeenCalledWith(
      '/employees',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('creates an employee with the salary structure', async () => {
    mockApi({ '/employees': { docs: EMPLOYEES } })
    render(<Payroll />)
    fireEvent.click(await screen.findByRole('button', { name: 'Employees' }))
    fireEvent.click(await screen.findByRole('button', { name: 'New employee' }))

    fireEvent.change(screen.getByLabelText('Employee ID'), {
      target: { value: 'EMP-002' },
    })
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Hari Thapa' } })
    fireEvent.change(screen.getByLabelText('Basic salary'), { target: { value: '20000' } })

    // One deduction head: PF 1000
    fireEvent.change(screen.getByPlaceholderText('Deduction head'), {
      target: { value: 'PF' },
    })
    fireEvent.change(screen.getByPlaceholderText('Deduction amount'), {
      target: { value: '1000' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Save employee' }))
    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith(
        '/employees',
        expect.objectContaining({
          method: 'POST',
          body: expect.objectContaining({
            employeeId: 'EMP-002',
            name: 'Hari Thapa',
            basicSalary: 20000,
            tenant: '9',
            deductions: [expect.objectContaining({ label: 'PF', amount: 1000 })],
          }),
        }),
      ),
    )
  })
})
