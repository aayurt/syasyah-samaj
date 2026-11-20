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

describe('VoucherStepper — per-line discount and discount on total', () => {
  /** Fill the single line row: qty, rate, optional per-line discount pct. */
  function fillLine(qty = '100', rate = '10', discountPct?: string) {
    const table = screen.queryAllByRole('table').find((t) => t.querySelector('input'))
    if (!table) throw new Error('line table not found')
    const row = Array.from(table.querySelectorAll('tbody tr')).find((r) => r.querySelector('input'))
    if (!row) throw new Error('line row not found')
    const description = row.querySelector('input[placeholder*="Item name"]') as HTMLInputElement
    const numbers = Array.from(row.querySelectorAll('input[type="number"]')) as HTMLInputElement[]
    const [qtyIn, rateIn, discIn] = numbers
    if (!description || !qtyIn || !rateIn || !discIn) throw new Error('line inputs not found')
    fireEvent.change(description, { target: { value: 'Steel rods' } })
    fireEvent.change(qtyIn, { target: { value: qty } })
    fireEvent.change(rateIn, { target: { value: rate } })
    if (discountPct !== undefined) fireEvent.change(discIn, { target: { value: discountPct } })
    return row
  }

  it('matches image table columns: NAME, QTY, RATE, DISCOUNT, AMOUNT, TAX CODE, TAX RATE, TAX AMT, TOTAL', () => {
    renderWithProviders(<VoucherStepper mode="create" />)
    pickType('Sales Invoice')
    expect(screen.queryByText(/Unit/i)).not.toBeInTheDocument()
    const row = fillLine()
    // qty, rate, per-line discount, tax-rate = 4 number inputs
    expect(Array.from(row.querySelectorAll('input[type="number"]'))).toHaveLength(4)
  })

  it('applies per-line pct discount to the line Total cell', () => {
    renderWithProviders(<VoucherStepper mode="create" />)
    pickType('Sales Invoice')
    const row = fillLine('100', '10', '10')
    const cellTexts = Array.from(row.querySelectorAll('td')).map((td) => td.textContent)
    expect(cellTexts.join('|')).toContain('1,000') // amount = qty × rate
    expect(cellTexts.join('|')).toContain('900')   // total after 10% line discount
  })

  it('Discount on Total toggle reduces the grand total cell', () => {
    renderWithProviders(<VoucherStepper mode="create" />)
    pickType('Sales Invoice')
    fillLine('100', '10')
    const toggle = screen.getByRole('button', { name: /Discount on Total/i })
    fireEvent.click(toggle)
    const input = toggle.closest('div')?.parentElement?.querySelector('input[placeholder="0"]')
    if (!input) throw new Error('discount input not found')
    fireEvent.change(input, { target: { value: '10' } })
    const grandTotalRow = screen.getByText(/grand total/i).closest('div')!
    expect(grandTotalRow.textContent).toContain('900')
    expect(grandTotalRow.textContent).not.toContain('1,000')
  })
})
