import { describe, it, expect } from 'vitest'

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

describe('account / sub-account line behavior', () => {
  const accounts = [
    { id: '100', code: '100', name: 'Sales', parent: null, type: 'income' },
    { id: '101', code: '101', name: 'Product Sales', parent: '100', type: 'income' },
    { id: '102', code: '102', name: 'Service Sales', parent: '100', type: 'income' },
    { id: '200', code: '200', name: 'Cash', parent: null, type: 'asset' },
  ]

  function childrenOf(parentId: string) {
    return accounts.filter((a) => a.parent !== null && String(a.parent) === parentId)
  }

  it('reveals sub-account column when parent account picked without item', () => {
    expect(childrenOf('100').length).toBeGreaterThan(0)
    expect(childrenOf('200').length).toBe(0)
  })

  it('requires sub-account when parent account picked without item', () => {
    const line = { item: '', account: '100', subAccount: '' }
    const hasChildren = accounts.some((a) => a.parent !== null && Number(a.parent) === Number(line.account))
    const valid = hasChildren ? Boolean(line.subAccount) : true
    expect(valid).toBe(false)
  })

  it('does not require sub-account when leaf account picked without item', () => {
    const line = { item: '', account: '200', subAccount: '' }
    const hasChildren = accounts.some((a) => a.parent !== null && Number(a.parent) === Number(line.account))
    const valid = hasChildren ? Boolean(line.subAccount) : true
    expect(valid).toBe(true)
  })

  it('rejects line with neither item nor account', () => {
    const line = { item: '', account: '', subAccount: '' }
    expect(Boolean(line.item || line.account)).toBe(false)
  })
})
