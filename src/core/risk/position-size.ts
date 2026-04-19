import Decimal from 'decimal.js'
import type { PositionSize } from '../types'

const BTC_DECIMALS = 5

/**
 * Fixed fractional position sizing — 1% risk per trade
 *
 * riskAmount   = accountBalance × (riskPercent / 100)
 * stopDistance = |entry - stopLoss|
 * quantity     = riskAmount / stopDistance  (rounded to 5 decimal places for BTC)
 * notional     = quantity × entry
 */
export function calculatePositionSize(params: {
  accountBalance: Decimal
  riskPercent: Decimal
  entry: Decimal
  stopLoss: Decimal
  tp1: Decimal
  tp2: Decimal
}): PositionSize {
  const { accountBalance, riskPercent, entry, stopLoss, tp1, tp2 } = params

  const riskAmount = accountBalance.times(riskPercent.dividedBy(100))
  const stopDistance = entry.minus(stopLoss).abs()

  if (stopDistance.isZero()) {
    throw new Error('Stop distance cannot be zero — entry and stopLoss are equal')
  }

  const quantity = riskAmount
    .dividedBy(stopDistance)
    .toDecimalPlaces(BTC_DECIMALS, Decimal.ROUND_DOWN)
  const notional = quantity.times(entry)
  const rrToTp1 = tp1.minus(entry).abs().dividedBy(stopDistance)
  const rrToTp2 = tp2.minus(entry).abs().dividedBy(stopDistance)

  return { quantity, notional, riskUsd: riskAmount, rrToTp1, rrToTp2 }
}
