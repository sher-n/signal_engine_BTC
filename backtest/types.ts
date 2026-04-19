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
  entry: Decimal
  stopLoss: Decimal
  initialSl: Decimal
  tp1: Decimal
  tp2: Decimal
  atrAtEntry: Decimal
  quantity: Decimal // full position
  remainingQty: Decimal
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
