/**
 * VoucherViewModal component tests (MISSION.md M6).
 * Renders a source voucher for drill-back from Daybooks/Journal lists.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import VoucherViewModal from './VoucherViewModal'
import { renderEn } from '../test/renderEn'
import { formatDate } from '../lib/nepaliDate'
import type { Document } from '../lib/types'

vi.mock('../lib/api', () => ({
  // `api` is imported (but unused at runtime) by lib/calendar — keep it defined.
  api: vi.fn(),
  fmt: (n: number | undefined | null) =>
    (n ?? 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
}))

const onClose = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
})

const base: Document = {
  id: 42,
  docType: 'sales-invoice',
  number: 'INV-001',
  date: '2026-01-15',
  status: 'posted',
  narration: 'Weekly kirana sale',
  netTotal: 1000,
  taxTotal: 130,
  grossTotal: 1130,
  journalLines: [
    { account: { id: 7, name: 'Cash in Hand' } as never, debit: 1130, credit: 0 },
    { account: 9, debit: 0, credit: 1130 },
  ],
  lines: [{ description: 'Rice 5kg', qty: 2, rate: 500, amount: 1000 }],
}

describe('VoucherViewModal', () => {
  it('renders nothing when voucher is null', () => {
    const { container } = renderEn(<VoucherViewModal voucher={null} onClose={onClose} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders doc type, number, date, status and narration', () => {
    renderEn(<VoucherViewModal voucher={base} onClose={onClose} />)
    expect(screen.getByText('Sales Invoice')).toBeInTheDocument()
    expect(
      screen.getByText(`INV-001 · ${formatDate('2026-01-15', 'BS', 'YYYY-MM-DD')}`),
    ).toBeInTheDocument()
    expect(screen.getByText('Status:')).toBeInTheDocument()
    expect(screen.getByText('posted')).toBeInTheDocument()
    expect(screen.getByText('Narration:')).toBeInTheDocument()
    expect(screen.getByText('Weekly kirana sale')).toBeInTheDocument()
  })

  it('falls back to #id when number is missing', () => {
    renderEn(<VoucherViewModal voucher={{ ...base, number: undefined }} onClose={onClose} />)
    expect(screen.getByText(`#42 · ${formatDate('2026-01-15', 'BS', 'YYYY-MM-DD')}`)).toBeInTheDocument()
  })

  it('renders journal lines with object account names and id fallbacks', () => {
    renderEn(<VoucherViewModal voucher={base} onClose={onClose} />)
    expect(screen.getByText('Cash in Hand')).toBeInTheDocument()
    expect(screen.getByText('Account #9')).toBeInTheDocument()
    // 1,130.00 appears in both the journal debit row and the footer total.
    expect(screen.getAllByText('1,130.00').length).toBeGreaterThanOrEqual(2)
  })

  it('renders invoice item lines with fallback label and totals', () => {
    renderEn(<VoucherViewModal voucher={base} onClose={onClose} />)
    expect(screen.getByText('Rice 5kg')).toBeInTheDocument()
    expect(screen.getByText('Net 1,000.00')).toBeInTheDocument()
    expect(screen.getByText('Tax 130.00')).toBeInTheDocument()
    expect(screen.getByText('Total 1,130.00')).toBeInTheDocument()
  })

  it('uses the "Item line" fallback for lines without a description', () => {
    renderEn(
      <VoucherViewModal
        voucher={{ ...base, lines: [{ description: '', amount: 50 }] }}
        onClose={onClose}
      />,
    )
    expect(screen.getByText('Item line')).toBeInTheDocument()
  })

  it('hides narration row when there is no narration', () => {
    renderEn(<VoucherViewModal voucher={{ ...base, narration: undefined }} onClose={onClose} />)
    expect(screen.queryByText('Narration:')).not.toBeInTheDocument()
  })

  it('calls onClose from the X button and from backdrop clicks', () => {
    renderEn(<VoucherViewModal voucher={base} onClose={onClose} />)
    fireEvent.click(screen.getByLabelText('Close'))
    expect(onClose).toHaveBeenCalledTimes(1)

    // Backdrop is the fixed overlay; its click bubbles to the modal root.
    const backdrop = screen.getByText('Sales Invoice').closest('.fixed')!
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
