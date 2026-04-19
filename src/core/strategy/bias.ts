import Decimal from 'decimal.js'
import type { Bias } from '../types'

/**
 * Core 1: Bias Filter (1D)
 *
 * upperBand = sma99 × (1 + neutralPct)   e.g. sma99 × 1.01
 * lowerBand = sma99 × (1 - neutralPct)   e.g. sma99 × 0.99
 *
 * close > upperBand → LONG_ONLY
 * close < lowerBand → SHORT_ONLY
 * else              → NEUTRAL
 */
export function computeBias(dailyClose: Decimal, sma99: Decimal, neutralPct: Decimal): Bias {
  const upperBand = sma99.times(new Decimal(1).plus(neutralPct))
  const lowerBand = sma99.times(new Decimal(1).minus(neutralPct))

  if (dailyClose.greaterThan(upperBand)) return 'LONG_ONLY'
  if (dailyClose.lessThan(lowerBand)) return 'SHORT_ONLY'
  return 'NEUTRAL'
}
