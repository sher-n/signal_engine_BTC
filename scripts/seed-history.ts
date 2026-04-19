/**
 * seed-history.ts
 * Fetch 2 years of BTC/USDT 1H + 1D klines from Binance public API.
 * Saves to data/btcusdt_1h.json and data/btcusdt_1d.json
 *
 * Run: yarn seed-history
 */

import fs from 'fs'
import path from 'path'

const BINANCE_BASE = 'https://api.binance.com'
const SYMBOL = 'BTCUSDT'
const DATA_DIR = path.join(process.cwd(), 'data')

interface RawKline {
  openTime: number
  open: string
  high: string
  low: string
  close: string
  volume: string
  closeTime: number
}

/** Fetch one page of klines (max 1000 bars) */
async function fetchPage(
  interval: string,
  startTime: number,
  endTime: number,
): Promise<RawKline[]> {
  const url =
    `${BINANCE_BASE}/api/v3/klines` +
    `?symbol=${SYMBOL}&interval=${interval}&startTime=${startTime}&endTime=${endTime}&limit=1000`

  let attempt = 0
  while (attempt < 3) {
    try {
      const res = await fetch(url)
      if (res.status === 429 || res.status >= 500) {
        const wait = Math.pow(2, attempt) * 1000
        console.warn(`  HTTP ${res.status} — retrying in ${wait}ms`)
        await new Promise((r) => setTimeout(r, wait))
        attempt++
        continue
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const raw = (await res.json()) as unknown[][]
      return raw.map((r) => ({
        openTime: r[0] as number,
        open: r[1] as string,
        high: r[2] as string,
        low: r[3] as string,
        close: r[4] as string,
        volume: r[5] as string,
        closeTime: r[6] as number,
      }))
    } catch (err) {
      attempt++
      if (attempt >= 3) throw err
      await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000))
    }
  }
  return []
}

/** Paginate forward from startMs to endMs, fetching all bars */
async function fetchAll(interval: string, startMs: number, endMs: number): Promise<RawKline[]> {
  const all: RawKline[] = []
  let cursor = startMs

  while (cursor < endMs) {
    const page = await fetchPage(interval, cursor, endMs)
    if (page.length === 0) break

    all.push(...page)
    const last = page[page.length - 1]!
    cursor = last.closeTime + 1

    const pct = (((cursor - startMs) / (endMs - startMs)) * 100).toFixed(1)
    console.info(`  [${interval}] ${page.length} bars fetched, total ${all.length} (${pct}%)`)

    if (page.length < 1000) break // last page
    await new Promise((r) => setTimeout(r, 120)) // gentle rate limit
  }

  return all
}

async function main() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

  const endMs = Date.now()
  const startMs = endMs - 2 * 365 * 24 * 60 * 60 * 1000 // 2 years ago

  const startDate = new Date(startMs).toISOString().slice(0, 10)
  const endDate = new Date(endMs).toISOString().slice(0, 10)
  console.info(`Fetching ${SYMBOL} from ${startDate} → ${endDate}`)

  // ── 1H ────────────────────────────────────────────────────────────────────
  console.info('\n[1/2] Fetching 1H klines...')
  const klines1h = await fetchAll('1h', startMs, endMs)
  const out1h = path.join(DATA_DIR, 'btcusdt_1h.json')
  fs.writeFileSync(out1h, JSON.stringify(klines1h, null, 0))
  console.info(`  ✓ Saved ${klines1h.length} bars → ${out1h}`)

  // ── 1D ────────────────────────────────────────────────────────────────────
  console.info('\n[2/2] Fetching 1D klines...')
  const klines1d = await fetchAll('1d', startMs, endMs)
  const out1d = path.join(DATA_DIR, 'btcusdt_1d.json')
  fs.writeFileSync(out1d, JSON.stringify(klines1d, null, 0))
  console.info(`  ✓ Saved ${klines1d.length} bars → ${out1d}`)

  console.info('\n✅ Seed complete.')
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
