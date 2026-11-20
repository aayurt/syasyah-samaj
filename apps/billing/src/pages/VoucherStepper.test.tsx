/**
 * VoucherStepper — inventory entry mode toggle tests.
 *
 * Pins behaviour:
 *   1. "Inventory entry mode" toggle renders for item doc types (sales-invoice, receipt-voucher, …)
 *   2. Toggle does NOT render for journal-voucher / contra (accounting-only types)
 *   3. Toggle background switches emerald (ON) / slate (OFF)
 *   4. First line column switches item input (ON) vs description input (OFF)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../test/testUtils'
import VoucherStepper from './VoucherStepper'

const apiMock = vi.hoisted(() => vi.fn())

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api')
  return {
    ...actual,
    api: apiMock,
    useSyncState: () => ({ cacheVersion: 0, online: true, syncingCount: 0, lastSyncAt: null }),
  }
})
vi.mock('../lib/toast', () => ({ pushToast: vi.fn() }))

function handler(url: string, options?: { method?: string }) {
  switch (url) {
    case '/parties':
      return { docs: [{ id: 7, name: 'Himal Builders Pvt Ltd', phone: '', address: '' }] }
    case '/gl-accounts':
      return { docs: [{ id: 1, name: 'Cash', class: 'cash' }] }
    case '/items':
      return { docs: [{ id: 3, name: 'Steel Rod 12mm', unit: 'kg', salePrice: 100 }] }
    case '/tax-types':
      return { docs: [] }
    case '/documents':
      return { id: 42, docType: 'sales-invoice', status: 'draft' }
    default:
      if (options?.method) return { ok: true }
      return { docs: [] }
  }
}

beforeEach(() => {
  apiMock.mockReset()
  apiMock.mockImplementation(async (url: string, options?: { method?: string }) =>
    handler(url, options),
  )
})

/** Click a voucher-type chip by its visible label. */
function pickType(label: string) {
  const buttons = screen.getAllByRole('button')
  const chip = buttons.find((b) => b.textContent?.includes(label))
  if (!chip) throw new Error(`No chip found for ${label}`)
  fireEvent.click(chip)
}

describe('VoucherStepper — inventory entry toggle', () => {
  it('renders toggle for sales-invoice', () => {
    renderWithProviders(<VoucherStepper mode="create" />)
    pickType('Sales Invoice')
    const toggle = screen.getByLabelText(/inventory entry mode/i)
    expect(toggle).toBeInTheDocument()
    // OFF by default → slate background
    expect(toggle.closest('div')).toHaveClass('border-slate-200')
    expect(toggle.closest('div')).not.toHaveClass('border-emerald-200')
  })

  it('renders toggle for receipt-voucher', () => {
    renderWithProviders(<VoucherStepper mode="create" />)
    pickType('Receipt')
    expect(screen.getByLabelText(/inventory entry mode/i)).toBeInTheDocument()
  })

  it('does NOT render toggle for journal-voucher', () => {
    renderWithProviders(<VoucherStepper mode="create" />)
    // defaults to journal-voucher
    expect(screen.queryByLabelText(/inventory entry mode/i)).not.toBeInTheDocument()
  })

  it('does NOT render toggle for contra', () => {
    renderWithProviders(<VoucherStepper mode="create" />)
    pickType('Contra Entry')
    expect(screen.queryByLabelText(/inventory entry mode/i)).not.toBeInTheDocument()
  })

  it('switches background to emerald when toggled ON', () => {
    renderWithProviders(<VoucherStepper mode="create" />)
    pickType('Receipt')
    const toggle = screen.getByLabelText(/inventory entry mode/i)
    fireEvent.click(toggle)
    expect(toggle.closest('div')).toHaveClass('border-emerald-200')
    expect(toggle.closest('div')).not.toHaveClass('border-slate-200')
  })

  it('shows description input when toggle OFF', () => {
    renderWithProviders(<VoucherStepper mode="create" />)
    pickType('Receipt')
    const descInput = screen.getByPlaceholderText(/enter item name/i)
    expect(descInput).toHaveAttribute('value', '')
  })

  it('shows item-matched name when typing an existing item name with toggle ON', () => {
    renderWithProviders(<VoucherStepper mode="create" />)
    pickType('Receipt')
    const toggle = screen.getByLabelText(/inventory entry mode/i)
    fireEvent.click(toggle) // turn ON
    const itemInput = screen.getAllByPlaceholderText(/enter item name/i)[0]
    fireEvent.change(itemInput, { target: { value: 'Steel Rod 12mm' } })
    expect(itemInput).toHaveValue('Steel Rod 12mm')
  })
})

describe('VoucherStepper — Edit Sales Invoice style totals', () => {
  /** Fill the single line row: qty, rate (per-line discount/tax columns removed). */
  function fillLine(qty = '100', rate = '10') {
    const table = screen.queryAllByRole('table').find((t) => t.querySelector('input'))
    if (!table) throw new Error('line table not found')
    const row = Array.from(table.querySelectorAll('tbody tr')).find((r) => r.querySelector('input'))
    if (!row) throw new Error('line row not found')
    const description = row.querySelector('input[placeholder*="Item name"]') as HTMLInputElement
    const numbers = Array.from(row.querySelectorAll('input[type="number"]')) as HTMLInputElement[]
    const [qtyIn, rateIn] = numbers
    if (!description || !qtyIn || !rateIn) throw new Error('line inputs not found')
    fireEvent.change(description, { target: { value: 'Steel rods' } })
    fireEvent.change(qtyIn, { target: { value: qty } })
    fireEvent.change(rateIn, { target: { value: rate } })
    return row
  }

  it('renders edit-style line table: # | Description | Qty | Rate | Amount', () => {
    renderWithProviders(<VoucherStepper mode="create" />)
    pickType('Sales Invoice')
    expect(screen.queryByText(/Unit/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Tax Code/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Tax rate/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Tax Amt/i)).not.toBeInTheDocument()
    expect(screen.getByText('#')).toBeInTheDocument()
    expect(screen.getByText('Description', { exact: true })).toBeInTheDocument()
    const row = fillLine()
    expect(Array.from(row.querySelectorAll('input[type="number"]'))).toHaveLength(2)
  })

  it('Discount on Total toggle reduces the grand total', () => {
    renderWithProviders(<VoucherStepper mode="create" />)
    pickType('Sales Invoice')
    fillLine('100', '10')
    const discountToggle = screen.getByRole('checkbox', { name: /Discount/i })
    fireEvent.click(discountToggle)
    const input = screen.getByPlaceholderText('0') as HTMLInputElement
    if (!input) throw new Error('discount input not found')
    fireEvent.change(input, { target: { value: '10' } })
    const totalRow = screen.getByText('Total').closest('div')!
    expect(totalRow.textContent).toContain('900')
    expect(totalRow.textContent).not.toContain('1,000')
  })
})
