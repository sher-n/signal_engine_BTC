/**
 * worker/index.ts
 * node-cron scheduler — runs as a separate process alongside Next.js.
 *
 * Run: yarn worker
 * All schedules are UTC. Calls the same Next.js API routes.
 */

import cron from 'node-cron'

const BASE_URL = process.env.WORKER_BASE_URL ?? 'http://localhost:3000'

async function call(route: string): Promise<void> {
  const url = `${BASE_URL}/api/${route}`
  const res = await fetch(url, { method: 'POST' })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(`[worker] POST ${route} → HTTP ${res.status}: ${JSON.stringify(body)}`)
  }
  console.info(`[worker] POST ${route} → ${JSON.stringify(body)}`)
}

// ── Daily bias — 00:05 UTC (5 min after midnight to ensure bar is closed) ────
cron.schedule(
  '5 0 * * *',
  async () => {
    console.info(`[worker] ${new Date().toISOString()} running bias-1d`)
    await call('bias-1d').catch((err) => console.error(err))
  },
  { timezone: 'UTC' },
)

// ── Hourly signal check — :02 each hour (2 min after bar close) ──────────────
cron.schedule(
  '2 * * * *',
  async () => {
    console.info(`[worker] ${new Date().toISOString()} running signal-1h`)
    await call('signal-1h').catch((err) => console.error(err))
  },
  { timezone: 'UTC' },
)

// ── Position manager — every 5 minutes ───────────────────────────────────────
cron.schedule(
  '*/5 * * * *',
  async () => {
    console.info(`[worker] ${new Date().toISOString()} running position-manager`)
    await call('position-manager').catch((err) => console.error(err))
  },
  { timezone: 'UTC' },
)

console.info('[worker] scheduler started')
console.info('  bias-1d       : 00:05 UTC daily')
console.info('  signal-1h     : :02 every hour')
console.info('  position-mgr  : every 5 min')
