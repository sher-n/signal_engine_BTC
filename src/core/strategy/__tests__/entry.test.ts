import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'
import type { Candle, IndicatorSet } from '../../types'
import { DEFAULT_CONFIG } from '../../types'
import { checkEntry } from '../entry'

const d = (v: number | string) => new Decimal(v)

function makeCandle(open: number, high: number, low: number, close: number): Candle {
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

const BASE_INDICATORS: IndicatorSet = {
  ema14: d(100),
  ema60: d(90),
  ema14Prev3: d(95),
  atr20: d(1000),
  sma99: d(95000),
}

describe('checkEntry — LONG', () => {
  it('returns EntrySignal when all LONG conditions met', () => {
    // low touches EMA14, closes above EMA14, bullish bar
    const bar = makeCandle(99, 102, 99, 101) // low=99 ≤ ema14=100, close=101 > ema14, close > open
    const signal = checkEntry({
      bias: 'LONG_ONLY',
      momentum: 'BULLISH',
      currentBar: bar,
      indicators: BASE_INDICATORS,
      config: DEFAULT_CONFIG,
    })
    expect(signal).not.toBeNull()
    expect(signal!.side).toBe('LONG')
    expect(signal!.entry.toNumber()).toBe(101)
  })

  it('computes SL, TP1, TP2 correctly from atr', () => {
    // entry=101, atr=1000, slMult=1.5, tp1Mult=1.5, tp2Mult=3.0
    const bar = makeCandle(99, 102, 99, 101)
    const signal = checkEntry({
      bias: 'LONG_ONLY',
      momentum: 'BULLISH',
      currentBar: bar,
      indicators: BASE_INDICATORS,
      config: DEFAULT_CONFIG,
    })
    expect(signal!.stopLoss.toNumber()).toBe(101 - 1.5 * 1000) // -1399
    expect(signal!.tp1.toNumber()).toBe(101 + 1.5 * 1000) // 1601
    expect(signal!.tp2.toNumber()).toBe(101 + 3.0 * 1000) // 3101
  })

  it('returns null when close does not reclaim above EMA14', () => {
    const bar = makeCandle(99, 102, 99, 99.5) // close=99.5 < ema14=100
    expect(
      checkEntry({
        bias: 'LONG_ONLY',
        momentum: 'BULLISH',
        currentBar: bar,
        indicators: BASE_INDICATORS,
        config: DEFAULT_CONFIG,
      }),
    ).toBeNull()
  })

  it('returns null when bar is bearish (close < open)', () => {
    const bar = makeCandle(102, 103, 99, 100.5) // close < open
    expect(
      checkEntry({
        bias: 'LONG_ONLY',
        momentum: 'BULLISH',
        currentBar: bar,
        indicators: BASE_INDICATORS,
        config: DEFAULT_CONFIG,
      }),
    ).toBeNull()
  })

  it('returns null when low never touched EMA14', () => {
    const bar = makeCandle(101, 103, 101, 102) // low=101 > ema14=100
    expect(
      checkEntry({
        bias: 'LONG_ONLY',
        momentum: 'BULLISH',
        currentBar: bar,
        indicators: BASE_INDICATORS,
        config: DEFAULT_CONFIG,
      }),
    ).toBeNull()
  })

  it('returns null when bias is NEUTRAL', () => {
    const bar = makeCandle(99, 102, 99, 101)
    expect(
      checkEntry({
        bias: 'NEUTRAL',
        momentum: 'BULLISH',
        currentBar: bar,
        indicators: BASE_INDICATORS,
        config: DEFAULT_CONFIG,
      }),
    ).toBeNull()
  })

  it('returns null when momentum is not BULLISH', () => {
    const bar = makeCandle(99, 102, 99, 101)
    expect(
      checkEntry({
        bias: 'LONG_ONLY',
        momentum: 'BEARISH',
        currentBar: bar,
        indicators: BASE_INDICATORS,
        config: DEFAULT_CONFIG,
      }),
    ).toBeNull()
    expect(
      checkEntry({
        bias: 'LONG_ONLY',
        momentum: 'FLAT',
        currentBar: bar,
        indicators: BASE_INDICATORS,
        config: DEFAULT_CONFIG,
      }),
    ).toBeNull()
  })

  it('returns null when indicators are missing', () => {
    const bar = makeCandle(99, 102, 99, 101)
    expect(
      checkEntry({
        bias: 'LONG_ONLY',
        momentum: 'BULLISH',
        currentBar: bar,
        indicators: { ema14: d(100) },
        config: DEFAULT_CONFIG,
      }),
    ).toBeNull()
  })
})

describe('checkEntry — SHORT', () => {
  const SHORT_INDICATORS: IndicatorSet = {
    ema14: d(100),
    ema60: d(110),
    ema14Prev3: d(105),
    atr20: d(1000),
  }

  it('returns EntrySignal when all SHORT conditions met', () => {
    // high touches EMA14, closes below EMA14, bearish bar
    const bar = makeCandle(101, 101, 98, 99) // high=101 ≥ ema14=100, close=99 < ema14, close < open
    const signal = checkEntry({
      bias: 'SHORT_ONLY',
      momentum: 'BEARISH',
      currentBar: bar,
      indicators: SHORT_INDICATORS,
      config: DEFAULT_CONFIG,
    })
    expect(signal).not.toBeNull()
    expect(signal!.side).toBe('SHORT')
  })

  it('computes SL, TP1, TP2 correctly for SHORT', () => {
    // entry=99, atr=1000
    const bar = makeCandle(101, 101, 98, 99)
    const signal = checkEntry({
      bias: 'SHORT_ONLY',
      momentum: 'BEARISH',
      currentBar: bar,
      indicators: SHORT_INDICATORS,
      config: DEFAULT_CONFIG,
    })
    expect(signal!.stopLoss.toNumber()).toBe(99 + 1.5 * 1000) // 1599
    expect(signal!.tp1.toNumber()).toBe(99 - 1.5 * 1000) // -1401
    expect(signal!.tp2.toNumber()).toBe(99 - 3.0 * 1000) // -2901
  })

  it('returns null when close does not reclaim below EMA14', () => {
    const bar = makeCandle(101, 101, 98, 100.5) // close > ema14
    expect(
      checkEntry({
        bias: 'SHORT_ONLY',
        momentum: 'BEARISH',
        currentBar: bar,
        indicators: SHORT_INDICATORS,
        config: DEFAULT_CONFIG,
      }),
    ).toBeNull()
  })
})
