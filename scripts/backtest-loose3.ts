/**
 * backtest-loose3.ts
 * Entry point: load cached klines → run LOOSE-3 backtest → print report + CSV
 *
 * Run: yarn backtest
 * Requires: yarn seed-history (run first)
 */

import Decimal from 'decimal.js'
import { loadCandles } from '../backtest/loader'
import { computeMetrics } from '../backtest/metrics'
import { printReport, writeCsv } from '../backtest/report'
import { runBacktest } from '../backtest/runner'
import { DEFAULT_CONFIG } from '../src/core/types'

// ── Adjusted config: TP1 = 4.0×ATR, TP2 = 8.0×ATR, risk = 0.5% ─────────────
// DEFAULT_CONFIG (production) is unchanged — this is backtest-only variant
const ADJUSTED_CONFIG = {
  ...DEFAULT_CONFIG,
  tp1Mult: new Decimal('4.0'), // was 1.5 — farther TP1 improves R:R
  tp2Mult: new Decimal('8.0'), // was 3.0 — scaled 2× from TP1 to keep ordering
}
const RISK_PERCENT = new Decimal('0.5') // was 1% — half size to manage drawdown

async function main() {
  console.info('Loading candles...')
  const candles1h = loadCandles('btcusdt_1h.json')
  const candles1d = loadCandles('btcusdt_1d.json')
  console.info(`  1H: ${candles1h.length} bars  |  1D: ${candles1d.length} bars`)

  console.info(
    `Running backtest [TP1=${ADJUSTED_CONFIG.tp1Mult}×ATR | TP2=${ADJUSTED_CONFIG.tp2Mult}×ATR | risk=${RISK_PERCENT}%]...`,
  )
  const result = runBacktest(candles1h, candles1d, ADJUSTED_CONFIG, RISK_PERCENT)
  const metrics = computeMetrics(result)

  printReport(metrics, result)

  const csvPath = writeCsv(result.trades)
  console.info(`\n📄 Per-trade CSV saved → ${csvPath}`)

  // Gate check
  const gatePass =
    metrics.totalTrades > 50 &&
    metrics.profitFactor > 2 &&
    metrics.maxDrawdown < 15 &&
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
