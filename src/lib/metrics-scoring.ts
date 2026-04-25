import type { MetricTop10BaseRow, MetricTop10Row } from './api-contracts'

const clamp = (v: number): number => Math.max(0, Math.min(100, v))

export const METRIC_WEIGHTS = {
  rsi: 0.2,
  macd: 0.25,
  emaTrend: 0.2,
  volumeProfile: 0.2,
  openInterest: 0.15,
} as const

export function calculateMetricScore(metrics: MetricTop10BaseRow['metrics']): number {
  const weighted =
    metrics.rsi * METRIC_WEIGHTS.rsi +
    metrics.macd * METRIC_WEIGHTS.macd +
    metrics.emaTrend * METRIC_WEIGHTS.emaTrend +
    metrics.volumeProfile * METRIC_WEIGHTS.volumeProfile +
    metrics.openInterest * METRIC_WEIGHTS.openInterest

  return clamp(Number(weighted.toFixed(2)))
}

export function deriveMetricBias(score: number): MetricTop10Row['bias'] {
  if (score >= 67) return 'BULLISH'
  if (score <= 33) return 'BEARISH'
  return 'NEUTRAL'
}

export function toScoredMetricRow(row: MetricTop10BaseRow): MetricTop10Row {
  const score = calculateMetricScore(row.metrics)
  return {
    ...row,
    score,
    bias: deriveMetricBias(score),
  }
}
