/**
 * loader.ts
 * Parse raw Binance kline JSON into Candle[]
 */

import Decimal from 'decimal.js'
import fs from 'fs'
import path from 'path'
import type { Candle } from '../src/core/types'
import type { RawKline } from './types'

export function loadCandles(filename: string): Candle[] {
  const filepath = path.join(process.cwd(), 'data', filename)
  if (!fs.existsSync(filepath)) {
    throw new Error(`Data file not found: ${filepath}\nRun "yarn seed-history" first.`)
  }

  const raw: RawKline[] = JSON.parse(fs.readFileSync(filepath, 'utf-8')) as RawKline[]

  return raw.map((r) => ({
    openTime: new Date(r.openTime),
    closeTime: new Date(r.closeTime),
    open: new Decimal(r.open),
    high: new Decimal(r.high),
    low: new Decimal(r.low),
    close: new Decimal(r.close),
    volume: new Decimal(r.volume),
  }))
}
