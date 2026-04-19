/**
 * runner.ts
 * Bar-by-bar backtest replay using the same core functions as production.
 *
 * Architecture:
 *   1. Pre-compute all indicators for 1D and 1H series
 *   2. For each closed 1H bar:
 *      a. Find latest closed 1D bar → bias
 *      b. Compute momentum from 1H indicators
 *      c. If no open position → checkEntry
 *      d. If open position    → evaluateExit, update state
 *   3. Force-close any open position at end of data
 */

import Decimal from 'decimal.js'
import { atr } from '../src/core/indicators/atr'
import { ema } from '../src/core/indicators/ema'
import { sma } from '../src/core/indicators/sma'
import { checkEntry } from '../src/core/strategy/entry'
import { evaluateExit } from '../src/core/strategy/exit'
import { computeBias } from '../src/core/strategy/bias'
import { computeMomentum } from '../src/core/strategy/momentum'
import { calculatePositionSize } from '../src/core/risk/position-size'
import type { Candle, StrategyConfig } from '../src/core/types'
import type { BacktestPosition, BacktestResult, ClosedTrade, PartialExit } from './types'

const ACCOUNT_BALANCE = new Decimal(10_000)

export const RISK_PERCENT_DEFAULT = new Decimal(1)
const SMA99_PERIOD = 99
const EMA14_PERIOD = 14
const EMA60_PERIOD = 60
const ATR20_PERIOD = 20

export function runBacktest(
  candles1h: Candle[],
  candles1d: Candle[],
  config: StrategyConfig,
  riskPercent: Decimal = RISK_PERCENT_DEFAULT,
): BacktestResult {
  // ── Pre-compute 1D indicators ─────────────────────────────────────────────
  const closes1d = candles1d.map((c) => c.close)
  const sma99_1d = sma(closes1d, SMA99_PERIOD)

  // ── Pre-compute 1H indicators ─────────────────────────────────────────────
  const closes1h = candles1h.map((c) => c.close)
  const ema14_1h = ema(closes1h, EMA14_PERIOD)
  const ema60_1h = ema(closes1h, EMA60_PERIOD)
  const atr20_1h = atr(candles1h, ATR20_PERIOD)

  // ── State ─────────────────────────────────────────────────────────────────
  let openPos: BacktestPosition | null = null
  let tradeId = 0
  const trades: ClosedTrade[] = []
  let equity = ACCOUNT_BALANCE
  const equityCurve: { date: Date; equity: Decimal }[] = [{ date: candles1h[0]!.closeTime, equity }]

  // ── Helper: close position (partial or full) ──────────────────────────────
  function applyExit(
    pos: BacktestPosition,
    price: Decimal,
    qty: Decimal,
    reason: PartialExit['reason'],
    barDate: Date,
  ): void {
    const pnl =
      pos.side === 'LONG' ? price.minus(pos.entry).times(qty) : pos.entry.minus(price).times(qty)

    pos.partialExits.push({ price, qty, pnl, reason, closedAt: barDate })
    pos.remainingQty = pos.remainingQty.minus(qty)
    equity = equity.plus(pnl)
  }

  function closePosition(pos: BacktestPosition, barIndex: number, barDate: Date): ClosedTrade {
    const totalPnl = pos.partialExits.reduce((s, e) => s.plus(e.pnl), new Decimal(0))
    const initialRisk = pos.entry.minus(pos.initialSl).abs().times(pos.quantity)
    const rMultiple = initialRisk.isZero() ? new Decimal(0) : totalPnl.dividedBy(initialRisk)

    const winLoss = totalPnl.greaterThan(0) ? 'WIN' : totalPnl.lessThan(0) ? 'LOSS' : 'BREAKEVEN'

    return {
      id: pos.id,
      side: pos.side,
      entry: pos.entry,
      initialSl: pos.initialSl,
      tp1: pos.tp1,
      tp2: pos.tp2,
      atrAtEntry: pos.atrAtEntry,
      quantity: pos.quantity,
      totalPnl,
      rMultiple,
      winLoss,
      openedAt: pos.openedAt,
      closedAt: barDate,
      barsHeld: barIndex - pos.openBarIndex,
      partialExits: pos.partialExits,
    }
  }

  // ── Main loop ─────────────────────────────────────────────────────────────
  for (let i = 0; i < candles1h.length; i++) {
    const bar = candles1h[i]!

    // Look up latest closed 1D bar (closeTime < bar.openTime)
    const latestD = findLatest1D(candles1d, sma99_1d, bar.openTime)
    if (!latestD) continue // not enough 1D history yet

    const { dailyClose, sma99 } = latestD
    const bias = computeBias(dailyClose, sma99, config.neutralPct)

    const e14 = ema14_1h[i]
    const e60 = ema60_1h[i]
    const e14prev = i >= config.slopeBars ? ema14_1h[i - config.slopeBars] : undefined
    const a20 = atr20_1h[i]

    // ── Exit check (has open position) ───────────────────────────────────────
    if (openPos) {
      const decision = evaluateExit({
        side: openPos.side,
        currentBar: bar,
        entry: openPos.entry,
        currentSl: openPos.stopLoss,
        tp1: openPos.tp1,
        tp2: openPos.tp2,
        atrAtEntry: openPos.atrAtEntry,
        tp1Hit: openPos.tp1Hit,
        tp2Hit: openPos.tp2Hit,
        trailAnchor: openPos.trailAnchor,
        config,
      })

      if (decision.action === 'TP1') {
        const qty = openPos.quantity.times(config.tp1Pct).toDecimalPlaces(5, Decimal.ROUND_DOWN)
        applyExit(openPos, openPos.tp1, qty, 'TP1', bar.closeTime)
        openPos.tp1Hit = true
        openPos.stopLoss = decision.newStopLoss! // move to BE
        equityCurve.push({ date: bar.closeTime, equity })
      } else if (decision.action === 'TP2') {
        // 30% of original = (tp2Pct / (1 - tp1Pct)) * remainingQty... simplified:
        const qty = openPos.quantity.times(config.tp2Pct).toDecimalPlaces(5, Decimal.ROUND_DOWN)
        applyExit(openPos, openPos.tp2, qty, 'TP2', bar.closeTime)
        openPos.tp2Hit = true
        equityCurve.push({ date: bar.closeTime, equity })
      } else if (decision.action === 'TRAIL_UPDATE') {
        openPos.stopLoss = decision.newStopLoss!
        openPos.trailAnchor = decision.newTrailAnchor!
      } else if (decision.action === 'SL') {
        const slPrice = decision.newStopLoss ?? openPos.stopLoss
        applyExit(openPos, slPrice, openPos.remainingQty, 'SL', bar.closeTime)
        trades.push(closePosition(openPos, i, bar.closeTime))
        equityCurve.push({ date: bar.closeTime, equity })
        openPos = null
      }
      continue // one action per bar (no entry on same bar as exit)
    }

    // ── Entry check (no open position) ───────────────────────────────────────
    if (!e14 || !e60 || !e14prev || !a20) continue
    if (bias === 'NEUTRAL') continue

    const momentum = computeMomentum(e14, e60, e14prev)

    const signal = checkEntry({
      bias,
      momentum,
      currentBar: bar,
      indicators: { ema14: e14, ema60: e60, ema14Prev3: e14prev, atr20: a20 },
      config,
    })

    if (!signal) continue

    const sizing = calculatePositionSize({
      accountBalance: equity,
      riskPercent,
      entry: signal.entry,
      stopLoss: signal.stopLoss,
      tp1: signal.tp1,
      tp2: signal.tp2,
    })

    openPos = {
      id: ++tradeId,
      side: signal.side,
      entry: signal.entry,
      stopLoss: signal.stopLoss,
      initialSl: signal.stopLoss,
      tp1: signal.tp1,
      tp2: signal.tp2,
      atrAtEntry: signal.atrAtEntry,
      quantity: sizing.quantity,
      remainingQty: sizing.quantity,
      tp1Hit: false,
      tp2Hit: false,
      trailAnchor: null,
      openedAt: bar.closeTime,
      openBarIndex: i,
      partialExits: [],
    }
  }

  // ── Force-close any open position at end of data ──────────────────────────
  if (openPos && candles1h.length > 0) {
    const lastBar = candles1h[candles1h.length - 1]!
    applyExit(openPos, lastBar.close, openPos.remainingQty, 'END_OF_DATA', lastBar.closeTime)
    trades.push(closePosition(openPos, candles1h.length - 1, lastBar.closeTime))
    equityCurve.push({ date: lastBar.closeTime, equity })
  }

  return { trades, equityCurve, initialEquity: ACCOUNT_BALANCE, finalEquity: equity }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function findLatest1D(
  candles1d: Candle[],
  sma99: (Decimal | undefined)[],
  beforeTime: Date,
): { dailyClose: Decimal; sma99: Decimal } | null {
  for (let i = candles1d.length - 1; i >= 0; i--) {
    const c = candles1d[i]!
    if (c.closeTime < beforeTime && sma99[i] !== undefined) {
      return { dailyClose: c.close, sma99: sma99[i]! }
    }
  }
  return null
}
