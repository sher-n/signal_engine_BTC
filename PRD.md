# Product Requirements Document

# BTC Signal Engine — v1.0

**Owner**: Solo operator
**Created**: 2026-04-19
**Status**: Active development

---

## 1. Problem Statement

Manual BTC trading requires constant monitoring. Missed entries during sleep or distraction
result in lost opportunities. Emotional decisions override systematic rules. There is no
persistent record of why trades were taken or skipped, and no visual way to review performance.

## 2. Goal

Build an automated signal engine + dashboard that:

- Monitors BTC/USDT 24/7 via a background worker
- Executes the LOOSE-3 strategy with mathematical precision
- Alerts the operator via Telegram the moment a signal triggers
- Provides a local-first dashboard for reviewing signal history and performance

**Not a goal (v1)**: Live order execution. Signal + alert + dashboard only.

---

## 3. Users

| User                   | Need                                             |
| ---------------------- | ------------------------------------------------ |
| Solo trader (operator) | Receive timely Telegram alerts, review dashboard |
| Operator (analyst)     | Query signal history, fills, PnL, equity curve   |

---

## 4. Strategy: LOOSE-3 Preset

### 4.1 Core 1 — Bias Filter (1D)

| Condition                  | Bias                |
| -------------------------- | ------------------- |
| Daily close > SMA99 × 1.01 | LONG_ONLY           |
| Daily close < SMA99 × 0.99 | SHORT_ONLY          |
| Between bands              | NEUTRAL — no trades |

### 4.2 Core 2 — Momentum Confirm (1H)

- **Bullish**: EMA14 > EMA60 AND slope(EMA14, 3 bars) > 0
- **Bearish**: EMA14 < EMA60 AND slope(EMA14, 3 bars) < 0

### 4.3 Core 3 — Entry Signal (1H, closed bar)

**LONG** (all must be true): Bias=LONG_ONLY, Momentum=BULLISH, bar.low ≤ EMA14, bar.close > EMA14, bar.close > bar.open

**SHORT** (mirror): Bias=SHORT_ONLY, Momentum=BEARISH, bar.high ≥ EMA14, bar.close < EMA14, bar.close < bar.open

### 4.4 Core 4 — Exit Management

| Level | Calculation      | Action                          |
| ----- | ---------------- | ------------------------------- |
| SL    | entry ± 1.5×ATR  | Close 100% remaining            |
| TP1   | entry ± 1.5×ATR  | Close 40%, move SL to breakeven |
| TP2   | entry ± 3.0×ATR  | Close 30%, start trailing       |
| Trail | anchor ∓ 2.0×ATR | Close remaining 30%             |

### 4.5 Position Sizing

```
riskAmount   = accountBalance × 0.01
stopDistance = |entry - stopLoss|
quantity     = riskAmount / stopDistance  (5 decimal places)
```

---

## 5. System Architecture

```
┌─────────────────────────────────────────────────────┐
│  Worker Process (node-cron)                          │
│  ├── :00 every 1H  → POST /api/signal-1h            │
│  ├── 00:00 UTC/day → POST /api/bias-1d              │
│  └── every 5min    → POST /api/position-manager     │
└─────────────────────┬───────────────────────────────┘
                      │ HTTP (local)
┌─────────────────────▼───────────────────────────────┐
│  Next.js App (yarn dev)                              │
│  ├── API Routes  ← orchestrate core logic            │
│  └── Dashboard   ← read from Postgres                │
└─────────────────────┬───────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
  [src/core]    [PostgreSQL]    [Redis]
  pure logic    signals/fills   bias cache
                events/snaps
                      │
                      ▼
               [Telegram Bot]
               alerts to operator
```

---

## 6. Tech Stack

| Layer           | Technology                 |
| --------------- | -------------------------- |
| Framework       | Next.js 14+ (App Router)   |
| Language        | TypeScript strict mode     |
| Package manager | yarn                       |
| ORM             | Drizzle ORM                |
| Database        | PostgreSQL 16              |
| Cache           | Redis                      |
| Market data     | Binance REST API (public)  |
| Alerts          | Telegram Bot API           |
| Decimal math    | decimal.js                 |
| Testing         | Vitest                     |
| Linting         | ESLint + Prettier          |
| Scheduling      | node-cron (worker process) |

---

## 7. Database Schema (Drizzle)

```typescript
// src/db/schema.ts

// market_snapshots — OHLCV + computed indicators per bar
export const marketSnapshots = pgTable(
  'market_snapshots',
  {
    id: varchar('id')
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
    unique().on(t.symbol, t.timeframe, t.closedAt),
    index().on(t.symbol, t.timeframe, desc(t.closedAt)),
  ],
)

// signals — full trade lifecycle
export const signalSideEnum = pgEnum('signal_side', ['LONG', 'SHORT'])
export const signalStatusEnum = pgEnum('signal_status', [
  'ACTIVE',
  'TP1_HIT',
  'TP2_HIT',
  'CLOSED',
  'CANCELLED',
])

export const signals = pgTable(
  'signals',
  {
    id: varchar('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    symbol: varchar('symbol', { length: 20 }).notNull(),
    side: signalSideEnum('side').notNull(),
    status: signalStatusEnum('status').notNull().default('ACTIVE'),
    entryPrice: numeric('entry_price', { precision: 20, scale: 8 }).notNull(),
    stopLoss: numeric('stop_loss', { precision: 20, scale: 8 }).notNull(),
    initialSl: numeric('initial_sl', { precision: 20, scale: 8 }).notNull(),
    tp1: numeric('tp1', { precision: 20, scale: 8 }).notNull(),
    tp2: numeric('tp2', { precision: 20, scale: 8 }).notNull(),
    atrAtEntry: numeric('atr_at_entry', { precision: 20, scale: 8 }).notNull(),
    quantity: numeric('quantity', { precision: 20, scale: 8 }).notNull(),
    remainingQty: numeric('remaining_qty', { precision: 20, scale: 8 }).notNull(),
    trailAnchor: numeric('trail_anchor', { precision: 20, scale: 8 }),
    openedAt: timestamp('opened_at').defaultNow(),
    closedAt: timestamp('closed_at'),
    realizedPnl: numeric('realized_pnl', { precision: 20, scale: 8 }),
  },
  (t) => [index().on(t.symbol, t.status), index().on(desc(t.openedAt))],
)

// signal_fills — partial closes (TP1, TP2, SL, trail)
export const fillTypeEnum = pgEnum('fill_type', ['TP1', 'TP2', 'TP3_TRAIL', 'SL', 'BE'])

export const signalFills = pgTable(
  'signal_fills',
  {
    id: varchar('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    signalId: varchar('signal_id')
      .notNull()
      .references(() => signals.id),
    type: fillTypeEnum('type').notNull(),
    price: numeric('price', { precision: 20, scale: 8 }).notNull(),
    quantity: numeric('quantity', { precision: 20, scale: 8 }).notNull(),
    pnl: numeric('pnl', { precision: 20, scale: 8 }).notNull(),
    filledAt: timestamp('filled_at').defaultNow(),
  },
  (t) => [index().on(t.signalId)],
)

// signal_events — audit log for everything
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

export const signalEvents = pgTable(
  'signal_events',
  {
    id: varchar('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    signalId: varchar('signal_id').references(() => signals.id),
    eventType: eventTypeEnum('event_type').notNull(),
    payload: jsonb('payload').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (t) => [index().on(t.signalId, t.createdAt), index().on(t.eventType, desc(t.createdAt))],
)
```

---

## 8. Dashboard Pages

| Route           | Content                                                |
| --------------- | ------------------------------------------------------ |
| `/`             | Equity curve chart, current open signal, today's stats |
| `/signals`      | Table: all signals with status, entry, SL, TPs, PnL    |
| `/signals/[id]` | Signal detail: fills timeline, events log, R:R         |

**Stack**: Next.js App Router, React Server Components, Tailwind CSS, Recharts (charts)

---

## 9. Functional Requirements

- **FR-01** Market data: Binance 1H/1D klines, closed bars only, retry on 429/5xx
- **FR-02** Indicators: SMA99, EMA14, EMA60, ATR20 — all `Decimal`, match TradingView ±0.01%
- **FR-03** Signal generation: 1 active signal per symbol, log every evaluation
- **FR-04** Exit management: check every 5min, update trail, record fills
- **FR-05** Telegram alerts: all signal lifecycle events, `[DRY_RUN]` tag when enabled
- **FR-06** Persistence: Drizzle + Postgres, full audit trail
- **FR-07** Dry-run mode: compute + alert + log but do NOT persist Signal row

---

## 10. Backtest Gate (Phase 3 — must pass before Phase 4)

| Metric        | Minimum             |
| ------------- | ------------------- |
| Total trades  | > 50                |
| Profit Factor | > 1.3               |
| Max Drawdown  | < 25%               |
| Win Rate      | > 40%               |
| Data          | 2 years BTC/USDT 1H |

---

## 11. Out of Scope (v1)

- Live order execution
- Multi-symbol
- Mobile app
- Auth/multi-user dashboard

---

## 12. Success Criteria

1. `yarn test` passes with zero failures
2. Indicator output matches TradingView within 0.01%
3. Backtest passes Phase 3 gate
4. Dashboard loads signal history and equity curve correctly
5. Telegram alert arrives within 60s of signal trigger
6. Every signal has complete audit trail in Postgres
