import Decimal from 'decimal.js'

/**
 * Simple Moving Average
 * Returns array same length as input.
 * First (period-1) values are undefined — caller must guard.
 */
export function sma(values: Decimal[], period: number): (Decimal | undefined)[] {
  if (period < 1) throw new Error(`SMA period must be >= 1, got ${period}`)

  const result: (Decimal | undefined)[] = new Array(values.length).fill(undefined)

  for (let i = period - 1; i < values.length; i++) {
    let sum = new Decimal(0)
    for (let j = i - period + 1; j <= i; j++) {
      sum = sum.plus(values[j]!)
    }
    result[i] = sum.dividedBy(period)
  }

  return result
}
