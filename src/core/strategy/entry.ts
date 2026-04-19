import type { Bias, Candle, EntrySignal, IndicatorSet, Momentum, StrategyConfig } from '../types'

/**
 * Core 3: Entry — Adaptive Pullback (LOOSE-3)
 *
 * LONG entry (all must be true):
 *   1. bias === 'LONG_ONLY'
 *   2. momentum === 'BULLISH'
 *   3. bar.low <= ema14              (touched pullback zone)
 *   4. bar.close > ema14             (reclaimed above)
 *   5. bar.close > bar.open          (bullish bar confirms)
 *
 * SHORT entry (mirror):
 *   1. bias === 'SHORT_ONLY'
 *   2. momentum === 'BEARISH'
 *   3. bar.high >= ema14             (touched pullback zone)
 *   4. bar.close < ema14             (reclaimed below)
 *   5. bar.close < bar.open          (bearish bar confirms)
 *
 * Returns null if no entry conditions are met.
 */
export function checkEntry(params: {
  bias: Bias
  momentum: Momentum
  currentBar: Candle
  indicators: IndicatorSet
  config: StrategyConfig
}): EntrySignal | null {
  const { bias, momentum, currentBar, indicators, config } = params
  const { ema14, atr20 } = indicators

  if (ema14 === undefined || atr20 === undefined) return null

  const { open, high, low, close } = currentBar
  const atrSlMult = config.slMult
  const atrTp1Mult = config.tp1Mult
  const atrTp2Mult = config.tp2Mult

  // ── LONG ─────────────────────────────────────────────────────────────────
  if (
    bias === 'LONG_ONLY' &&
    momentum === 'BULLISH' &&
    low.lessThanOrEqualTo(ema14) && // touched pullback zone
    close.greaterThan(ema14) && // reclaimed above EMA14
    close.greaterThan(open) // bullish bar
  ) {
    const entry = close
    const stopLoss = entry.minus(atr20.times(atrSlMult))
    const tp1 = entry.plus(atr20.times(atrTp1Mult))
    const tp2 = entry.plus(atr20.times(atrTp2Mult))

    return { side: 'LONG', entry, stopLoss, tp1, tp2, atrAtEntry: atr20 }
  }

  // ── SHORT ────────────────────────────────────────────────────────────────
  if (
    bias === 'SHORT_ONLY' &&
    momentum === 'BEARISH' &&
    high.greaterThanOrEqualTo(ema14) && // touched pullback zone
    close.lessThan(ema14) && // reclaimed below EMA14
    close.lessThan(open) // bearish bar
  ) {
    const entry = close
    const stopLoss = entry.plus(atr20.times(atrSlMult))
    const tp1 = entry.minus(atr20.times(atrTp1Mult))
    const tp2 = entry.minus(atr20.times(atrTp2Mult))

    return { side: 'SHORT', entry, stopLoss, tp1, tp2, atrAtEntry: atr20 }
  }

  return null
}
