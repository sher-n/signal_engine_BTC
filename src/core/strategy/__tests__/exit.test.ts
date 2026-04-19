import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'
import type { Candle } from '../../types'
import { DEFAULT_CONFIG } from '../../types'
import { evaluateExit } from '../exit'

const d = (v: number | string) => new Decimal(v)

function makeCandle(high: number, low: number): Candle {
  const t = new Date('2024-01-01T00:00:00Z')
  const mid = d((high + low) / 2)
  return {
    openTime: t,
    closeTime: t,
    open: mid,
    high: d(high),
    low: d(low),
    close: mid,
    volume: d(0),
  }
}

const LONG_BASE = {
  side: 'LONG' as const,
  entry: d(100),
  currentSl: d(85), // SL = entry - 1.5×ATR = 100 - 15 = 85
  tp1: d(115), // TP1 = entry + 1.5×ATR = 100 + 15 = 115
  tp2: d(130), // TP2 = entry + 3.0×ATR = 100 + 30 = 130
  atrAtEntry: d(10),
  tp1Hit: false,
  tp2Hit: false,
  trailAnchor: null,
  config: DEFAULT_CONFIG,
}

describe('evaluateExit — LONG', () => {
  it('returns HOLD when price is between SL and TP1', () => {
    const result = evaluateExit({ ...LONG_BASE, currentBar: makeCandle(110, 90) })
    expect(result.action).toBe('HOLD')
  })

  it('returns SL when low hits or breaks stop loss', () => {
    const result = evaluateExit({ ...LONG_BASE, currentBar: makeCandle(90, 84) })
    expect(result.action).toBe('SL')
  })

  it('returns TP1 when high reaches tp1 (tp1 not yet hit)', () => {
    const result = evaluateExit({ ...LONG_BASE, currentBar: makeCandle(116, 100) })
    expect(result.action).toBe('TP1')
    expect(result.newStopLoss!.toNumber()).toBe(100) // BE = entry
  })

  it('does not re-trigger TP1 when tp1Hit=true', () => {
    const result = evaluateExit({ ...LONG_BASE, tp1Hit: true, currentBar: makeCandle(120, 100) })
    // bar.high=120 < tp2=130 → should HOLD
    expect(result.action).toBe('HOLD')
  })

  it('returns TP2 when high reaches tp2 (after tp1 hit)', () => {
    const result = evaluateExit({ ...LONG_BASE, tp1Hit: true, currentBar: makeCandle(131, 100) })
    expect(result.action).toBe('TP2')
  })

  it('returns TRAIL_UPDATE when tp2 hit and anchor moves up', () => {
    // trailAnchor=130, new high=135
    // newTrailSl = 135 - 2.0×10 = 115, currentSl=85 — trail doesn't hit (low=120 > 115)
    const result = evaluateExit({
      ...LONG_BASE,
      tp1Hit: true,
      tp2Hit: true,
      trailAnchor: d(130),
      currentSl: d(110),
      currentBar: makeCandle(135, 120),
    })
    expect(result.action).toBe('TRAIL_UPDATE')
    expect(result.newTrailAnchor!.toNumber()).toBe(135)
    expect(result.newStopLoss!.toNumber()).toBe(115) // 135 - 2×10
  })

  it('returns SL when trailing SL is hit', () => {
    // trailAnchor=135, trailSl = 135 - 20 = 115, bar low=110 → SL hit
    const result = evaluateExit({
      ...LONG_BASE,
      tp1Hit: true,
      tp2Hit: true,
      trailAnchor: d(135),
      currentSl: d(115),
      currentBar: makeCandle(120, 110),
    })
    expect(result.action).toBe('SL')
  })

  it('SL takes priority over TP1 on same bar', () => {
    // Spike: low hits SL AND high hits TP1 in same bar
    const result = evaluateExit({ ...LONG_BASE, currentBar: makeCandle(120, 83) })
    expect(result.action).toBe('SL')
  })
})

describe('evaluateExit — SHORT', () => {
  const SHORT_BASE = {
    side: 'SHORT' as const,
    entry: d(100),
    currentSl: d(115), // SL = entry + 1.5×ATR
    tp1: d(85), // TP1 = entry - 1.5×ATR
    tp2: d(70), // TP2 = entry - 3.0×ATR
    atrAtEntry: d(10),
    tp1Hit: false,
    tp2Hit: false,
    trailAnchor: null,
    config: DEFAULT_CONFIG,
  }

  it('returns SL when high hits stop loss', () => {
    const result = evaluateExit({ ...SHORT_BASE, currentBar: makeCandle(116, 95) })
    expect(result.action).toBe('SL')
  })

  it('returns TP1 when low reaches tp1', () => {
    const result = evaluateExit({ ...SHORT_BASE, currentBar: makeCandle(100, 84) })
    expect(result.action).toBe('TP1')
    expect(result.newStopLoss!.toNumber()).toBe(100) // BE = entry
  })

  it('returns TP2 when low reaches tp2 (after tp1 hit)', () => {
    const result = evaluateExit({ ...SHORT_BASE, tp1Hit: true, currentBar: makeCandle(85, 69) })
    expect(result.action).toBe('TP2')
  })

  it('returns TRAIL_UPDATE for short when anchor moves down', () => {
    // trailAnchor=70, new low=65 → newAnchor=65
    // newTrailSl = 65 + 2×10 = 85, high=75 < 85 → no SL hit
    const result = evaluateExit({
      ...SHORT_BASE,
      tp1Hit: true,
      tp2Hit: true,
      trailAnchor: d(70),
      currentSl: d(90),
      currentBar: makeCandle(75, 65),
    })
    expect(result.action).toBe('TRAIL_UPDATE')
    expect(result.newTrailAnchor!.toNumber()).toBe(65)
    expect(result.newStopLoss!.toNumber()).toBe(85)
  })
})
