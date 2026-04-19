import { createId } from '@paralleldrive/cuid2'
import {
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  timestamp,
  unique,
  varchar,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ============================================================================
// Enums
// ============================================================================

export const signalSideEnum = pgEnum('signal_side', ['LONG', 'SHORT'])

export const signalStatusEnum = pgEnum('signal_status', [
  'ACTIVE',
  'TP1_HIT',
  'TP2_HIT',
  'CLOSED',
  'CANCELLED',
])

export const fillTypeEnum = pgEnum('fill_type', ['TP1', 'TP2', 'TP3_TRAIL', 'SL', 'BE'])

export const eventTypeEnum = pgEnum('event_type', [
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
])

// ============================================================================
// market_snapshots — OHLCV + computed indicators per bar
// ============================================================================

export const marketSnapshots = pgTable(
  'market_snapshots',
  {
    id: varchar('id', { length: 30 })
      .primaryKey()
      .$defaultFn(() => createId()),
    symbol: varchar('symbol', { length: 20 }).notNull(),
    timeframe: varchar('timeframe', { length: 5 }).notNull(), // '1D' | '1H'
    closedAt: timestamp('closed_at', { withTimezone: true }).notNull(),

    open: numeric('open', { precision: 20, scale: 8 }).notNull(),
    high: numeric('high', { precision: 20, scale: 8 }).notNull(),
    low: numeric('low', { precision: 20, scale: 8 }).notNull(),
    close: numeric('close', { precision: 20, scale: 8 }).notNull(),
    volume: numeric('volume', { precision: 28, scale: 8 }).notNull(),

    sma99: numeric('sma99', { precision: 20, scale: 8 }),
    ema14: numeric('ema14', { precision: 20, scale: 8 }),
    ema60: numeric('ema60', { precision: 20, scale: 8 }),
    atr20: numeric('atr20', { precision: 20, scale: 8 }),

    createdAt: timestamp('created_at').defaultNow(),
  },
  (t) => [
    unique('uq_snapshot').on(t.symbol, t.timeframe, t.closedAt),
    index('idx_snapshot_lookup').on(t.symbol, t.timeframe, t.closedAt),
  ],
)

// ============================================================================
// signals — full trade lifecycle
// ============================================================================

export const signals = pgTable(
  'signals',
  {
    id: varchar('id', { length: 30 })
      .primaryKey()
      .$defaultFn(() => createId()),
    symbol: varchar('symbol', { length: 20 }).notNull(),
    side: signalSideEnum('side').notNull(),
    status: signalStatusEnum('status').notNull().default('ACTIVE'),

    entryPrice: numeric('entry_price', { precision: 20, scale: 8 }).notNull(),
    stopLoss: numeric('stop_loss', { precision: 20, scale: 8 }).notNull(), // moves with BE/trail
    initialSl: numeric('initial_sl', { precision: 20, scale: 8 }).notNull(), // immutable
    tp1: numeric('tp1', { precision: 20, scale: 8 }).notNull(),
    tp2: numeric('tp2', { precision: 20, scale: 8 }).notNull(),
    atrAtEntry: numeric('atr_at_entry', { precision: 20, scale: 8 }).notNull(),
    quantity: numeric('quantity', { precision: 20, scale: 8 }).notNull(), // full position
    remainingQty: numeric('remaining_qty', { precision: 20, scale: 8 }).notNull(), // decreases with TPs

    trailAnchor: numeric('trail_anchor', { precision: 20, scale: 8 }), // set after TP2 hit

    biasSnapshotId: varchar('bias_snapshot_id', { length: 30 }),
    entrySnapshotId: varchar('entry_snapshot_id', { length: 30 }),

    openedAt: timestamp('opened_at').defaultNow(),
    closedAt: timestamp('closed_at'),
    realizedPnl: numeric('realized_pnl', { precision: 20, scale: 8 }),
  },
  (t) => [
    index('idx_signals_status').on(t.symbol, t.status),
    index('idx_signals_opened').on(t.openedAt),
  ],
)

// ============================================================================
// signal_fills — partial closes (TP1, TP2, trail, SL)
// ============================================================================

export const signalFills = pgTable(
  'signal_fills',
  {
    id: varchar('id', { length: 30 })
      .primaryKey()
      .$defaultFn(() => createId()),
    signalId: varchar('signal_id', { length: 30 })
      .notNull()
      .references(() => signals.id),
    type: fillTypeEnum('type').notNull(),
    price: numeric('price', { precision: 20, scale: 8 }).notNull(),
    quantity: numeric('quantity', { precision: 20, scale: 8 }).notNull(),
    pnl: numeric('pnl', { precision: 20, scale: 8 }).notNull(),
    filledAt: timestamp('filled_at').defaultNow(),
  },
  (t) => [index('idx_fills_signal').on(t.signalId)],
)

// ============================================================================
// signal_events — audit log for everything
// ============================================================================

export const signalEvents = pgTable(
  'signal_events',
  {
    id: varchar('id', { length: 30 })
      .primaryKey()
      .$defaultFn(() => createId()),
    signalId: varchar('signal_id', { length: 30 }).references(() => signals.id),
    eventType: eventTypeEnum('event_type').notNull(),
    payload: jsonb('payload').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
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
