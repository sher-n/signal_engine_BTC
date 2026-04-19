import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'
import type { Candle } from '../../types'
import { atr, trueRange } from '../atr'

const d = (v: number | string) => new Decimal(v)

/** Build a minimal Candle */
function candle(open: number, high: number, low: number, close: number): Candle {
  const t = new Date('2024-01-01T00:00:00Z')
  return {
    openTime: t,
    closeTime: t,
    open: d(open),
    high: d(high),
    low: d(low),
    close: d(close),
    volume: d(0),
  }
}

describe('trueRange', () => {
  it('returns high-low when it is the largest', () => {
    // high-low=10, |high-prevClose|=5, |low-prevClose|=5
    const c = candle(100, 110, 100, 105)
    const tr = trueRange(c, d(105))
    expect(tr.toNumber()).toBe(10)
  })

  it('returns |high - prevClose| when gap up', () => {
    // gap up: prevClose=90, high=105, low=100 → |105-90|=15 > high-low=5
    const c = candle(100, 105, 100, 103)
    const tr = trueRange(c, d(90))
    expect(tr.toNumber()).toBe(15)
  })

  it('returns |low - prevClose| when gap down', () => {
    // gap down: prevClose=120, low=100, high=105 → |100-120|=20
    const c = candle(102, 105, 100, 103)
    const tr = trueRange(c, d(120))
    expect(tr.toNumber()).toBe(20)
  })
})

describe('atr', () => {
  it('returns undefined for first period values', () => {
    const candles = Array.from({ length: 5 }, () => candle(100, 110, 90, 100))
    const result = atr(candles, 3)
    expect(result[0]).toBeUndefined()
    expect(result[1]).toBeUndefined()
    expect(result[2]).toBeUndefined()
  })

  it('seeds ATR with SMA of first period TRs', () => {
    // Candles: all have TR=10 (high-low) with no gaps (prevClose = low)
    // period=3: seed = SMA(10,10,10) = 10 → result[3] = 10
    const cs = [
      candle(100, 110, 100, 105), // base
      candle(105, 115, 105, 110), // TR = 10
      candle(110, 120, 110, 115), // TR = 10
      candle(115, 125, 115, 120), // TR = 10 (seed avg = 10)
      candle(120, 130, 120, 125), // TR = 10
    ]
    const result = atr(cs, 3)
    expect(result[3]!.toNumber()).toBe(10) // seed
    expect(result[4]!.toNumber()).toBe(10) // RMA(10, 10) = 10
  })

  it('uses RMA (Wilder smoothing), not SMA', () => {
    // RMA[i] = (RMA[i-1] × (period-1) + TR[i]) / period
    // period=2, TRs = [10, 10, 20]
    // seed = SMA(10,10) = 10 → result[2]
    // result[3] = (10×1 + 20) / 2 = 15
    const cs = [
      candle(100, 110, 100, 100),
      candle(100, 110, 100, 100), // TR=10
      candle(100, 110, 100, 100), // TR=10 → seed=10 at index 2
      candle(100, 120, 100, 100), // TR=20 → RMA = (10×1+20)/2 = 15
    ]
    const result = atr(cs, 2)
    expect(result[2]!.toNumber()).toBe(10)
    expect(result[3]!.toNumber()).toBe(15)
  })

  it('returns array same length as input', () => {
    const cs = Array.from({ length: 10 }, () => candle(100, 110, 90, 100))
    expect(atr(cs, 3)).toHaveLength(10)
  })

  it('returns all undefined when too few candles', () => {
    const cs = [candle(100, 110, 90, 100), candle(100, 110, 90, 100)]
    const result = atr(cs, 5)
    expect(result.every((v) => v === undefined)).toBe(true)
  })

  it('ATR decreases when volatility collapses', () => {
    // Start with volatile candles, then flat candles
    const cs = [
      candle(100, 120, 80, 100), // TR=40
      candle(100, 120, 80, 100), // TR=40
      candle(100, 101, 99, 100), // TR=2
      candle(100, 101, 99, 100), // TR=2
      candle(100, 101, 99, 100), // TR=2
    ]
    const result = atr(cs, 2)
    const first = result[2]!.toNumber()
    const last = result[4]!.toNumber()
    expect(last).toBeLessThan(first)
  })
})
