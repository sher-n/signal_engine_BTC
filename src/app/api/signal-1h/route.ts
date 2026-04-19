import { NextResponse } from 'next/server'
import Decimal from 'decimal.js'
import { desc, eq, inArray } from 'drizzle-orm'
import { fetchKlines } from '../../../adapters/binance'
import { sendAlert } from '../../../adapters/telegram'
import { db } from '../../../db'
import { marketSnapshots, signals, signalEvents } from '../../../db/schema'
import { ema } from '../../../core/indicators/ema'
import { atr } from '../../../core/indicators/atr'
import { computeBias } from '../../../core/strategy/bias'
import { computeMomentum } from '../../../core/strategy/momentum'
import { checkEntry } from '../../../core/strategy/entry'
import { calculatePositionSize } from '../../../core/risk/position-size'
import { DEFAULT_CONFIG } from '../../../core/types'
import type { Bias } from '../../../core/types'

const SYMBOL = process.env.SYMBOL ?? 'BTCUSDT'
const DRY_RUN = process.env.DRY_RUN === 'true'
const ACCOUNT_BAL = new Decimal(process.env.ACCOUNT_BALANCE_USDT ?? '10000')

export async function POST() {
  try {
    // 1. Read latest 1D snapshot from DB → derive bias
    const latestDaily = await db.query.marketSnapshots.findFirst({
      where: eq(marketSnapshots.timeframe, '1D'),
      orderBy: desc(marketSnapshots.closedAt),
    })

    let bias: Bias = 'NEUTRAL'
    if (latestDaily?.sma99 && latestDaily.close) {
      bias = computeBias(
        new Decimal(latestDaily.close),
        new Decimal(latestDaily.sma99),
        DEFAULT_CONFIG.neutralPct,
      )
    }

    if (bias === 'NEUTRAL') {
      return NextResponse.json({ skipped: 'neutral_bias' })
    }

    // 2. Skip if active signal exists
    const active = await db.query.signals.findFirst({
      where: inArray(signals.status, ['ACTIVE', 'TP1_HIT', 'TP2_HIT']),
    })
    if (active) {
      return NextResponse.json({ skipped: 'active_signal_exists', signalId: active.id })
    }

    // 3. Fetch + compute 1H indicators
    const candles = await fetchKlines(SYMBOL, '1h', 200)
    const now = Date.now()
    const closed = candles.filter((c) => c.closeTime.getTime() <= now)
    if (closed.length < 60) {
      return NextResponse.json({ skipped: 'insufficient_bars' })
    }

    const closes = closed.map((c) => c.close)
    const ema14 = ema(closes, 14)
    const ema60 = ema(closes, 60)
    const atr20 = atr(closed, 20)
    const i = closed.length - 1

    const e14 = ema14[i]
    const e60 = ema60[i]
    const e14prev = i >= DEFAULT_CONFIG.slopeBars ? ema14[i - DEFAULT_CONFIG.slopeBars] : undefined
    const a20 = atr20[i]

    if (!e14 || !e60 || !e14prev || !a20) {
      return NextResponse.json({ skipped: 'indicators_not_ready' })
    }

    // 4. Evaluate entry
    const momentum = computeMomentum(e14, e60, e14prev)
    const currentBar = closed[i]!

    const signal = checkEntry({
      bias,
      momentum,
      currentBar,
      indicators: { ema14: e14, ema60: e60, ema14Prev3: e14prev, atr20: a20 },
      config: DEFAULT_CONFIG,
    })

    if (!signal) {
      await db.insert(signalEvents).values({
        eventType: 'ENTRY_SKIPPED',
        payload: {
          bias,
          momentum,
          ema14: e14.toFixed(2),
          ema60: e60.toFixed(2),
          atr20: a20.toFixed(2),
          barClose: currentBar.close.toFixed(2),
          closedAt: currentBar.closeTime.toISOString(),
        },
      })
      return NextResponse.json({ skipped: 'no_entry_signal' })
    }

    // 5. Size Entry 1
    const sizing = calculatePositionSize({
      accountBalance: ACCOUNT_BAL,
      riskPercent: DEFAULT_CONFIG.entry1RiskPct,
      entry: signal.entry,
      stopLoss: signal.stopLoss,
      tp1: signal.tp1,
      tp2: signal.tp2,
    })

    if (DRY_RUN) {
      console.info('[DRY_RUN] signal-1h:', {
        side: signal.side,
        entry: signal.entry.toFixed(2),
        qty: sizing.quantity.toFixed(5),
      })
      return NextResponse.json({ dryRun: true, side: signal.side, entry: signal.entry.toFixed(2) })
    }

    // 6. Persist + alert
    const [created] = await db
      .insert(signals)
      .values({
        symbol: SYMBOL,
        side: signal.side,
        entryPrice: signal.entry.toFixed(8),
        stopLoss: signal.stopLoss.toFixed(8),
        initialSl: signal.stopLoss.toFixed(8),
        tp1: signal.tp1.toFixed(8),
        tp2: signal.tp2.toFixed(8),
        atrAtEntry: signal.atrAtEntry.toFixed(8),
        quantity: sizing.quantity.toFixed(8),
        remainingQty: sizing.quantity.toFixed(8),
      })
      .returning()

    if (!created) throw new Error('signal insert returned nothing')

    await db.insert(signalEvents).values({
      signalId: created.id,
      eventType: 'SIGNAL_CREATED',
      payload: {
        bias,
        momentum,
        entry: signal.entry.toFixed(2),
        sl: signal.stopLoss.toFixed(2),
        tp1: signal.tp1.toFixed(2),
        tp2: signal.tp2.toFixed(2),
        e2Trigger: signal.entry2Trigger.toFixed(2),
        qty: sizing.quantity.toFixed(5),
        riskUsd: sizing.riskUsd.toFixed(2),
      },
    })

    await sendAlert(created, 'SIGNAL_CREATED')

    return NextResponse.json({ signalId: created.id })
  } catch (err) {
    console.error('[signal-1h]', err)
    await db
      .insert(signalEvents)
      .values({
        eventType: 'FETCH_ERROR',
        payload: { route: 'signal-1h', error: String(err) },
      })
      .catch(() => {})
    throw err
  }
}
