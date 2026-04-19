import { NextResponse } from 'next/server'
import { fetchKlines } from '../../../adapters/binance'
import { db } from '../../../db'
import { marketSnapshots, signalEvents } from '../../../db/schema'
import { sma } from '../../../core/indicators/sma'
import { computeBias } from '../../../core/strategy/bias'
import { DEFAULT_CONFIG } from '../../../core/types'

const SYMBOL = process.env.SYMBOL ?? 'BTCUSDT'
const SMA_PERIOD = 99

export async function POST() {
  try {
    const candles = await fetchKlines(SYMBOL, '1d', 110)
    const now = Date.now()
    const closed = candles.filter((c) => c.closeTime.getTime() <= now)

    if (closed.length < SMA_PERIOD) {
      return NextResponse.json({ error: 'insufficient 1D bars' }, { status: 422 })
    }

    const closes = closed.map((c) => c.close)
    const sma99arr = sma(closes, SMA_PERIOD)
    const latestIdx = closed.length - 1
    const latestSma = sma99arr[latestIdx]
    const latestBar = closed[latestIdx]!

    if (!latestSma) {
      return NextResponse.json({ error: 'SMA99 not ready' }, { status: 422 })
    }

    const bias = computeBias(latestBar.close, latestSma, DEFAULT_CONFIG.neutralPct)

    // Upsert snapshot — bias is derivable from sma99 + close, no separate cache needed
    await db
      .insert(marketSnapshots)
      .values({
        symbol: SYMBOL,
        timeframe: '1D',
        closedAt: latestBar.closeTime,
        open: latestBar.open.toFixed(8),
        high: latestBar.high.toFixed(8),
        low: latestBar.low.toFixed(8),
        close: latestBar.close.toFixed(8),
        volume: latestBar.volume.toFixed(8),
        sma99: latestSma.toFixed(8),
      })
      .onConflictDoUpdate({
        target: [marketSnapshots.symbol, marketSnapshots.timeframe, marketSnapshots.closedAt],
        set: { sma99: latestSma.toFixed(8) },
      })

    await db.insert(signalEvents).values({
      eventType: 'BIAS_UPDATED',
      payload: {
        bias,
        sma99: latestSma.toFixed(2),
        close: latestBar.close.toFixed(2),
        closedAt: latestBar.closeTime.toISOString(),
      },
    })

    return NextResponse.json({ bias, sma99: latestSma.toFixed(2) })
  } catch (err) {
    console.error('[bias-1d]', err)
    await db
      .insert(signalEvents)
      .values({
        eventType: 'FETCH_ERROR',
        payload: { route: 'bias-1d', error: String(err) },
      })
      .catch(() => {})
    throw err
  }
}
