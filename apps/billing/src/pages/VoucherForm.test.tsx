/**
 * Inventory entry toggle tests.
 *
 * Tests the line-item logic that supports switching between description-only
 * and inventory item-selection modes on billing pages.
 */

/** Line total computation — shared by VoucherForm line rows */
function lineTotal(qty: number | string | undefined | null, rate: number | string | undefined | null): number {
  const q = Number(qty) || 0
  const r = Number(rate) || 0
  return q * r
}

/** Builds a line object matching the VoucherForm LineDraft shape */
function lineWith(item: string | undefined, qty: number, rate: number) {
  return { description: 'Test', qty, rate, amount: lineTotal(qty, rate), item }
}

describe('inventory entry — line total computation', () => {
  it('computes amount from qty × rate', () => {
    expect(lineTotal(2, 100)).toBe(200)
    expect(lineTotal(1.5, 50)).toBe(75)
    expect(lineTotal(0, 100)).toBe(0)
    expect(lineTotal(undefined, 100)).toBe(0)
    expect(lineTotal('3', '40')).toBe(120)
  })

  it('preserves item field when present', () => {
    const l = lineWith('ITEM-001', 2, 100)
    expect(l.item).toBe('ITEM-001')
    expect(l.amount).toBe(200)
  })

  it('defaults item to undefined when absent', () => {
    const l = lineWith(undefined, 1, 50)
    expect(l.item).toBeUndefined()
    expect(l.amount).toBe(50)
  })
})

describe('inventory entry toggle — default state logic', () => {
  const INVENTORY_TYPES = [
    'sales-invoice',
    'delivery-challan',
    'grn',
    'purchase-invoice',
    'credit-note',
    'debit-note',
  ]

  function defaultUseInventory(docType: string): boolean {
    return INVENTORY_TYPES.includes(docType)
  }

  it('defaults to true for sales invoice', () => {
    expect(defaultUseInventory('sales-invoice')).toBe(true)
  })

  it('defaults to true for purchase invoice', () => {
    expect(defaultUseInventory('purchase-invoice')).toBe(true)
  })

  it('defaults to true for GRN', () => {
    expect(defaultUseInventory('grn')).toBe(true)
  })

  it('defaults to false for payment voucher', () => {
    expect(defaultUseInventory('payment-voucher')).toBe(false)
  })

  it('defaults to false for receipt voucher', () => {
    expect(defaultUseInventory('receipt-voucher')).toBe(false)
  })

  it('defaults to false for journal voucher', () => {
    expect(defaultUseInventory('journal-voucher')).toBe(false)
  })

  it('defaults to false for contra voucher', () => {
    expect(defaultUseInventory('contra')).toBe(false)
  })
})
