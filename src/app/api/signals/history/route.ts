import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { signalsHistorySchema, type SignalRow } from '../../../../lib/api-contracts'

const MOCK_FILE = path.join(process.cwd(), 'data', 'mock-signals.json')

export async function GET() {
  if (process.env.PLAYGROUND === 'true') {
    try {
      if (!fs.existsSync(MOCK_FILE)) {
        console.error(
          `[api/signals/history] Missing mock file at ${MOCK_FILE}. Returning empty fallback.`,
        )
        return NextResponse.json([], { status: 200 })
      }
      const mock = JSON.parse(fs.readFileSync(MOCK_FILE, 'utf-8'))
      return NextResponse.json(signalsHistorySchema.parse(mock))
    } catch (error) {
      console.error('[api/signals/history] Invalid mock payload. Returning empty fallback.', error)
      return NextResponse.json([], { status: 200 })
    }
  }
  const [{ desc }, { db }, { signals }] = await Promise.all([
    import('drizzle-orm'),
    import('../../../../db'),
    import('../../../../db/schema'),
  ])

  const rows = await db.query.signals.findMany({
    with: { fills: true },
    orderBy: desc(signals.openedAt),
    limit: 200,
  })

  const payload: SignalRow[] = rows.map((s) => ({
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
  }))

  return NextResponse.json(signalsHistorySchema.parse(payload))
}
