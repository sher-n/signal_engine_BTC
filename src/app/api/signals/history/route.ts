import { NextResponse } from 'next/server'
import { desc } from 'drizzle-orm'
import { db } from '../../../../db'
import { signals } from '../../../../db/schema'

export async function GET() {
  const rows = await db.query.signals.findMany({
    with: { fills: true },
    orderBy: desc(signals.openedAt),
    limit: 200,
  })

  return NextResponse.json(
    rows.map((s) => ({
      id: s.id,
      side: s.side,
      status: s.status,
      entryPrice: s.entryPrice,
      stopLoss: s.initialSl,
      tp1: s.tp1,
      tp2: s.tp2,
      atrAtEntry: s.atrAtEntry,
      quantity: s.quantity,
      realizedPnl: s.realizedPnl,
      openedAt: s.openedAt,
      closedAt: s.closedAt,
      fillCount: s.fills.length,
    })),
  )
}
