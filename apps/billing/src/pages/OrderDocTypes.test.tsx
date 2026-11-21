/**
 * Order document types (sales-order / purchase-order) — flow tests.
 *
 * Orders are status-only documents. The server's /post handler rejects them
 * ("Orders are status-only documents (confirmed, not posted)") and
 * /documents/:id/confirm assigns the order number and locks the order.
 * These tests pin the SPA behaviour:
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
  apiMock.mockImplementation(async (url: string, options?: { method?: string }) => handler(url, options))
})

/** Pick the document type from the grid buttons.
 * The party field only renders after a type is chosen, so select first, then wait. */
async function chooseType(value: string) {
  const labelByType: Record<string, string> = {
    'sales-order': 'Sales Order',
    'purchase-order': 'Purchase Order',
    'sales-invoice': 'Sales Invoice',
  }
  const label = labelByType[value] || value
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${label}$`, 'i') }))
  await waitFor(() => screen.getByPlaceholderText(/Search for party/i), { timeout: 5000 })
}

/** Open the party dropdown and pick Himal Builders. */
async function chooseParty() {
  const input = screen.getByPlaceholderText(/Search for party/i)
  fireEvent.focus(input)
  await waitFor(() => screen.getByRole('button', { name: /Himal Builders Pvt Ltd/i }))
  fireEvent.click(screen.getByRole('button', { name: /Himal Builders Pvt Ltd/i }))
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
  return screen.queryAllByRole('table').find((t) =>
    t.querySelector('tbody tr input[type="number"]')
  )
}

/** Fill the single line row from the item lines table. */
async function fillLine() {
  // wait for the lines table to render after party selection
  await waitFor(() => {
    const t = screen.queryAllByRole('table').find((t) => t.querySelector('tbody tr input[type="number"]'))
    if (!t) throw new Error('still waiting for lines table')
  })
  const table = screen.queryAllByRole('table').find((t) =>
    t.querySelector('tbody tr input[type="number"]')
  )
  if (!table) throw new Error('line table not found')
  const row = Array.from(table.querySelectorAll('tbody tr')).find((r) => r.querySelector('input[type="number"]'))
  if (!row) throw new Error('line row not found')
  const description = row.querySelector('input[type="text"]') as HTMLInputElement | null
  const numbers = Array.from(row.querySelectorAll('input[type="number"]')) as HTMLInputElement[]
  if (!description || !numbers[0] || !numbers[1]) throw new Error('line inputs not found')
  const [qty, rate] = numbers
  // Type to match mock item 'Steel Rod 12mm', pick from dropdown so item/account get set.
  fireEvent.change(description, { target: { value: 'Steel Rod' } })
  await waitFor(() =>
    Array.from(row.querySelectorAll('button[type="button"]')).some((b) => b.textContent?.includes('Steel Rod 12mm'))
  )
  fireEvent.click(Array.from(row.querySelectorAll('button[type="button"]')).find((b) => b.textContent?.includes('Steel Rod 12mm'))!)
  fireEvent.change(qty, { target: { value: '100' } })
  fireEvent.change(rate, { target: { value: '95' } })
}

describe('VoucherForm — order document types', () => {
  it('offers Sales Order and Purchase Order as type buttons', async () => {
    const { default: VoucherForm } = await import('./VoucherForm')
    renderWithProviders(<VoucherForm mode="create" />)

    expect(screen.getByRole('button', { name: /Sales Order/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Purchase Order/i })).toBeInTheDocument()
  })

  it('confirms a sales order instead of posting it', async () => {
    const { default: VoucherForm } = await import('./VoucherForm')
    renderWithProviders(<VoucherForm mode="create" />)

    await chooseType('sales-order')
    await chooseParty()
    await fillLine()

    fireEvent.click(screen.getByRole('button', { name: /Confirm Order/i }))
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
    const { default: VoucherForm } = await import('./VoucherForm')
    renderWithProviders(<VoucherForm mode="create" />)

    await chooseType('sales-invoice')
    await chooseParty()
    await fillLine()

    fireEvent.click(screen.getByRole('button', { name: /Save & post/i }))
    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith(
        '/documents/42/post',
        expect.objectContaining({ method: 'POST' }),
      ),
    )
  })

  it('shows an error when the draft save fails', async () => {
    failSave = true
    const { default: VoucherForm } = await import('./VoucherForm')
    renderWithProviders(<VoucherForm mode="create" />)

    await chooseType('sales-order')
    await chooseParty()
    await fillLine()

    fireEvent.click(screen.getByRole('button', { name: /Save Order/i }))
    await waitFor(() =>
      expect(screen.getByText(/Draft save rejected by the server/i)).toBeInTheDocument(),
    )
  })
})
