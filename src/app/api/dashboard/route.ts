import { NextResponse } from 'next/server'
import Decimal from 'decimal.js'
import fs from 'fs'
import path from 'path'
import { dashboardDataSchema, type DashboardData } from '../../../lib/api-contracts'

const INITIAL_EQUITY = new Decimal(process.env.ACCOUNT_BALANCE_USDT ?? '10000')
const MOCK_FILE = path.join(process.cwd(), 'data', 'mock-dashboard.json')
const EMPTY_DASHBOARD: DashboardData = {
  stats: {
    netPnl: 0,
    returnPct: 0,
    totalTrades: 0,
    winRate: 0,
    profitFactor: null,
    maxDrawdown: 0,
    openCount: 0,
  },
  equityCurve: [],
  openPositions: [],
}

export async function GET() {
  if (process.env.PLAYGROUND === 'true') {
    try {
      if (!fs.existsSync(MOCK_FILE)) {
        console.error(
          `[api/dashboard] Missing mock file at ${MOCK_FILE}. Returning empty fallback.`,
        )
        return NextResponse.json(EMPTY_DASHBOARD, { status: 200 })
      }
      const mock = JSON.parse(fs.readFileSync(MOCK_FILE, 'utf-8'))
      return NextResponse.json(dashboardDataSchema.parse(mock))
    } catch (error) {
      console.error('[api/dashboard] Invalid mock payload. Returning empty fallback.', error)
      return NextResponse.json(EMPTY_DASHBOARD, { status: 200 })
    }
  }
  const [{ desc, eq, inArray }, { db }, { signals }] = await Promise.all([
    import('drizzle-orm'),
    import('../../../db'),
    import('../../../db/schema'),
  ])

  // Closed trades with their fills
  const closedSignals = await db.query.signals.findMany({
    where: eq(signals.status, 'CLOSED'),
    with: { fills: true },
    orderBy: desc(signals.openedAt),
  })

  // Open positions
  const openPositions = await db.query.signals.findMany({
    where: inArray(signals.status, ['ACTIVE', 'TP1_HIT', 'TP2_HIT']),
    orderBy: desc(signals.openedAt),
  })

  // Equity curve — cumulative PnL over time
  const allFills = await db.query.signalFills.findMany({
    orderBy: (f, { asc }) => [asc(f.filledAt)],
  })

  let running = INITIAL_EQUITY
  const equityCurve: { date: string; equity: number }[] = []
  for (const fill of allFills) {
    if (!fill.filledAt) continue
    running = running.plus(fill.pnl ?? '0')
    equityCurve.push({ date: new Date(fill.filledAt).toISOString(), equity: running.toNumber() })
  }

  // Stats
  const wins = closedSignals.filter((s) => new Decimal(s.realizedPnl ?? '0').greaterThan(0))
  const losses = closedSignals.filter((s) => new Decimal(s.realizedPnl ?? '0').lessThanOrEqualTo(0))

  const netPnl = closedSignals.reduce((s, t) => s.plus(t.realizedPnl ?? '0'), new Decimal(0))
  const grossProfit = wins.reduce((s, t) => s.plus(t.realizedPnl ?? '0'), new Decimal(0))
  const grossLoss = losses.reduce((s, t) => s.plus(t.realizedPnl ?? '0'), new Decimal(0)).abs()
  const profitFactor = grossLoss.isZero() ? null : grossProfit.dividedBy(grossLoss).toNumber()
  const winRate = closedSignals.length === 0 ? 0 : (wins.length / closedSignals.length) * 100

  // Max drawdown from equity curve
  let peak = INITIAL_EQUITY.toNumber()
  let maxDD = 0
  for (const pt of equityCurve) {
    if (pt.equity > peak) peak = pt.equity
    const dd = peak === 0 ? 0 : ((peak - pt.equity) / peak) * 100
    if (dd > maxDD) maxDD = dd
  }

  const payload: DashboardData = {
    stats: {
      netPnl: netPnl.toNumber(),
      returnPct: INITIAL_EQUITY.isZero()
        ? 0
        : netPnl.dividedBy(INITIAL_EQUITY).times(100).toNumber(),
      totalTrades: closedSignals.length,
      winRate: winRate,
      profitFactor,
      maxDrawdown: maxDD,
      openCount: openPositions.length,
    },
    equityCurve,
    openPositions: openPositions.map((s) => ({
      id: s.id,
      side: s.side,
      status: s.status,
      entryPrice: s.entryPrice,
      stopLoss: s.stopLoss,
      tp1: s.tp1,
      tp2: s.tp2,
      atrAtEntry: s.atrAtEntry,
      quantity: s.quantity,
      remainingQty: s.remainingQty,
      openedAt: s.openedAt,
    })),
  }

  return NextResponse.json(dashboardDataSchema.parse(payload))
}
