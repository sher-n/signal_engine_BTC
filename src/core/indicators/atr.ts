import Decimal from 'decimal.js'
import type { Candle } from '../types'

/**
 * True Range for a single bar
 * TR = max(high - low, |high - prevClose|, |low - prevClose|)
 */
export function trueRange(candle: Candle, prevClose: Decimal): Decimal {
  const hl = candle.high.minus(candle.low)
  const hpc = candle.high.minus(prevClose).abs()
  const lpc = candle.low.minus(prevClose).abs()
  return Decimal.max(hl, hpc, lpc)
}

/**
 * Average True Range — RMA (Wilder's smoothing), NOT SMA
 *
 * RMA formula: RMA[i] = (RMA[i-1] × (period - 1) + TR[i]) / period
 * Seed: SMA of the first `period` TR values (requires period+1 candles total).
 *
 * Returns array same length as input candles.
 * First `period` values are undefined (need prevClose for TR, then need period TRs for seed).
 */
export function atr(candles: Candle[], period: number): (Decimal | undefined)[] {
  if (period < 1) throw new Error(`ATR period must be >= 1, got ${period}`)

  const result: (Decimal | undefined)[] = new Array(candles.length).fill(undefined)

  if (candles.length < period + 1) return result

  // Compute TR array (index 1..n, index 0 has no prevClose)
  const trs: Decimal[] = []
  for (let i = 1; i < candles.length; i++) {
    trs.push(trueRange(candles[i]!, candles[i - 1]!.close))
  }

  // Need at least `period` TR values for seed
  if (trs.length < period) return result

  // Seed: SMA of first `period` TR values
  let rma = new Decimal(0)
  for (let i = 0; i < period; i++) {
    rma = rma.plus(trs[i]!)
  }
  rma = rma.dividedBy(period)

  // result index maps: TR[i] corresponds to candles[i+1]
  // So seed corresponds to candles index `period` (0-based)
  result[period] = rma

  const periodDecimal = new Decimal(period)

  for (let i = period; i < trs.length; i++) {
    rma = rma
      .times(period - 1)
      .plus(trs[i]!)
      .dividedBy(periodDecimal)
    result[i + 1] = rma
  }

  return result
}
