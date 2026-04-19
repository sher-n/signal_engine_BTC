import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'
import { computeMomentum } from '../momentum'

const d = (v: number) => new Decimal(v)

describe('computeMomentum', () => {
  it('returns BULLISH when EMA14 > EMA60 and slope positive', () => {
    expect(computeMomentum(d(105), d(100), d(102))).toBe('BULLISH')
  })

  it('returns BEARISH when EMA14 < EMA60 and slope negative', () => {
    expect(computeMomentum(d(95), d(100), d(98))).toBe('BEARISH')
  })

  it('returns FLAT when above cloud but slope flat/negative', () => {
    // EMA14 > EMA60 but ema14 <= ema14Prev3
    expect(computeMomentum(d(105), d(100), d(105))).toBe('FLAT') // slope = 0
    expect(computeMomentum(d(105), d(100), d(107))).toBe('FLAT') // slope negative
  })

  it('returns FLAT when below cloud but slope positive', () => {
    // EMA14 < EMA60 but ema14 >= ema14Prev3
    expect(computeMomentum(d(95), d(100), d(95))).toBe('FLAT') // slope = 0
    expect(computeMomentum(d(95), d(100), d(93))).toBe('FLAT') // slope positive
  })

  it('returns FLAT when EMA14 equals EMA60', () => {
    expect(computeMomentum(d(100), d(100), d(98))).toBe('FLAT')
    expect(computeMomentum(d(100), d(100), d(102))).toBe('FLAT')
  })

  it('returns FLAT when slope is exactly zero', () => {
    expect(computeMomentum(d(105), d(100), d(105))).toBe('FLAT')
    expect(computeMomentum(d(95), d(100), d(95))).toBe('FLAT')
  })
})
