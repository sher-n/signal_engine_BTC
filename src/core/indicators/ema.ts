import Decimal from 'decimal.js'
import { sma } from './sma'

/**
 * Exponential Moving Average — Wilder-style seeding
 *
 * Seeding: SMA of first `period` values is used as the initial EMA value.
 * This matches TradingView's ta.ema() implementation exactly.
 *
 * α = 2 / (period + 1)
 * EMA[i] = close[i] × α + EMA[i-1] × (1 - α)
 *
 * Returns array same length as input.
 * First (period-1) values are undefined.
 */
export function ema(values: Decimal[], period: number): (Decimal | undefined)[] {
  if (period < 1) throw new Error(`EMA period must be >= 1, got ${period}`)
  if (values.length < period) return new Array(values.length).fill(undefined)

  const result: (Decimal | undefined)[] = new Array(values.length).fill(undefined)
  const alpha = new Decimal(2).dividedBy(period + 1)
  const oneMinusAlpha = new Decimal(1).minus(alpha)

  // Seed: SMA of the first `period` bars
  const seeds = sma(values, period)
  const seedValue = seeds[period - 1]
  if (seedValue === undefined) return result

  result[period - 1] = seedValue

  for (let i = period; i < values.length; i++) {
    const prev = result[i - 1]!
    result[i] = values[i]!.times(alpha).plus(prev.times(oneMinusAlpha))
  }

  return result
}
