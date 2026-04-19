import { createId } from '@paralleldrive/cuid2'
import { index, integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'

// ============================================================================
// market_snapshots — OHLCV + computed indicators per bar
// ============================================================================

export const marketSnapshots = sqliteTable(
  'market_snapshots',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    symbol: text('symbol').notNull(),
    timeframe: text('timeframe').notNull(), // '1D' | '1H'
    closedAt: integer('closed_at', { mode: 'timestamp_ms' }).notNull(),

    open: text('open').notNull(),
    high: text('high').notNull(),
    low: text('low').notNull(),
    close: text('close').notNull(),
    volume: text('volume').notNull(),

    sma99: text('sma99'),
    ema14: text('ema14'),
    ema60: text('ema60'),
    atr20: text('atr20'),

    createdAt: integer('created_at', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
  },
  (t) => [
    unique('uq_snapshot').on(t.symbol, t.timeframe, t.closedAt),
    index('idx_snapshot_lookup').on(t.symbol, t.timeframe, t.closedAt),
  ],
)

// ============================================================================
// signals — full trade lifecycle
// ============================================================================

export const signals = sqliteTable(
  'signals',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    symbol: text('symbol').notNull(),
    side: text('side', { enum: ['LONG', 'SHORT'] }).notNull(),
    status: text('status', { enum: ['ACTIVE', 'TP1_HIT', 'TP2_HIT', 'CLOSED', 'CANCELLED'] })
      .notNull()
      .default('ACTIVE'),

    entryPrice: text('entry_price').notNull(),
    stopLoss: text('stop_loss').notNull(), // current SL (moves with BE/trail)
    initialSl: text('initial_sl').notNull(), // immutable
    tp1: text('tp1').notNull(),
    tp2: text('tp2').notNull(),
    atrAtEntry: text('atr_at_entry').notNull(),
    quantity: text('quantity').notNull(),
    remainingQty: text('remaining_qty').notNull(),

    trailAnchor: text('trail_anchor'),

    biasSnapshotId: text('bias_snapshot_id'),
    entrySnapshotId: text('entry_snapshot_id'),

    openedAt: integer('opened_at', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
    closedAt: integer('closed_at', { mode: 'timestamp_ms' }),
    realizedPnl: text('realized_pnl'),
  },
  (t) => [
    index('idx_signals_status').on(t.symbol, t.status),
    index('idx_signals_opened').on(t.openedAt),
  ],
)

// ============================================================================
// signal_fills — partial closes
// ============================================================================

export const signalFills = sqliteTable(
  'signal_fills',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    signalId: text('signal_id')
      .notNull()
      .references(() => signals.id),
    type: text('type', { enum: ['TP1', 'TP2', 'TP3_TRAIL', 'SL', 'BE'] }).notNull(),
    price: text('price').notNull(),
    quantity: text('quantity').notNull(),
    pnl: text('pnl').notNull(),
    filledAt: integer('filled_at', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
  },
  (t) => [index('idx_fills_signal').on(t.signalId)],
)

// ============================================================================
// signal_events — audit log
// ============================================================================

export const signalEvents = sqliteTable(
  'signal_events',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    signalId: text('signal_id').references(() => signals.id),
    eventType: text('event_type', {
      enum: [
        'SIGNAL_CREATED',
        'ENTRY_SKIPPED',
        'TP1_HIT',
        'TP2_HIT',
        'SL_HIT',
        'TRAIL_UPDATED',
        'SIGNAL_CLOSED',
        'BIAS_UPDATED',
        'FETCH_ERROR',
        'ALERT_SENT',
        'ALERT_FAILED',
      ],
    }).notNull(),
    payload: text('payload', { mode: 'json' }).notNull().$type<Record<string, unknown>>(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
  },
  (t) => [
    index('idx_events_signal').on(t.signalId, t.createdAt),
    index('idx_events_type').on(t.eventType, t.createdAt),
  ],
)

// ============================================================================
// Relations
// ============================================================================

export const signalsRelations = relations(signals, ({ many }) => ({
  fills: many(signalFills),
  events: many(signalEvents),
}))

export const signalFillsRelations = relations(signalFills, ({ one }) => ({
  signal: one(signals, { fields: [signalFills.signalId], references: [signals.id] }),
}))

export const signalEventsRelations = relations(signalEvents, ({ one }) => ({
  signal: one(signals, { fields: [signalEvents.signalId], references: [signals.id] }),
}))
