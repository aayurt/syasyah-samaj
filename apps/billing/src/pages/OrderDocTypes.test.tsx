/**
 * Order document types (sales-order / purchase-order) — flow tests.
 *
 * Orders are status-only documents. The server's POST /documents/:id/post
 * handler rejects them ("Orders are status-only documents (confirmed, not
 * posted)") and POST /documents/:id/confirm assigns the order number and
 * locks the order. These tests pin the SPA behaviour:
 *
 *   1. the two order types are offered in the transaction-type picker
 *   2. an order is CONFIRMED, never posted
 *   3. an ordinary voucher is still posted (no regression)
 *   4. a failed draft save does not advance the wizard
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

/**
 * The step-1 type picker. The page's <label>s are not associated with their
 * <select>s via htmlFor, so the picker is located by the document-type values
 * it offers rather than by an accessible label.
 */
function typeSelect() {
  const select = screen.getAllByRole('combobox').find((el) => {
    const values = Array.from((el as HTMLSelectElement).options).map((o) => o.value)
    return values.includes('sales-invoice') && values.includes('journal-voucher')
  }) as HTMLSelectElement | undefined
  if (!select) throw new Error('document-type picker not found')
  return select
}

/** Pick the document type on step 1. */
async function chooseType(value: string) {
  const select = typeSelect()
  fireEvent.change(select, { target: { value } })
  await waitFor(() => expect(select.value).toBe(value))
}

/** Pick a party from the step-1 dropdown. */
async function chooseParty() {
  const select = screen
    .getAllByRole('combobox')
    .find((el) => {
      const values = Array.from((el as HTMLSelectElement).options).map((o) => o.value)
      return values.includes('7')
    }) as HTMLSelectElement | undefined
  if (!select) throw new Error('party picker not found')
  fireEvent.change(select, { target: { value: '7' } })
  await waitFor(() => expect(select.value).toBe('7'))
}

/** The line-edit table only exists on step 2. */
function lineTable() {
  return screen.queryAllByRole('table').find((t) => t.querySelector('input'))
}

/**
 * Fill the single line row on step 2. The line inputs live in a table with no
 * associated <label>s, so they are addressed by their column position.
 */
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
  it('offers Sales Order and Purchase Order in the transaction-type picker', async () => {
    const { default: VoucherStepper } = await import('./VoucherStepper')
    renderWithProviders(<VoucherStepper mode="create" />)

    const values = Array.from(typeSelect().options).map((o) => o.value)
    expect(values).toContain('sales-order')
    expect(values).toContain('purchase-order')
  })

  it('confirms a sales order instead of posting it', async () => {
    const { default: VoucherStepper } = await import('./VoucherStepper')
    renderWithProviders(<VoucherStepper mode="create" />)

    await chooseType('sales-order')
    await chooseParty()

    // Step 1 → step 2.
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => expect(lineTable()).toBeDefined())

    await fillLine()

    // Step 2 → step 3 (review).
    fireEvent.click(screen.getByRole('button', { name: /review/i }))
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

    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => expect(lineTable()).toBeDefined())
    await fillLine()

    fireEvent.click(screen.getByRole('button', { name: /review/i }))
    await waitFor(() => expect(screen.getByRole('button', { name: /^post$/i })).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /^post$/i }))

    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith(
        '/documents/42/post',
        expect.objectContaining({ method: 'POST' }),
      ),
    )
  })

  it('does not advance the wizard when the draft save fails', async () => {
    failSave = true
    const { default: VoucherStepper } = await import('./VoucherStepper')
    renderWithProviders(<VoucherStepper mode="create" />)

    await chooseType('sales-order')
    await chooseParty()

    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    // The error is shown and the wizard stays on step 1.
    await waitFor(() =>
      expect(screen.getByText(/Draft save rejected by the server/i)).toBeInTheDocument(),
    )
    expect(lineTable()).toBeUndefined()
  })
})
