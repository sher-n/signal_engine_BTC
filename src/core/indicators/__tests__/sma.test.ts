import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'
import { sma } from '../sma'

const d = (v: number | string) => new Decimal(v)

describe('sma', () => {
  it('returns undefined for first period-1 values', () => {
    const result = sma([d(1), d(2), d(3), d(4), d(5)], 3)
    expect(result[0]).toBeUndefined()
    expect(result[1]).toBeUndefined()
  })

  it('computes correct values for period=3', () => {
    // [1, 2, 3, 4, 5]
    // sma[2] = (1+2+3)/3 = 2
    // sma[3] = (2+3+4)/3 = 3
    // sma[4] = (3+4+5)/3 = 4
    const result = sma([d(1), d(2), d(3), d(4), d(5)], 3)
    expect(result[2]!.toNumber()).toBe(2)
    expect(result[3]!.toNumber()).toBe(3)
    expect(result[4]!.toNumber()).toBe(4)
  })

  it('returns single value for period=1', () => {
    const result = sma([d(10), d(20), d(30)], 1)
    expect(result[0]!.toNumber()).toBe(10)
    expect(result[1]!.toNumber()).toBe(20)
    expect(result[2]!.toNumber()).toBe(30)
  })

  it('returns array of same length as input', () => {
    const input = [d(1), d(2), d(3), d(4)]
    expect(sma(input, 2)).toHaveLength(4)
  })

  it('handles period equal to input length', () => {
    const result = sma([d(1), d(2), d(3)], 3)
    expect(result[0]).toBeUndefined()
    expect(result[1]).toBeUndefined()
    expect(result[2]!.toNumber()).toBe(2)
  })

  it('handles period larger than input length', () => {
    const result = sma([d(1), d(2)], 5)
    expect(result.every((v) => v === undefined)).toBe(true)
  })

  it('throws on period < 1', () => {
    expect(() => sma([d(1)], 0)).toThrow()
  })

  it('uses Decimal precision — no floating point drift', () => {
    // 0.1 + 0.2 + 0.3 in JS floats = 0.6000000000000001
    const result = sma([d('0.1'), d('0.2'), d('0.3')], 3)
    expect(result[2]!.toFixed(1)).toBe('0.2')
  })
})
