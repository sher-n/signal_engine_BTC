import Decimal from 'decimal.js'
import type { Side } from '../src/core/types'

export interface RawKline {
  openTime: number
  open: string
  high: string
  low: string
  close: string
  volume: string
  closeTime: number
}

export interface PartialExit {
  price: Decimal
  qty: Decimal
  pnl: Decimal
  reason: 'TP1' | 'TP2' | 'SL' | 'TRAIL' | 'END_OF_DATA'
  closedAt: Date
}

export interface ClosedTrade {
  id: number
  side: Side
  entry: Decimal
  initialSl: Decimal
  tp1: Decimal
  tp2: Decimal
  atrAtEntry: Decimal
  quantity: Decimal
  totalPnl: Decimal // sum of all partial exits
  rMultiple: Decimal // totalPnl / initialRiskUsd
  winLoss: 'WIN' | 'LOSS' | 'BREAKEVEN'
  openedAt: Date
  closedAt: Date
  barsHeld: number
  partialExits: PartialExit[]
}

export interface BacktestPosition {
  id: number
  side: Side
  entry: Decimal // weighted avg entry (updates after E2 fill)
  entry1Price: Decimal // E1 fill price (immutable, for display)
  stopLoss: Decimal
  initialSl: Decimal
  tp1: Decimal
  tp2: Decimal
  atrAtEntry: Decimal
  quantity: Decimal // total position (grows after E2 fill)
  remainingQty: Decimal
  totalInitialRisk: Decimal // E1 risk + E2 risk in USDT (for R-multiple)
  // Split entry
  entry2Pending: boolean // true until E2 fires or SL hit
  entry2Trigger: Decimal
  entry2Filled: boolean
  entry2Price: Decimal | null
  // Tracking
  tp1Hit: boolean
  tp2Hit: boolean
  trailAnchor: Decimal | null
  openedAt: Date
  openBarIndex: number
  partialExits: PartialExit[]
}

export interface BacktestResult {
  trades: ClosedTrade[]
  equityCurve: { date: Date; equity: Decimal }[]
  initialEquity: Decimal
  finalEquity: Decimal
}
