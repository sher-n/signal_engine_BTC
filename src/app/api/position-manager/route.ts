import { NextResponse } from 'next/server'
import Decimal from 'decimal.js'
import { eq, inArray } from 'drizzle-orm'
import { fetchKlines } from '../../../adapters/binance'
import { sendAlert } from '../../../adapters/telegram'
import { db } from '../../../db'
import { signals, signalFills, signalEvents } from '../../../db/schema'
import { evaluateExit } from '../../../core/strategy/exit'
import { calculatePositionSize } from '../../../core/risk/position-size'
import { DEFAULT_CONFIG } from '../../../core/types'

const SYMBOL = process.env.SYMBOL ?? 'BTCUSDT'
const DRY_RUN = process.env.DRY_RUN === 'true'
const ACCOUNT_BAL = new Decimal(process.env.ACCOUNT_BALANCE_USDT ?? '10000')

export async function POST() {
  try {
    // 1. Load all open signals
    const openSignals = await db.query.signals.findMany({
      where: inArray(signals.status, ['ACTIVE', 'TP1_HIT', 'TP2_HIT']),
    })
    if (openSignals.length === 0) {
      return NextResponse.json({ processed: 0 })
    }

    // 2. Fetch latest 1H candles (for current price)
    const candles = await fetchKlines(SYMBOL, '1h', 50)
    const now = Date.now()
    const closed = candles.filter((c) => c.closeTime.getTime() <= now)
    if (closed.length === 0) return NextResponse.json({ skipped: 'no_closed_bars' })

    const currentBar = closed[closed.length - 1]!

    // 3. Check Entry 2 trigger for ACTIVE signals (before exit eval)
    for (const sig of openSignals) {
      if (sig.status !== 'ACTIVE') continue

      // entry2Trigger is stored as a virtual concept — derive from stored levels
      // entry2Trigger = entryPrice ∓ 1×ATR (already computed at signal creation)
      // We store it implicitly: trigger = entry ∓ entry2AtrOffset × atr
      const entryPrice = new Decimal(sig.entryPrice)
      const atrAtEntry = new Decimal(sig.atrAtEntry)
      const e2Trigger =
        sig.side === 'LONG'
          ? entryPrice.minus(atrAtEntry.times(DEFAULT_CONFIG.entry2AtrOffset))
          : entryPrice.plus(atrAtEntry.times(DEFAULT_CONFIG.entry2AtrOffset))

      const e2Triggered =
        sig.side === 'LONG'
          ? currentBar.low.lessThanOrEqualTo(e2Trigger)
          : currentBar.high.greaterThanOrEqualTo(e2Trigger)

      if (e2Triggered) {
        const e2Sizing = calculatePositionSize({
          accountBalance: ACCOUNT_BAL,
          riskPercent: DEFAULT_CONFIG.entry2RiskPct,
          entry: e2Trigger,
          stopLoss: new Decimal(sig.initialSl),
          tp1: new Decimal(sig.tp1),
          tp2: new Decimal(sig.tp2),
        })

        const newQty = new Decimal(sig.remainingQty).plus(e2Sizing.quantity)

        if (!DRY_RUN) {
          await db
            .update(signals)
            .set({
              remainingQty: newQty.toFixed(8),
              quantity: new Decimal(sig.quantity).plus(e2Sizing.quantity).toFixed(8),
            })
            .where(eq(signals.id, sig.id))

          await db.insert(signalEvents).values({
            signalId: sig.id,
            eventType: 'SIGNAL_CREATED',
            payload: {
              event: 'ENTRY_2_FILLED',
              e2Price: e2Trigger.toFixed(2),
              e2Qty: e2Sizing.quantity.toFixed(5),
            },
          })
        }
      }
    }

    // Reload signals after E2 update
    const freshSignals = await db.query.signals.findMany({
      where: inArray(signals.status, ['ACTIVE', 'TP1_HIT', 'TP2_HIT']),
    })

    // 4. Evaluate exits for each open signal
    let processed = 0
    for (const sig of freshSignals) {
      const decision = evaluateExit({
        side: sig.side as 'LONG' | 'SHORT',
        currentBar,
        entry: new Decimal(sig.entryPrice),
        currentSl: new Decimal(sig.stopLoss),
        tp1: new Decimal(sig.tp1),
        tp2: new Decimal(sig.tp2),
        atrAtEntry: new Decimal(sig.atrAtEntry),
        tp1Hit: sig.status === 'TP1_HIT' || sig.status === 'TP2_HIT',
        tp2Hit: sig.status === 'TP2_HIT',
        trailAnchor: sig.trailAnchor ? new Decimal(sig.trailAnchor) : null,
        config: DEFAULT_CONFIG,
      })

      if (decision.action === 'HOLD') continue
      if (DRY_RUN) {
        console.info(`[DRY_RUN] position-manager ${sig.id}: ${decision.action}`)
        continue
      }

      processed++
      const remainingQty = new Decimal(sig.remainingQty)

      if (decision.action === 'TP1') {
        const qty = new Decimal(sig.quantity)
          .times(DEFAULT_CONFIG.tp1Pct)
          .toDecimalPlaces(5, Decimal.ROUND_DOWN)
        const pnl =
          sig.side === 'LONG'
            ? new Decimal(sig.tp1).minus(sig.entryPrice).times(qty)
            : new Decimal(sig.entryPrice).minus(sig.tp1).times(qty)

        await db.insert(signalFills).values({
          signalId: sig.id,
          type: 'TP1',
          price: sig.tp1,
          quantity: qty.toFixed(8),
          pnl: pnl.toFixed(8),
        })
        await db
          .update(signals)
          .set({
            status: 'TP1_HIT',
            stopLoss: decision.newStopLoss!.toFixed(8),
            remainingQty: remainingQty.minus(qty).toFixed(8),
          })
          .where(eq(signals.id, sig.id))
        await db
          .insert(signalEvents)
          .values({
            signalId: sig.id,
            eventType: 'TP1_HIT',
            payload: { price: sig.tp1, qty: qty.toFixed(5) },
          })
        await sendAlert(sig, 'TP1_HIT')
      } else if (decision.action === 'TP2') {
        const qty = new Decimal(sig.quantity)
          .times(DEFAULT_CONFIG.tp2Pct)
          .toDecimalPlaces(5, Decimal.ROUND_DOWN)
        const pnl =
          sig.side === 'LONG'
            ? new Decimal(sig.tp2).minus(sig.entryPrice).times(qty)
            : new Decimal(sig.entryPrice).minus(sig.tp2).times(qty)

        await db.insert(signalFills).values({
          signalId: sig.id,
          type: 'TP2',
          price: sig.tp2,
          quantity: qty.toFixed(8),
          pnl: pnl.toFixed(8),
        })
        await db
          .update(signals)
          .set({
            status: 'TP2_HIT',
            remainingQty: remainingQty.minus(qty).toFixed(8),
          })
          .where(eq(signals.id, sig.id))
        await db
          .insert(signalEvents)
          .values({
            signalId: sig.id,
            eventType: 'TP2_HIT',
            payload: { price: sig.tp2, qty: qty.toFixed(5) },
          })
        await sendAlert(sig, 'TP2_HIT')
      } else if (decision.action === 'TRAIL_UPDATE') {
        await db
          .update(signals)
          .set({
            stopLoss: decision.newStopLoss!.toFixed(8),
            trailAnchor: decision.newTrailAnchor!.toFixed(8),
          })
          .where(eq(signals.id, sig.id))
        await db.insert(signalEvents).values({
          signalId: sig.id,
          eventType: 'TRAIL_UPDATED',
          payload: {
            newSl: decision.newStopLoss!.toFixed(2),
            anchor: decision.newTrailAnchor!.toFixed(2),
          },
        })
      } else if (decision.action === 'SL') {
        const slPrice = decision.newStopLoss ?? new Decimal(sig.stopLoss)
        const pnl =
          sig.side === 'LONG'
            ? slPrice.minus(sig.entryPrice).times(remainingQty)
            : new Decimal(sig.entryPrice).minus(slPrice).times(remainingQty)

        const totalPnl = (
          await db.query.signalFills.findMany({ where: eq(signalFills.signalId, sig.id) })
        ).reduce((s, f) => s.plus(f.pnl), pnl)

        await db.insert(signalFills).values({
          signalId: sig.id,
          type: 'SL',
          price: slPrice.toFixed(8),
          quantity: remainingQty.toFixed(8),
          pnl: pnl.toFixed(8),
        })
        await db
          .update(signals)
          .set({
            status: 'CLOSED',
            remainingQty: '0',
            closedAt: new Date(),
            realizedPnl: totalPnl.toFixed(8),
          })
          .where(eq(signals.id, sig.id))
        await db
          .insert(signalEvents)
          .values({ signalId: sig.id, eventType: 'SL_HIT', payload: { price: slPrice.toFixed(2) } })
        await db
          .insert(signalEvents)
          .values({
            signalId: sig.id,
            eventType: 'SIGNAL_CLOSED',
            payload: { realizedPnl: totalPnl.toFixed(2) },
          })
        await sendAlert(sig, 'SL_HIT')
      }
    }

    return NextResponse.json({ processed })
  } catch (err) {
    console.error('[position-manager] error:', err)
    await db
      .insert(signalEvents)
      .values({
        eventType: 'FETCH_ERROR',
        payload: { route: 'position-manager', error: String(err) },
      })
      .catch(() => {})
    throw err
  }
}
