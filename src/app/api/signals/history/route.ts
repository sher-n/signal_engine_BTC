import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { desc } from 'drizzle-orm'
import { db } from '../../../../db'
import { signals } from '../../../../db/schema'

const MOCK_FILE = path.join(process.cwd(), 'data', 'mock-signals.json')

export async function GET() {
  if (process.env.PLAYGROUND === 'true') {
    const mock = JSON.parse(fs.readFileSync(MOCK_FILE, 'utf-8'))
    return NextResponse.json(mock)
  }

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
