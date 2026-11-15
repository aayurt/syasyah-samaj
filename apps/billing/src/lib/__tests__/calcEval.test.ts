import { describe, it, expect } from 'vitest'
import { calcEval } from '../calcEval'

describe('calcEval — amount expression evaluation', () => {
  it('evaluates a simple addition', () => {
    expect(calcEval('1000+500')).toBe('1500')
  })

  it('evaluates multiplication and subtraction', () => {
    expect(calcEval('1000-200*0.13')).toBe('974')
  })

  it('evaluates parentheses', () => {
    expect(calcEval('(5000+1000)/6')).toBe('1000')
  })

  it('returns a plain number unchanged', () => {
    expect(calcEval('1234')).toBe('1234')
  })

  it('returns invalid input unchanged', () => {
    expect(calcEval('abc')).toBe('abc')
  })

  it('returns empty string unchanged', () => {
    expect(calcEval('')).toBe('')
  })

  it('returns null/undefined unchanged', () => {
    expect(calcEval(null as unknown as string)).toBeNull()
    expect(calcEval(undefined as unknown as string)).toBeUndefined()
  })

  it('rounds floating-point results to 2 decimals', () => {
    expect(calcEval('100/3')).toBe('33.33')
  })

  it('rejects expressions with variables or letters', () => {
    expect(calcEval('100 + x')).toBe('100 + x')
    expect(calcEval('100#500')).toBe('100#500')
  })
})
