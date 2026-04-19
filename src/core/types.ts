import Decimal from 'decimal.js'

// ============================================================================
// Market data
// ============================================================================

export interface Candle {
  openTime: Date
  closeTime: Date
  open: Decimal
  high: Decimal
  low: Decimal
  close: Decimal
  volume: Decimal
}

// ============================================================================
// Strategy signals
// ============================================================================

export type Bias = 'LONG_ONLY' | 'SHORT_ONLY' | 'NEUTRAL'
export type Momentum = 'BULLISH' | 'BEARISH' | 'FLAT'
export type Side = 'LONG' | 'SHORT'

// ============================================================================
// Computed indicators (for a single bar)
// ============================================================================

export interface IndicatorSet {
  sma99?: Decimal
  ema14?: Decimal
  ema60?: Decimal
  ema14Prev3?: Decimal // EMA14 value 3 bars ago — used for slope
  atr20?: Decimal
}

// ============================================================================
// Entry signal output
// ============================================================================

export interface EntrySignal {
  side: Side
  entry: Decimal // = close price of triggering bar
  stopLoss: Decimal // entry ± 1.5 × ATR
  tp1: Decimal // entry ± 1.5 × ATR
  tp2: Decimal // entry ± 3.0 × ATR
  atrAtEntry: Decimal // snapshot of ATR at entry — used for all exit calcs
}

// ============================================================================
// Position size output
// ============================================================================

export interface PositionSize {
  quantity: Decimal // BTC quantity (5 decimal places)
  notional: Decimal // quantity × entry
  riskUsd: Decimal // actual risk amount in USDT
  rrToTp1: Decimal // R:R to TP1
  rrToTp2: Decimal // R:R to TP2
}

// ============================================================================
// Exit decision (stateless — caller manages state)
// ============================================================================

export type ExitAction = 'HOLD' | 'TP1' | 'TP2' | 'SL' | 'TRAIL_UPDATE'

export interface ExitDecision {
  action: ExitAction
  newStopLoss?: Decimal // set on TP1 (BE) or TRAIL_UPDATE
  newTrailAnchor?: Decimal // set when trail anchor moves
}

// ============================================================================
// Strategy configuration
// ============================================================================

export interface StrategyConfig {
  pullbackAtrMult: Decimal // 0.3 — pullback zone width
  slopeBars: number // 3   — EMA14 slope lookback period
  neutralPct: Decimal // 0.01 — ±1% SMA99 band for NEUTRAL bias
  slMult: Decimal // 1.5 — SL distance in ATR multiples
  tp1Mult: Decimal // 1.5 — TP1 distance
  tp2Mult: Decimal // 3.0 — TP2 distance
  trailMult: Decimal // 2.0 — trail stop distance from anchor
  tp1Pct: Decimal // 0.40 — 40% of position closed at TP1
  tp2Pct: Decimal // 0.30 — 30% of position closed at TP2
  // remaining 30% is trailed
}

/** LOOSE-3 preset — default production config */
export const DEFAULT_CONFIG: StrategyConfig = {
  pullbackAtrMult: new Decimal('0.3'),
  slopeBars: 3,
  neutralPct: new Decimal('0.01'),
  slMult: new Decimal('1.5'),
  tp1Mult: new Decimal('1.5'),
  tp2Mult: new Decimal('3.0'),
  trailMult: new Decimal('2.0'),
  tp1Pct: new Decimal('0.4'),
  tp2Pct: new Decimal('0.3'),
}
