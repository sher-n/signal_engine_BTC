import Decimal from 'decimal.js'
import { z } from 'zod'
import type { Candle } from '../core/types'

const BASE = process.env.BINANCE_BASE_URL ?? 'https://api.binance.com'

const KlineRow = z.tuple([
  z.number(), // 0 openTime
  z.string(), // 1 open
  z.string(), // 2 high
  z.string(), // 3 low
  z.string(), // 4 close
  z.string(), // 5 volume
  z.number(), // 6 closeTime
  z.string(), // 7 quoteVolume (ignored)
  z.number(), // 8 trades (ignored)
  z.string(), // 9 takerBase (ignored)
  z.string(), // 10 takerQuote (ignored)
  z.string(), // 11 ignore
])

const KlineResponse = z.array(KlineRow)

export async function fetchKlines(
  symbol: string,
  interval: string,
  limit: number,
  endTime?: number,
): Promise<Candle[]> {
  const params = new URLSearchParams({
    symbol,
    interval,
    limit: String(limit),
    ...(endTime ? { endTime: String(endTime) } : {}),
  })

  let attempt = 0
  while (attempt < 3) {
    try {
      const res = await fetch(`${BASE}/api/v3/klines?${params}`)

      if (res.status === 429 || res.status >= 500) {
        const wait = Math.pow(2, attempt) * 1000
        console.warn(`[binance] HTTP ${res.status} — retry in ${wait}ms`)
        await new Promise((r) => setTimeout(r, wait))
        attempt++
        continue
      }

      if (!res.ok) throw new Error(`[binance] HTTP ${res.status} ${res.statusText}`)

      const raw = await res.json()
      const parsed = KlineResponse.parse(raw)

      return parsed.map((r) => ({
        openTime: new Date(r[0]),
        closeTime: new Date(r[6]),
        open: new Decimal(r[1]),
        high: new Decimal(r[2]),
        low: new Decimal(r[3]),
        close: new Decimal(r[4]),
        volume: new Decimal(r[5]),
      }))
    } catch (err) {
      attempt++
      if (attempt >= 3) throw err
      await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000))
    }
  }

  throw new Error('[binance] fetchKlines exhausted retries')
}
