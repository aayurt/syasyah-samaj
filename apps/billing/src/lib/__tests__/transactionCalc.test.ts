import { describe, it, expect } from 'vitest'
import { calcLine, calcDoc, type LineInput } from '../transactionCalc'

describe('transactionCalc', () => {
  it('calculates additive tax line', () => {
    const r = calcLine({ qty: 2, rate: 100, taxRate: 10, taxNature: 'additive' })
    expect(r.gross).toBe(200)
    expect(r.subtotal).toBe(200)
    expect(r.taxAmt).toBe(20)
    expect(r.total).toBe(220)
    expect(r.lineTax).toBe(20)
  })

  it('calculates inclusive tax line', () => {
    const r = calcLine({ qty: 1, rate: 110, taxRate: 10, taxNature: 'inclusive' })
    expect(r.subtotal).toBe(110)
    expect(r.taxAmt).toBe(10)
    expect(r.taxBase).toBe(100)
    expect(r.total).toBe(110)
    expect(r.lineTax).toBe(10)
  })

  it('applies percentage discount before tax', () => {
    const r = calcLine({ qty: 1, rate: 100, discountPct: 10, taxRate: 10, taxNature: 'additive' })
    expect(r.subtotal).toBe(90)
    expect(r.taxAmt).toBe(9)
    expect(r.total).toBe(99)
  })

  it('applies flat discount amount', () => {
    const r = calcLine({ qty: 1, rate: 100, discountAmt: 15, taxRate: 10, taxNature: 'additive' })
    expect(r.subtotal).toBe(85)
    expect(r.total).toBe(93.5)
  })

  it('amount override takes precedence over qty*rate', () => {
    const r = calcLine({ qty: 10, rate: 100, amount: 250, taxRate: 0, taxNature: 'additive' })
    expect(r.gross).toBe(250)
    expect(r.subtotal).toBe(250)
    expect(r.total).toBe(250)
  })

  it('aggregates document totals', () => {
    const doc = calcDoc([
      { qty: 2, rate: 100, taxRate: 10, taxNature: 'additive' },
      { qty: 1, rate: 50, taxRate: 0, taxNature: 'additive' },
    ])
    expect(doc.subtotal).toBe(250)
    expect(doc.taxTotal).toBe(20)
    expect(doc.grandTotal).toBe(270)
    expect(doc.lines).toHaveLength(2)
  })

  it('withholding tax reduces line total', () => {
    const r = calcLine({ qty: 1, rate: 100, taxRate: 10, taxNature: 'withholding' })
    expect(r.lineTax).toBe(-10)
    expect(r.total).toBe(100)
  })

  it('handles zero qty gracefully', () => {
    const r = calcLine({ qty: 0, rate: 100, taxRate: 10, taxNature: 'additive' })
    expect(r.subtotal).toBe(0)
    expect(r.total).toBe(0)
  })
})
