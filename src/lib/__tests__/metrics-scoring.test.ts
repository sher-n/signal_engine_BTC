import { describe, expect, it } from 'vitest'
import { calculateMetricScore, deriveMetricBias, toScoredMetricRow } from '../metrics-scoring'

describe('metrics scoring', () => {
  it('keeps score in range 0..100', () => {
    const score = calculateMetricScore({
      rsi: 120,
      macd: 200,
      emaTrend: 150,
      volumeProfile: 110,
      openInterest: 130,
    })
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })

  it('is deterministic for fixed inputs', () => {
    const metrics = {
      rsi: 64.2,
      macd: 61.1,
      emaTrend: 59.5,
      volumeProfile: 63.9,
      openInterest: 58.8,
    }
    const a = calculateMetricScore(metrics)
    const b = calculateMetricScore(metrics)
    expect(a).toBe(b)
  })

  it('maps thresholds to bias correctly', () => {
    expect(deriveMetricBias(67)).toBe('BULLISH')
    expect(deriveMetricBias(66)).toBe('NEUTRAL')
    expect(deriveMetricBias(34)).toBe('NEUTRAL')
    expect(deriveMetricBias(33)).toBe('BEARISH')
  })

  it('adds score and bias to base row', () => {
    const row = toScoredMetricRow({
      symbol: 'BTCUSDT',
      price: '95000.00',
      change24hPct: 2.4,
      metrics: { rsi: 70, macd: 75, emaTrend: 72, volumeProfile: 68, openInterest: 65 },
      updatedAt: '2026-04-25T12:45:00.000Z',
    })
    expect(row.score).toBeTypeOf('number')
    expect(['BULLISH', 'NEUTRAL', 'BEARISH']).toContain(row.bias)
  })
})
