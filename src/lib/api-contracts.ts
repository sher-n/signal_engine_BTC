import { z } from 'zod'

export const sideSchema = z.enum(['LONG', 'SHORT'])

export const dashboardDataSchema = z.object({
  stats: z.object({
    netPnl: z.number(),
    returnPct: z.number(),
    totalTrades: z.number(),
    winRate: z.number(),
    profitFactor: z.number().nullable(),
    maxDrawdown: z.number(),
    openCount: z.number(),
  }),
  equityCurve: z.array(
    z.object({
      date: z.string(),
      equity: z.number(),
    }),
  ),
  openPositions: z.array(
    z.object({
      id: z.string(),
      side: sideSchema,
      status: z.string(),
      entryPrice: z.string(),
      stopLoss: z.string(),
      tp1: z.string(),
      tp2: z.string(),
      quantity: z.string(),
      remainingQty: z.string(),
      openedAt: z.number().nullable(),
    }),
  ),
})

export const signalRowSchema = z.object({
  id: z.string(),
  side: sideSchema,
  status: z.string(),
  entryPrice: z.string(),
  stopLoss: z.string(),
  tp1: z.string(),
  tp2: z.string(),
  atrAtEntry: z.string(),
  quantity: z.string(),
  realizedPnl: z.string().nullable(),
  openedAt: z.number().nullable(),
  closedAt: z.number().nullable(),
  fillCount: z.number(),
})

export const signalsHistorySchema = z.array(signalRowSchema)

export const metricBiasSchema = z.enum(['BULLISH', 'NEUTRAL', 'BEARISH'])

export const metricScoresSchema = z.object({
  rsi: z.number(),
  macd: z.number(),
  emaTrend: z.number(),
  volumeProfile: z.number(),
  openInterest: z.number(),
})

export const metricTop10BaseRowSchema = z.object({
  symbol: z.string(),
  price: z.string(),
  change24hPct: z.number(),
  metrics: metricScoresSchema,
  updatedAt: z.string(),
})

export const metricsTop10BaseSchema = z.array(metricTop10BaseRowSchema)

export const metricTop10RowSchema = metricTop10BaseRowSchema.extend({
  score: z.number(),
  bias: metricBiasSchema,
})

export const metricsTop10Schema = z.array(metricTop10RowSchema)

export type DashboardData = z.infer<typeof dashboardDataSchema>
export type SignalRow = z.infer<typeof signalRowSchema>
export type MetricTop10BaseRow = z.infer<typeof metricTop10BaseRowSchema>
export type MetricTop10Row = z.infer<typeof metricTop10RowSchema>
