/**
 * LedgerModal component tests (MISSION.md M6).
 * Ledger fetch, states (loading/empty/error), voucher drill-back.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import LedgerModal from './LedgerModal'
import { renderEn } from '../test/renderEn'
import type { LedgerRow, Document } from '../lib/types'

const apiMock = vi.hoisted(() => vi.fn())

vi.mock('../lib/api', () => ({
  api: apiMock,
  fmt: (n: number | undefined | null) =>
    (n ?? 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
}))

vi.mock('../lib/tenant', () => ({
  useTenantQuery: () => ({ tenant: 't1' }),
  useTenant: () => ({ tenantId: 'T-1' }),
}))

const onClose = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
})

const rows: LedgerRow[] = [
  {
    id: 1,
    date: '2026-01-10',
    narration: 'Opening cash',
    status: 'posted',
    debit: 5000,
    credit: 0,
    balance: 5000,
    runningBalance: 5000,
    docId: 11,
    docNumber: 'JV-001',
  },
  {
    id: 2,
    date: '2026-01-12',
    narration: '',
    status: 'posted',
    debit: 0,
    credit: 1200,
    balance: -1200,
    runningBalance: 3800,
    docId: null,
    docNumber: null,
  },
]

describe('LedgerModal', () => {
  it('renders ledger rows with running balance and source voucher link', async () => {
    apiMock.mockResolvedValueOnce({ docs: rows, closingBalance: 3800 })
    renderEn(<LedgerModal accountId="7" accountName="Cash in Hand" onClose={onClose} />)

    expect(screen.getByText('Loading…')).toBeInTheDocument()
    const row1 = await screen.findByText('JV-001')
    expect(row1).toBeInTheDocument()
    expect(screen.getByText('Opening cash')).toBeInTheDocument()
    // 5,000.00 shows as both the debit amount and the running balance.
    expect(screen.getAllByText('5,000.00').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('3,800.00')).toBeInTheDocument()
    // Em-dash placeholders: doc number cell + narration cell
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1)

    expect(apiMock).toHaveBeenCalledWith('/journal-entries/ledger', {
      query: { account: '7', tenant: 't1' },
    })
  })

  it('shows the empty state when there are no postings', async () => {
    apiMock.mockResolvedValueOnce({ docs: [], closingBalance: 0 })
    renderEn(<LedgerModal accountId="7" accountName="Cash" onClose={onClose} />)
    expect(await screen.findByText('No postings for this account.')).toBeInTheDocument()
  })

  it('shows the error message when the ledger fetch fails', async () => {
    apiMock.mockRejectedValueOnce(new Error('boom'))
    renderEn(<LedgerModal accountId="7" accountName="Cash" onClose={onClose} />)
    expect(await screen.findByText('boom')).toBeInTheDocument()
  })

  it('falls back to a generic message for non-Error failures', async () => {
    apiMock.mockRejectedValueOnce('string failure')
    renderEn(<LedgerModal accountId="7" accountName="Cash" onClose={onClose} />)
    expect(await screen.findByText('Failed to load ledger')).toBeInTheDocument()
  })

  it('opens the source voucher when a doc number is clicked', async () => {
    apiMock.mockResolvedValueOnce({ docs: rows, closingBalance: 3800 })
    const doc: Document = {
      id: 11,
      docType: 'journal-voucher',
      number: 'JV-001',
      date: '2026-01-10',
      status: 'posted',
      journalLines: [{ account: 7, debit: 5000, credit: 0 }],
    }
    apiMock.mockResolvedValueOnce(doc)

    renderEn(<LedgerModal accountId="7" accountName="Cash" onClose={onClose} />)
    fireEvent.click(await screen.findByText('JV-001'))

    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith('/documents/11', { query: { tenant: 't1' } }),
    )
    // VoucherViewModal shows the doc-type heading + line account
    expect(await screen.findByText('Journal Entry')).toBeInTheDocument()
  })

  it('surfaces an error when the source voucher cannot be loaded', async () => {
    apiMock.mockResolvedValueOnce({ docs: rows, closingBalance: 3800 })
    apiMock.mockRejectedValueOnce(new Error('gone'))

    renderEn(<LedgerModal accountId="7" accountName="Cash" onClose={onClose} />)
    fireEvent.click(await screen.findByText('JV-001'))
    expect(await screen.findByText('Could not load the source transaction.')).toBeInTheDocument()
  })

  it('closes via the close button', async () => {
    apiMock.mockResolvedValueOnce({ docs: rows, closingBalance: 3800 })
    renderEn(<LedgerModal accountId="7" accountName="Cash" onClose={onClose} />)
    await screen.findByText('JV-001')
    fireEvent.click(screen.getByText('close'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
