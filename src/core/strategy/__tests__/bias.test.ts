import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'
import { computeBias } from '../bias'

const d = (v: number | string) => new Decimal(v)
const PCT = d('0.01') // 1% neutral band

describe('computeBias', () => {
  // sma99=100000, band: [99000, 101000]

  it('returns LONG_ONLY when close > upperBand', () => {
    expect(computeBias(d(101001), d(100000), PCT)).toBe('LONG_ONLY')
  })

  it('returns SHORT_ONLY when close < lowerBand', () => {
    expect(computeBias(d(98999), d(100000), PCT)).toBe('SHORT_ONLY')
  })

  it('returns NEUTRAL when close is exactly at upperBand', () => {
    // 100000 × 1.01 = 101000 — not strictly greater → NEUTRAL
    expect(computeBias(d(101000), d(100000), PCT)).toBe('NEUTRAL')
  })

  it('returns NEUTRAL when close is exactly at lowerBand', () => {
    // 100000 × 0.99 = 99000 — not strictly less → NEUTRAL
    expect(computeBias(d(99000), d(100000), PCT)).toBe('NEUTRAL')
  })

  it('returns NEUTRAL when close is inside the band', () => {
    expect(computeBias(d(100000), d(100000), PCT)).toBe('NEUTRAL')
    expect(computeBias(d(100500), d(100000), PCT)).toBe('NEUTRAL')
    expect(computeBias(d(99500), d(100000), PCT)).toBe('NEUTRAL')
  })

  it('works with zero neutralPct — any deviation gives directional bias', () => {
    expect(computeBias(d(100001), d(100000), d(0))).toBe('LONG_ONLY')
    expect(computeBias(d(99999), d(100000), d(0))).toBe('SHORT_ONLY')
    expect(computeBias(d(100000), d(100000), d(0))).toBe('NEUTRAL')
  })
})
