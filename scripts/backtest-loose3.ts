/**
 * backtest-loose3.ts
 * Entry point: load cached klines → run LOOSE-3 backtest → print report + CSV
 *
 * Run: yarn backtest
 * Requires: yarn seed-history (run first)
 */

import { loadCandles } from '../backtest/loader'
import { computeMetrics } from '../backtest/metrics'
import { printReport, writeCsv } from '../backtest/report'
import { runBacktest } from '../backtest/runner'
import { DEFAULT_CONFIG } from '../src/core/types'

async function main() {
  console.info('Loading candles...')
  const candles1h = loadCandles('btcusdt_1h.json')
  const candles1d = loadCandles('btcusdt_1d.json')
  console.info(`  1H: ${candles1h.length} bars  |  1D: ${candles1d.length} bars`)

  const { tp1Mult, tp2Mult, entry1RiskPct, entry2RiskPct } = DEFAULT_CONFIG
  console.info(
    `Running backtest [TP1=${tp1Mult}×ATR | TP2=${tp2Mult}×ATR | E1=${entry1RiskPct}% | E2=${entry2RiskPct}%]...`,
  )
  const result = runBacktest(candles1h, candles1d, DEFAULT_CONFIG)
  const metrics = computeMetrics(result)

  printReport(metrics, result)

  const csvPath = writeCsv(result.trades)
  console.info(`\n📄 Per-trade CSV saved → ${csvPath}`)

  // Gate check
  const gatePass =
    metrics.totalTrades > 50 &&
    metrics.profitFactor > 1.25 &&
    metrics.maxDrawdown < 25 &&
    metrics.winRate > 30

  if (gatePass) {
    console.info('\n✅ Phase 3 gate PASSED — ready for Phase 4')
  } else {
    console.warn('\n⚠️  Phase 3 gate FAILED — review strategy before proceeding')
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('Backtest failed:', err)
  process.exit(1)
})
