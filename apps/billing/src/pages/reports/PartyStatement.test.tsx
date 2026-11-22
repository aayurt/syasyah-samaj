import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PartyStatement from './PartyStatement'

const listMock = vi.hoisted(() => vi.fn())
const apiMock = vi.hoisted(() => vi.fn())

vi.mock('../../lib/api', () => ({
  list: listMock,
  api: apiMock,
  fmt: (n: number | undefined | null) =>
    (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  useSyncState: () => ({ online: true, syncingCount: 0, lastSyncAt: null }),
}))

vi.mock('../../lib/tenant', () => ({
  useTenant: () => ({ isCentral: true, tenantId: '1' }),
  useTenantQuery: () => ({ tenant: '1' }),
}))

vi.mock('../../lib/i18n', () => ({
  useT: () => (key: string, fallback?: string) => fallback ?? key,
}))

vi.mock('../../lib/fiscalYear', () => ({
  useFiscalYear: () => ({
    years: [
      { id: 1, label: '2083-84', startDate: '2026-07-16', endDate: '2027-07-15', isActive: true },
    ],
    selectedYear: { id: 1, label: '2083-84', startDate: '2026-07-16', endDate: '2027-07-15', isActive: true },
    activeYear: { id: 1, label: '2083-84', startDate: '2026-07-16', endDate: '2027-07-15', isActive: true },
    selectYear: vi.fn(),
    loading: false,
    refresh: vi.fn(),
  }),
}))

vi.mock('../../lib/calendar', () => ({
  useCalendar: () => ({
    calendarType: 'AD',
    formatDate: (d: string) => d,
  }),
}))

const MOCK_PARTIES = [
  { id: 1, name: 'Himalayan Traders', type: 'customer', taxId: 'PAN-1111' },
  { id: 2, name: 'National Suppliers', type: 'vendor', taxId: 'PAN-2222' },
  { id: 3, name: 'Everest Hardware', type: 'customer', taxId: 'PAN-3333' },
]

const MOCK_HIMALAYAN_DOCS = [
  {
    id: 101,
    number: 'SI-001',
    docType: 'sales-invoice',
    party: { id: 1, name: 'Himalayan Traders' },
    date: '2026-08-01',
    narration: 'Invoice for goods',
    grossTotal: 90000,
  },
  {
    id: 102,
    number: 'RV-001',
    docType: 'receipt-voucher',
    party: { id: 1, name: 'Himalayan Traders' },
    date: '2026-08-15',
    narration: 'Payment received',
    grossTotal: 30000,
  },
]

const MOCK_NATIONAL_DOCS = [
  {
    id: 201,
    number: 'PI-001',
    docType: 'purchase-invoice',
    party: { id: 2, name: 'National Suppliers' },
    date: '2026-08-05',
    narration: 'Raw materials',
    grossTotal: 175000,
  },
  {
    id: 202,
    number: 'PV-001',
    docType: 'payment-voucher',
    party: { id: 2, name: 'National Suppliers' },
    date: '2026-08-20',
    narration: 'Vendor settlement',
    grossTotal: 175000,
  },
]

describe('PartyStatement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMock.mockResolvedValue({})
    listMock.mockImplementation((slug: string, options?: any) => {
      if (slug === 'parties') {
        return Promise.resolve({ docs: MOCK_PARTIES })
      }
      if (slug === 'documents') {
        const partyId = options?.where?.party?.equals
        if (partyId === 1) {
          return Promise.resolve({ docs: MOCK_HIMALAYAN_DOCS })
        }
        if (partyId === 2) {
          return Promise.resolve({ docs: MOCK_NATIONAL_DOCS })
        }
        return Promise.resolve({ docs: [] })
      }
      return Promise.resolve({ docs: [] })
    })
  })

  it('shows prompt to select party initially when none selected', async () => {
    render(
      <MemoryRouter>
        <PartyStatement />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/Select a party to view its transaction statement/i)).toBeDefined()
    })
  })

  it('shows loading spinner when fetching party statement and then displays data', async () => {
    let resolveDocs: (val: any) => void
    const docsPromise = new Promise((resolve) => {
      resolveDocs = resolve
    })

    listMock.mockImplementation((slug: string, options?: any) => {
      if (slug === 'parties') return Promise.resolve({ docs: MOCK_PARTIES })
      if (slug === 'documents') return docsPromise
      return Promise.resolve({ docs: [] })
    })

    render(
      <MemoryRouter initialEntries={['/reports/party-statement?party=1']}>
        <PartyStatement />
      </MemoryRouter>
    )

    // Should show loading spinner view
    expect(screen.getByText(/Loading party statement…/i)).toBeDefined()

    // Now resolve documents
    resolveDocs!({ docs: MOCK_HIMALAYAN_DOCS })

    await waitFor(() => {
      expect(screen.getByText('SI-001')).toBeDefined()
      expect(screen.getByText('RV-001')).toBeDefined()
    })
  })

  it('filters documents correctly when switching parties without stale data bleed', async () => {
    render(
      <MemoryRouter>
        <PartyStatement />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /Party:/i })).toBeDefined()
    })

    const select = screen.getByRole('combobox', { name: /Party:/i })

    // Select Party 1 (Himalayan Traders)
    fireEvent.change(select, { target: { value: '1' } })

    await waitFor(() => {
      expect(screen.getByText('SI-001')).toBeDefined()
      expect(screen.getByText('RV-001')).toBeDefined()
      // Closing receivable = 90,000 - 30,000 = 60,000
      expect(screen.getAllByText('60,000.00').length).toBeGreaterThan(0)
      expect(screen.getByText('Receivable from Customer')).toBeDefined()
    })

    // Now switch to Party 2 (National Suppliers)
    fireEvent.change(select, { target: { value: '2' } })

    await waitFor(() => {
      // Himalayan docs must NOT be present
      expect(screen.queryByText('SI-001')).toBeNull()
      expect(screen.queryByText('RV-001')).toBeNull()
      // National Suppliers docs MUST be present
      expect(screen.getByText('PI-001')).toBeDefined()
      expect(screen.getByText('PV-001')).toBeDefined()
      expect(screen.getByText('Settled')).toBeDefined()
    })

    // Now switch to Party 3 (Everest Hardware - 0 transactions)
    fireEvent.change(select, { target: { value: '3' } })

    await waitFor(() => {
      expect(screen.queryByText('PI-001')).toBeNull()
      expect(screen.queryByText('PV-001')).toBeNull()
      expect(screen.getByText(/No transactions for this party/i)).toBeDefined()
    })
  })

  it('computes opening balance when date filter is applied', async () => {
    render(
      <MemoryRouter initialEntries={['/reports/party-statement?party=1']}>
        <PartyStatement />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('SI-001')).toBeDefined()
    })

    // Dates for mock:
    // SI-001 is on 2026-08-01 (90,000)
    // RV-001 is on 2026-08-15 (30,000)
    // If from date is set to 2026-08-10:
    // SI-001 is before 2026-08-10, so opening balance = 90,000.
    // RV-001 is in the period.
    const dateInputs = document.querySelectorAll('input[type="date"]')
    const fromInput = dateInputs[0]
    fireEvent.change(fromInput, { target: { value: '2026-08-10' } })

    await waitFor(() => {
      expect(screen.getByText(/Opening Balance Brought Forward/i)).toBeDefined()
      expect(screen.getByText('RV-001')).toBeDefined()
      expect(screen.queryByText('SI-001')).toBeNull()
    })
  })

  it('filters transactions with search box', async () => {
    render(
      <MemoryRouter initialEntries={['/reports/party-statement?party=1']}>
        <PartyStatement />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('SI-001')).toBeDefined()
      expect(screen.getByText('RV-001')).toBeDefined()
    })

    const searchInput = screen.getByPlaceholderText(/Filter transactions/i)
    fireEvent.change(searchInput, { target: { value: 'Payment' } })

    await waitFor(() => {
      expect(screen.getByText('RV-001')).toBeDefined()
      expect(screen.queryByText('SI-001')).toBeNull()
    })
  })
})
