import Decimal from 'decimal.js'
import type { Momentum } from '../types'

/**
 * Core 2: Momentum Confirm (1H)
 *
 * BULLISH: EMA14 > EMA60 AND EMA14 > ema14Prev3 (slope positive)
 * BEARISH: EMA14 < EMA60 AND EMA14 < ema14Prev3 (slope negative)
 * FLAT:    neither condition met
 *
 * @param ema14      Current EMA14
 * @param ema60      Current EMA60
 * @param ema14Prev3 EMA14 value 3 bars ago (for slope calculation)
 */
export function computeMomentum(ema14: Decimal, ema60: Decimal, ema14Prev3: Decimal): Momentum {
  const aboveCloud = ema14.greaterThan(ema60)
  const slopeUp = ema14.greaterThan(ema14Prev3)

  if (aboveCloud && slopeUp) return 'BULLISH'

  const belowCloud = ema14.lessThan(ema60)
  const slopeDown = ema14.lessThan(ema14Prev3)

  if (belowCloud && slopeDown) return 'BEARISH'

  return 'FLAT'
}
