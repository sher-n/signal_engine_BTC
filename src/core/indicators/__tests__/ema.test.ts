import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'
import { ema } from '../ema'

const d = (v: number | string) => new Decimal(v)

describe('ema', () => {
  it('returns undefined for first period-1 values', () => {
    const result = ema([d(1), d(2), d(3), d(4), d(5)], 3)
    expect(result[0]).toBeUndefined()
    expect(result[1]).toBeUndefined()
  })

  it('seeds with SMA of first period values', () => {
    // period=3, values=[1,2,3,...], seed = SMA(1,2,3) = 2
    const result = ema([d(1), d(2), d(3), d(4), d(5)], 3)
    expect(result[2]!.toNumber()).toBe(2) // seed = SMA(1,2,3)
  })

  it('applies EMA formula correctly for period=3 (α=0.5)', () => {
    // period=3 → α = 2/(3+1) = 0.5
    // seed[2] = SMA(1,2,3) = 2
    // ema[3]  = 4×0.5 + 2×0.5 = 3
    // ema[4]  = 5×0.5 + 3×0.5 = 4
    const result = ema([d(1), d(2), d(3), d(4), d(5)], 3)
    expect(result[3]!.toNumber()).toBe(3)
    expect(result[4]!.toNumber()).toBe(4)
  })

  it('returns array of same length as input', () => {
    expect(ema([d(1), d(2), d(3), d(4)], 2)).toHaveLength(4)
  })

  it('handles period=1 — every value is its own EMA', () => {
    // period=1 → α=1 → EMA = close
    const result = ema([d(10), d(20), d(30)], 1)
    expect(result[0]!.toNumber()).toBe(10)
    expect(result[1]!.toNumber()).toBe(20)
    expect(result[2]!.toNumber()).toBe(30)
  })

  it('returns all undefined when input shorter than period', () => {
    const result = ema([d(1), d(2)], 5)
    expect(result.every((v) => v === undefined)).toBe(true)
  })

  it('EMA lags — rising series should show EMA < last value', () => {
    const rising = Array.from({ length: 20 }, (_, i) => d(i + 1))
    const result = ema(rising, 5)
    const last = result[result.length - 1]!
    expect(last.toNumber()).toBeLessThan(20)
  })

  it('throws on period < 1', () => {
    expect(() => ema([d(1)], 0)).toThrow()
  })

  it('hand-calculated 5-bar EMA14 seed matches SMA', () => {
    // With period=5, seed should equal SMA of first 5 values
    const values = [d(10), d(12), d(11), d(13), d(14), d(15)]
    const result = ema(values, 5)
    // seed = (10+12+11+13+14)/5 = 60/5 = 12
    expect(result[4]!.toNumber()).toBe(12)
  })
})
