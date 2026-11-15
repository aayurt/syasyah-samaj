import { describe, it, expect } from 'vitest'
import { toBaseCurrency, effectiveAmount, effectiveNet, baseCurrencyOf } from '../types'

describe('toBaseCurrency', () => {
  it('returns amount unchanged when currency is already base', () => {
    expect(toBaseCurrency(100, { currency: 'NPR', exchangeRate: 1 }, 'NPR')).toBe(100)
  })

  it('converts foreign currency to base using exchange rate', () => {
    // 1 USD = 132 NPR
    expect(toBaseCurrency(100, { currency: 'USD', exchangeRate: 132 }, 'NPR')).toBe(13200)
  })

  it('returns amount unchanged when no exchange rate is set', () => {
    expect(toBaseCurrency(100, { currency: 'USD' }, 'NPR')).toBe(100)
  })

  it('returns amount unchanged when doc is null', () => {
    expect(toBaseCurrency(100, null, 'NPR')).toBe(100)
    expect(toBaseCurrency(100, undefined, 'NPR')).toBe(100)
  })

  it('handles zero amount', () => {
    expect(toBaseCurrency(0, { currency: 'USD', exchangeRate: 132 }, 'NPR')).toBe(0)
  })
})

describe('effectiveAmount', () => {
  it('returns gross total when nothing is voided', () => {
    expect(effectiveAmount({ grossTotal: 1000 } as any)).toBe(1000)
  })

  it('subtracts voided amount from gross total', () => {
    expect(effectiveAmount({ grossTotal: 1000, voidedAmount: 300 } as any)).toBe(700)
  })

  it('treats missing grossTotal as zero', () => {
    expect(effectiveAmount({} as any)).toBe(0)
  })
})

describe('effectiveNet', () => {
  it('uses netTotal when available', () => {
    expect(effectiveNet({ netTotal: 800, grossTotal: 1000, voidedAmount: 0 } as any)).toBe(800)
  })

  it('falls back to grossTotal when netTotal is missing', () => {
    expect(effectiveNet({ grossTotal: 1000, voidedAmount: 0 } as any)).toBe(1000)
  })

  it('subtracts voided amount', () => {
    expect(effectiveNet({ netTotal: 800, grossTotal: 1000, voidedAmount: 200 } as any)).toBe(600)
  })
})

describe('baseCurrencyOf', () => {
  it('defaults to NPR when settings is null', () => {
    expect(baseCurrencyOf(null)).toBe('NPR')
    expect(baseCurrencyOf(undefined)).toBe('NPR')
  })

  it('returns the configured currency when valid', () => {
    expect(baseCurrencyOf({ defaultCurrency: 'USD' })).toBe('USD')
    expect(baseCurrencyOf({ defaultCurrency: 'NPR' })).toBe('NPR')
  })

  it('defaults to NPR for an invalid currency', () => {
    expect(baseCurrencyOf({ defaultCurrency: 'EUR' as any })).toBe('NPR')
  })
})
