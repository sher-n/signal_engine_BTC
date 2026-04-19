/**
 * metrics.ts
 * Compute backtest performance metrics from closed trades + equity curve.
 */

import Decimal from 'decimal.js'
import type { BacktestResult, ClosedTrade } from './types'

export interface BacktestMetrics {
  totalTrades: number
  winCount: number
  lossCount: number
  winRate: number // 0-100
  grossProfit: Decimal
  grossLoss: Decimal
  profitFactor: number
  netPnl: Decimal
  returnPct: number
  avgWin: Decimal
  avgLoss: Decimal
  expectancy: Decimal // per trade in USDT
  avgRMultiple: number
  avgBarsHeld: number
  maxDrawdown: number // % peak-to-trough on equity curve
  maxDrawdownUsd: Decimal
  sharpeRatio: number // annualised, per-trade approximation
}

export function computeMetrics(result: BacktestResult): BacktestMetrics {
  const { trades, equityCurve, initialEquity } = result

  if (trades.length === 0) {
    return emptyMetrics(initialEquity)
  }

  const wins = trades.filter((t) => t.winLoss === 'WIN')
  const losses = trades.filter((t) => t.winLoss === 'LOSS')

  const grossProfit = wins.reduce((s, t) => s.plus(t.totalPnl), new Decimal(0))
  const grossLoss = losses.reduce((s, t) => s.plus(t.totalPnl.abs()), new Decimal(0))

  const profitFactor = grossLoss.isZero() ? Infinity : grossProfit.dividedBy(grossLoss).toNumber()

  const netPnl = result.finalEquity.minus(initialEquity)
  const returnPct = netPnl.dividedBy(initialEquity).times(100).toNumber()

  const avgWin = wins.length > 0 ? grossProfit.dividedBy(wins.length) : new Decimal(0)
  const avgLoss = losses.length > 0 ? grossLoss.dividedBy(losses.length) : new Decimal(0)

  const winRate = (wins.length / trades.length) * 100
  const lossRate = 100 - winRate
  const expectancy = avgWin.times(winRate / 100).minus(avgLoss.times(lossRate / 100))

  const avgRMultiple = trades.reduce((s, t) => s + t.rMultiple.toNumber(), 0) / trades.length
  const avgBarsHeld = Math.round(trades.reduce((s, t) => s + t.barsHeld, 0) / trades.length)

  const { maxDrawdown, maxDrawdownUsd } = computeMaxDrawdown(equityCurve)
  const sharpeRatio = computeSharpe(trades)

  return {
    totalTrades: trades.length,
    winCount: wins.length,
    lossCount: losses.length,
    winRate,
    grossProfit,
    grossLoss,
    profitFactor,
    netPnl,
    returnPct,
    avgWin,
    avgLoss,
    expectancy,
    avgRMultiple,
    avgBarsHeld,
    maxDrawdown,
    maxDrawdownUsd,
    sharpeRatio,
  }
}

function computeMaxDrawdown(equityCurve: { date: Date; equity: Decimal }[]): {
  maxDrawdown: number
  maxDrawdownUsd: Decimal
} {
  let peak = new Decimal(0)
  let maxDd = 0
  let maxDdUsd = new Decimal(0)

  for (const point of equityCurve) {
    if (point.equity.greaterThan(peak)) peak = point.equity
    const dd = peak.minus(point.equity)
    const ddPct = peak.isZero() ? 0 : dd.dividedBy(peak).times(100).toNumber()
    if (ddPct > maxDd) {
      maxDd = ddPct
      maxDdUsd = dd
    }
  }

  return { maxDrawdown: maxDd, maxDrawdownUsd: maxDdUsd }
}

function computeSharpe(trades: ClosedTrade[]): number {
  if (trades.length < 2) return 0

  const returns = trades.map((t) => t.rMultiple.toNumber())
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length
  const variance = returns.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / (returns.length - 1)
  const stdDev = Math.sqrt(variance)

  if (stdDev === 0) return 0

  // Approximate annualisation: assume ~2 trades/week → sqrt(104)
  return (mean / stdDev) * Math.sqrt(104)
}

function emptyMetrics(_initialEquity: Decimal): BacktestMetrics {
  return {
    totalTrades: 0,
    winCount: 0,
    lossCount: 0,
    winRate: 0,
    grossProfit: new Decimal(0),
    grossLoss: new Decimal(0),
    profitFactor: 0,
    netPnl: new Decimal(0),
    returnPct: 0,
    avgWin: new Decimal(0),
    avgLoss: new Decimal(0),
    expectancy: new Decimal(0),
    avgRMultiple: 0,
    avgBarsHeld: 0,
    maxDrawdown: 0,
    maxDrawdownUsd: new Decimal(0),
    sharpeRatio: 0,
  }
}
