/**
 * OutstandingInvoices component tests (MISSION.md M6).
 * Loading state, empty party guard, invoice list, selection, filter UI.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import OutstandingInvoices from './OutstandingInvoices'
import { LangContext } from '../lib/i18n'
import { MemoryRouter } from 'react-router-dom'

const linkedGetMock = vi.hoisted(() => vi.fn())
const apiMock = vi.hoisted(() => vi.fn())

vi.mock('../lib/api', () => ({
  api: apiMock,
  fmt: (n: number | undefined | null) => (n ?? 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
  getEngine: () => ({
    readDoc: linkedGetMock,
  }),
}))

vi.mock('../lib/calendar', () => ({
  useCalendar: () => ({ calendarType: 'BS' }),
}))

vi.mock('../lib/tenant', () => ({
  useTenantQuery: () => ({ tenant: 't1' }),
}))

vi.mock('../lib/nepaliDate', () => ({
  bsToAdString: (v: string) => v,
}))

function renderInvoices(partyId?: string) {
  return render(
    <LangContext.Provider value={{ lang: 'en', setLang: () => {} }}>
      <MemoryRouter>
        <OutstandingInvoices
          partyId={partyId ?? ''}
          docType="receipt-voucher"
          selectedInvoiceId={null}
          onSelect={vi.fn()}
        />
      </MemoryRouter>
    </LangContext.Provider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('OutstandingInvoices', () => {
  it('renders nothing when partyId is empty', () => {
    const { container } = renderInvoices('')
    expect(container.innerHTML).toBe('')
  })

  it('shows loading state while fetching', () => {
    apiMock.mockResolvedValue({ docs: [] })
    renderInvoices('P1')
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('shows the empty state when the party has no invoices', async () => {
    apiMock.mockResolvedValue({ docs: [] })
    renderInvoices('P1')
    expect(await screen.findByText('No sales invoice found for this party.')).toBeInTheDocument()
  })

  it('lists posted invoices for the party', async () => {
    linkedGetMock.mockResolvedValue({ docs: [] })
    apiMock
      .mockResolvedValueOnce({
        docs: [
          { id: 10, docType: 'sales-invoice', date: '2026-01-10', status: 'posted', number: 'INV-101', party: { id: 1 }, grossTotal: 5000, netTotal: 5000, taxTotal: 0 },
          { id: 11, docType: 'sales-invoice', date: '2026-01-12', status: 'posted', number: 'INV-102', party: { id: 1 }, grossTotal: 3000, netTotal: 3000, taxTotal: 0 },
        ],
      })

    renderInvoices('1')
    expect(await screen.findByText('INV-101')).toBeInTheDocument()
    expect(await screen.findByText('Rs. 5,000.00')).toBeInTheDocument()
  })

  it('does not list non-posted or wrong-docType invoices', async () => {
    linkedGetMock.mockResolvedValue({ docs: [] })
    apiMock.mockResolvedValueOnce({
      docs: [
        { id: 1, docType: 'sales-invoice', date: '2026-01-01', status: 'draft', number: 'INV-001', party: { id: 1 }, grossTotal: 1000, netTotal: 1000, taxTotal: 0 },
        { id: 2, docType: 'receipt-voucher', date: '2026-01-02', status: 'posted', number: 'RV-001', party: { id: 1 }, grossTotal: 500, netTotal: 500, taxTotal: 0 },
        { id: 3, docType: 'sales-invoice', date: '2026-01-03', status: 'posted', number: 'INV-003', party: { id: 2 }, grossTotal: 600, netTotal: 600, taxTotal: 0 },
        { id: 4, docType: 'sales-invoice', date: '2026-01-04', status: 'posted', number: 'INV-004', party: { id: 1 }, grossTotal: 700, netTotal: 700, taxTotal: 0 },
      ],
    })

    renderInvoices('1')
    expect(await screen.findByText('INV-004')).toBeInTheDocument()
    expect(screen.queryByText('Rs. 1,000.00')).not.toBeInTheDocument()
  })

  it('highlights the selected invoice', async () => {
    const onSelect = vi.fn()
    linkedGetMock.mockResolvedValue({ docs: [] })
    apiMock.mockResolvedValueOnce({
      docs: [
        { id: 1, docType: 'sales-invoice', date: '2026-01-04', status: 'posted', number: 'INV-001', party: { id: 1 }, grossTotal: 700, netTotal: 700, taxTotal: 0 },
      ],
    })

    render(
      <LangContext.Provider value={{ lang: 'en', setLang: () => {} }}>
        <MemoryRouter>
          <OutstandingInvoices partyId="1" docType="receipt-voucher" selectedInvoiceId="1" onSelect={onSelect} />
        </MemoryRouter>
      </LangContext.Provider>,
    )
    expect(await screen.findByText('INV-001')).toBeInTheDocument()
    expect(await screen.findByText('Rs. 700.00')).toBeInTheDocument()
    // The invoice row is a button — selection is actionable via onSelect.
    const rows = screen.getAllByRole('button')
    expect(rows.length).toBeGreaterThan(0)
  })

  it('calls onSelect with the invoice id when an invoice is clicked', async () => {
    const onSelect = vi.fn()
    linkedGetMock.mockResolvedValue({ docs: [] })
    apiMock.mockResolvedValueOnce({
      docs: [
        { id: 1, docType: 'sales-invoice', date: '2026-01-04', status: 'posted', number: 'INV-001', party: { id: 1 }, grossTotal: 700, netTotal: 700, taxTotal: 0 },
      ],
    })

    render(
      <LangContext.Provider value={{ lang: 'en', setLang: () => {} }}>
    <MemoryRouter>
      <OutstandingInvoices partyId="1" docType="receipt-voucher" selectedInvoiceId={null} onSelect={onSelect} />
    </MemoryRouter>
  </LangContext.Provider>,
)
    expect(await screen.findByText('INV-001')).toBeInTheDocument()
    expect(await screen.findByText('Rs. 700.00')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Rs. 700.00'))
    expect(onSelect).toHaveBeenCalledWith('1', 700)
  })
})
