/**
 * report.ts
 * Print backtest summary to console + write per-trade CSV.
 */

import fs from 'fs'
import path from 'path'
import type { BacktestMetrics } from './metrics'
import type { BacktestResult, ClosedTrade } from './types'

export function printReport(metrics: BacktestMetrics, result: BacktestResult): void {
  const pass = (label: string, value: number, min: number, fmt = (v: number) => v.toFixed(2)) => {
    const ok = value >= min
    const icon = ok ? '✅' : '❌'
    console.info(`  ${icon}  ${label.padEnd(22)} ${fmt(value).padStart(10)}  (min: ${fmt(min)})`)
  }

  console.info('\n' + '═'.repeat(60))
  console.info('  BACKTEST REPORT — LOOSE-3  (BTC/USDT 1H + 1D)')
  console.info('═'.repeat(60))

  const start = result.equityCurve[0]?.date.toISOString().slice(0, 10) ?? '—'
  const end =
    result.equityCurve[result.equityCurve.length - 1]?.date.toISOString().slice(0, 10) ?? '—'
  console.info(`  Period       : ${start} → ${end}`)
  console.info(`  Initial Eq   : $${result.initialEquity.toFixed(2)}`)
  console.info(`  Final Eq     : $${result.finalEquity.toFixed(2)}`)
  console.info(`  Net PnL      : $${metrics.netPnl.toFixed(2)}  (${metrics.returnPct.toFixed(2)}%)`)
  console.info('')

  console.info('  ── Phase Gate ──────────────────────────────────────')
  pass('Total Trades', metrics.totalTrades, 50, (v) => String(Math.round(v)))
  pass('Profit Factor', metrics.profitFactor, 1.3)
  const ddOk = metrics.maxDrawdown < 25
  const ddIcon = ddOk ? '✅' : '❌'
  console.info(
    `  ${ddIcon}  Max Drawdown         ${metrics.maxDrawdown.toFixed(2).padStart(9)}%  (max: 25%)`,
  )
  pass('Win Rate %', metrics.winRate, 40, (v) => `${v.toFixed(1)}%`)

  console.info('')
  console.info('  ── Detailed Stats ──────────────────────────────────')
  console.info(`  Wins / Losses  : ${metrics.winCount} / ${metrics.lossCount}`)
  console.info(`  Avg Win        : $${metrics.avgWin.toFixed(2)}`)
  console.info(`  Avg Loss       : $${metrics.avgLoss.toFixed(2)}`)
  console.info(`  Expectancy     : $${metrics.expectancy.toFixed(2)} per trade`)
  console.info(`  Avg R-Multiple : ${metrics.avgRMultiple.toFixed(2)}R`)
  console.info(`  Avg Bars Held  : ${metrics.avgBarsHeld} bars (1H)`)
  console.info(`  Sharpe Ratio   : ${metrics.sharpeRatio.toFixed(2)}`)
  console.info('═'.repeat(60))
}

export function writeCsv(trades: ClosedTrade[]): string {
  const dir = path.join(process.cwd(), 'data')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  const filepath = path.join(dir, 'backtest_trades.csv')

  const headers = [
    'id',
    'side',
    'openedAt',
    'closedAt',
    'barsHeld',
    'entry',
    'initialSl',
    'tp1',
    'tp2',
    'atrAtEntry',
    'quantity',
    'totalPnl',
    'rMultiple',
    'winLoss',
  ].join(',')

  const rows = trades.map((t) =>
    [
      t.id,
      t.side,
      t.openedAt.toISOString(),
      t.closedAt.toISOString(),
      t.barsHeld,
      t.entry.toFixed(2),
      t.initialSl.toFixed(2),
      t.tp1.toFixed(2),
      t.tp2.toFixed(2),
      t.atrAtEntry.toFixed(2),
      t.quantity.toFixed(5),
      t.totalPnl.toFixed(2),
      t.rMultiple.toFixed(3),
      t.winLoss,
    ].join(','),
  )

  fs.writeFileSync(filepath, [headers, ...rows].join('\n'))
  return filepath
}
