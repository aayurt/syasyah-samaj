/**
 * Order document types (sales-order / purchase-order) — flow tests.
 *
 * Orders are status-only documents. The server's POST /documents/:id/post
 * handler rejects them ("Orders are status-only documents (confirmed, not
 * posted)") and POST /documents/:id/confirm assigns the order number and
 * locks the order. These tests pin the SPA behaviour:
 *
 *   1. the two order types are offered as type chips
 *   2. an order is CONFIRMED, never posted
 *   3. an ordinary voucher is still posted (no regression)
 *   4. a failed draft save shows an error
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../test/testUtils'

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

/** Set to true to make the draft save fail. */
let failSave = false

function handler(url: string, options?: { method?: string }) {
  switch (url) {
    case '/parties':
      return { docs: [{ id: 7, name: 'Himal Builders Pvt Ltd', phone: '', address: '' }] }
    case '/gl-accounts':
      return { docs: [] }
    case '/items':
      return { docs: [{ id: 3, name: 'Steel Rod 12mm', unit: 'kg', salePrice: 100, purchasePrice: 90 }] }
    case '/tax-types':
      return { docs: [] }
    case '/items/stock-levels':
      return { docs: [] }
    case '/documents':
      if (failSave) throw new Error('Draft save rejected by the server')
      return { id: 42, docType: 'sales-order', status: 'draft' }
    default:
      if (options?.method) return { ok: true }
      return { docs: [] }
  }
}

beforeEach(() => {
  failSave = false
  apiMock.mockReset()
  apiMock.mockImplementation(async (url: string, options?: { method?: string }) =>
    handler(url, options),
  )
})

/** A type chip, located by its visible label (e.g. "Sales Order"). */
function chip(label: string) {
  const btn = screen.getByRole('button', { name: new RegExp(label, 'i') })
  return btn
}

/** Pick the document type chip. */
async function chooseType(value: string) {
  const label = value === 'sales-order' ? 'Sales Order'
    : value === 'purchase-order' ? 'Purchase Order'
    : value === 'sales-invoice' ? 'Sales Invoice'
    : value
  fireEvent.click(chip(label))
  await waitFor(() => screen.getByRole('button', { name: new RegExp(label, 'i') }))
}

/** Pick a party from the dropdown. */
async function chooseParty() {
  const select = await waitForEl(() => {
    const els = screen.getAllByRole('combobox')
    return els.find((el) => {
      const values = Array.from((el as HTMLSelectElement).options).map((o) => o.value)
      return values.includes('7')
    })
  }) as HTMLSelectElement | undefined
  if (!select) throw new Error('party picker not found')
  fireEvent.change(select, { target: { value: '7' } })
  await waitFor(() => expect(select.value).toBe('7'))
}

function waitForEl<T>(fn: () => T | undefined, timeout = 2000): Promise<T | undefined> {
  const start = Date.now()
  return new Promise((resolve) => {
    const tick = () => {
      const el = fn()
      if (el || Date.now() - start > timeout) { resolve(el); return }
      setTimeout(tick, 10)
    }
    tick()
  })
}

/** The item lines table. Present immediately in single-UI mode. */
function lineTable() {
  return screen.queryAllByRole('table').find((t) => t.querySelector('input'))
}

/** Fill the single line row. */
async function fillLine() {
  const table = lineTable()
  if (!table) throw new Error('line table not found')
  const row = Array.from(table.querySelectorAll('tbody tr')).find((r) => r.querySelector('input'))
  if (!row) throw new Error('line row not found')
  const inputs = Array.from(row.querySelectorAll('input')) as HTMLInputElement[]
  const [description, qty, rate] = inputs
  fireEvent.change(description, { target: { value: 'Steel rods 100kg' } })
  fireEvent.change(qty, { target: { value: '100' } })
  fireEvent.change(rate, { target: { value: '95' } })
}

describe('VoucherStepper — order document types', () => {
  it('offers Sales Order and Purchase Order as type chips', async () => {
    const { default: VoucherStepper } = await import('./VoucherStepper')
    renderWithProviders(<VoucherStepper mode="create" />)

    expect(screen.getByRole('button', { name: /Sales Order/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Purchase Order/i })).toBeInTheDocument()
  })

  it('confirms a sales order instead of posting it', async () => {
    const { default: VoucherStepper } = await import('./VoucherStepper')
    renderWithProviders(<VoucherStepper mode="create" />)

    await chooseType('sales-order')
    await chooseParty()

    await fillLine()

    fireEvent.click(screen.getByRole('button', { name: /confirm order/i }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /confirm order/i })).toBeInTheDocument(),
    )

    fireEvent.click(screen.getByRole('button', { name: /confirm order/i }))

    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith(
        '/documents/42/confirm',
        expect.objectContaining({ method: 'POST' }),
      ),
    )
    // The server rejects /post for orders — it must never be called.
    expect(apiMock).not.toHaveBeenCalledWith(
      '/documents/42/post',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('still posts an ordinary voucher (no regression)', async () => {
    const { default: VoucherStepper } = await import('./VoucherStepper')
    renderWithProviders(<VoucherStepper mode="create" />)

    await chooseType('sales-invoice')
    await chooseParty()

    await fillLine()

    fireEvent.click(screen.getByRole('button', { name: /^post$/i }))

    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith(
        '/documents/42/post',
        expect.objectContaining({ method: 'POST' }),
      ),
    )
  })

  it('shows an error when the draft save fails', async () => {
    failSave = true
    const { default: VoucherStepper } = await import('./VoucherStepper')
    renderWithProviders(<VoucherStepper mode="create" />)

    await chooseType('sales-order')
    await chooseParty()

    fireEvent.click(screen.getByRole('button', { name: /save draft/i }))

    await waitFor(() =>
      expect(screen.getByText(/Draft save rejected by the server/i)).toBeInTheDocument(),
    )
  })
})
