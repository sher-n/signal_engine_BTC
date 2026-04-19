import Decimal from 'decimal.js'
import type { Candle, ExitDecision, Side, StrategyConfig } from '../types'

/**
 * Core 4: Exit — Multi-TP + ATR Trailing (stateless)
 *
 * Evaluation order (first match wins):
 *   1. SL hit          → action: 'SL'
 *   2. TP2 hit         → action: 'TP2'  (only if tp1 already hit)
 *   3. Trail update    → action: 'TRAIL_UPDATE'  (after tp2 hit)
 *   4. TP1 hit         → action: 'TP1'  (only if tp1 not yet hit)
 *   5. Nothing         → action: 'HOLD'
 *
 * All exit levels are calculated from atrAtEntry (snapshot at entry).
 * Caller is responsible for maintaining state (currentSl, tp1Hit, tp2Hit, trailAnchor).
 */
export function evaluateExit(params: {
  side: Side
  currentBar: Candle
  entry: Decimal
  currentSl: Decimal
  tp1: Decimal
  tp2: Decimal
  atrAtEntry: Decimal
  tp1Hit: boolean
  tp2Hit: boolean
  trailAnchor: Decimal | null
  config: StrategyConfig
}): ExitDecision {
  const { side, currentBar, currentSl, tp1, tp2, atrAtEntry, tp1Hit, tp2Hit, trailAnchor, config } =
    params
  const { high, low } = currentBar
  const isLong = side === 'LONG'

  // ── 1. SL hit ─────────────────────────────────────────────────────────────
  const slHit = isLong ? low.lessThanOrEqualTo(currentSl) : high.greaterThanOrEqualTo(currentSl)
  if (slHit) return { action: 'SL' }

  // ── 2. TP2 hit (requires TP1 already hit) ────────────────────────────────
  if (tp1Hit && !tp2Hit) {
    const tp2Hit_ = isLong ? high.greaterThanOrEqualTo(tp2) : low.lessThanOrEqualTo(tp2)
    if (tp2Hit_) return { action: 'TP2' }
  }

  // ── 3. Trail update (after TP2 hit) ──────────────────────────────────────
  if (tp2Hit) {
    const newAnchor = isLong
      ? Decimal.max(trailAnchor ?? currentBar.high, high)
      : Decimal.min(trailAnchor ?? currentBar.low, low)

    const newTrailSl = isLong
      ? newAnchor.minus(atrAtEntry.times(config.trailMult))
      : newAnchor.plus(atrAtEntry.times(config.trailMult))

    // Check if trailing SL was hit this bar
    const trailSlHit = isLong
      ? low.lessThanOrEqualTo(newTrailSl)
      : high.greaterThanOrEqualTo(newTrailSl)

    if (trailSlHit) {
      return { action: 'SL', newStopLoss: newTrailSl }
    }

    // Update trail if anchor moved
    const anchorMoved = trailAnchor === null || !newAnchor.equals(trailAnchor)
    if (anchorMoved) {
      return {
        action: 'TRAIL_UPDATE',
        newStopLoss: newTrailSl,
        newTrailAnchor: newAnchor,
      }
    }
  }

  // ── 4. TP1 hit ────────────────────────────────────────────────────────────
  if (!tp1Hit) {
    const tp1Hit_ = isLong ? high.greaterThanOrEqualTo(tp1) : low.lessThanOrEqualTo(tp1)
    if (tp1Hit_) {
      // Move SL to breakeven on TP1
      return { action: 'TP1', newStopLoss: params.entry }
    }
  }

  return { action: 'HOLD' }
}
