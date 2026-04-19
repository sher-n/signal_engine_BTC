import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'
import { calculatePositionSize } from '../position-size'

const d = (v: number | string) => new Decimal(v)

describe('calculatePositionSize', () => {
  const BASE = {
    accountBalance: d(10000),
    riskPercent: d(1),
    entry: d(50000),
    stopLoss: d(49000), // stopDistance = 1000
    tp1: d(51500),
    tp2: d(53000),
  }

  it('computes correct quantity', () => {
    // riskAmount = 10000 × 0.01 = 100
    // stopDistance = 50000 - 49000 = 1000
    // quantity = 100 / 1000 = 0.1 BTC
    const result = calculatePositionSize(BASE)
    expect(result.quantity.toNumber()).toBe(0.1)
  })

  it('computes correct notional', () => {
    // notional = 0.1 × 50000 = 5000
    const result = calculatePositionSize(BASE)
    expect(result.notional.toNumber()).toBe(5000)
  })

  it('computes correct riskUsd', () => {
    const result = calculatePositionSize(BASE)
    expect(result.riskUsd.toNumber()).toBe(100)
  })

  it('computes R:R to TP1 and TP2', () => {
    // rrToTp1 = (51500 - 50000) / 1000 = 1.5
    // rrToTp2 = (53000 - 50000) / 1000 = 3.0
    const result = calculatePositionSize(BASE)
    expect(result.rrToTp1.toNumber()).toBe(1.5)
    expect(result.rrToTp2.toNumber()).toBe(3)
  })

  it('rounds quantity down to 5 decimal places', () => {
    // riskAmount=100, stopDistance=3000 → qty=0.033333...
    // should round DOWN to 0.03333
    const result = calculatePositionSize({ ...BASE, stopLoss: d(47000) })
    expect(result.quantity.decimalPlaces()).toBeLessThanOrEqual(5)
    expect(result.quantity.toNumber()).toBeLessThan(100 / 3000)
  })

  it('works correctly for SHORT (stop above entry)', () => {
    const result = calculatePositionSize({
      ...BASE,
      entry: d(50000),
      stopLoss: d(51000), // short: SL above entry
      tp1: d(48500),
      tp2: d(47000),
    })
    // stopDistance = |50000 - 51000| = 1000
    expect(result.quantity.toNumber()).toBe(0.1)
    expect(result.rrToTp1.toNumber()).toBe(1.5)
  })

  it('scales correctly with different balance and risk percent', () => {
    // balance=5000, risk=2% → riskAmount=100 (same as base)
    const result = calculatePositionSize({ ...BASE, accountBalance: d(5000), riskPercent: d(2) })
    expect(result.riskUsd.toNumber()).toBe(100)
    expect(result.quantity.toNumber()).toBe(0.1)
  })

  it('throws when stop distance is zero', () => {
    expect(() => calculatePositionSize({ ...BASE, stopLoss: d(50000) })).toThrow(
      'Stop distance cannot be zero',
    )
  })
})
