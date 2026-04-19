import { db } from '../db'
import { signalEvents } from '../db/schema'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const CHAT_ID = process.env.TELEGRAM_CHAT_ID!
const BASE = `https://api.telegram.org/bot${BOT_TOKEN}`

function esc(s: string): string {
  return s.replace(/[_*[\]()~`>#+=|{}.!\\-]/g, (c) => `\\${c}`)
}

export async function sendMessage(text: string): Promise<void> {
  const res = await fetch(`${BASE}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'MarkdownV2' }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`[telegram] HTTP ${res.status}: ${body}`)
  }
}

export interface AlertSignal {
  id: string
  side: 'LONG' | 'SHORT'
  entryPrice: string
  stopLoss: string
  tp1: string
  tp2: string
  atrAtEntry: string
}

export async function sendAlert(
  signal: AlertSignal,
  eventType: 'SIGNAL_CREATED' | 'TP1_HIT' | 'TP2_HIT' | 'SL_HIT' | 'SIGNAL_CLOSED',
): Promise<void> {
  const side = signal.side === 'LONG' ? '🟢 LONG' : '🔴 SHORT'
  const entry = parseFloat(signal.entryPrice).toFixed(2)
  const sl = parseFloat(signal.stopLoss).toFixed(2)
  const tp1 = parseFloat(signal.tp1).toFixed(2)
  const tp2 = parseFloat(signal.tp2).toFixed(2)
  const atr = parseFloat(signal.atrAtEntry).toFixed(2)

  const slDist = Math.abs(parseFloat(signal.entryPrice) - parseFloat(signal.stopLoss))
  const rr1 = (Math.abs(parseFloat(signal.tp1) - parseFloat(signal.entryPrice)) / slDist).toFixed(2)
  const rr2 = (Math.abs(parseFloat(signal.tp2) - parseFloat(signal.entryPrice)) / slDist).toFixed(2)

  const labels: Record<typeof eventType, string> = {
    SIGNAL_CREATED: '🚨 NEW SIGNAL',
    TP1_HIT: '✅ TP1 HIT',
    TP2_HIT: '✅ TP2 HIT',
    SL_HIT: '❌ SL HIT',
    SIGNAL_CLOSED: '🏁 CLOSED',
  }

  const text =
    `*${esc(labels[eventType])}* \\— ${esc(side)}\n` +
    `\`Entry  ${esc(entry)}\`\n` +
    `\`SL     ${esc(sl)}\`\n` +
    `\`TP1    ${esc(tp1)}  \\(${esc(rr1)}R\\)\`\n` +
    `\`TP2    ${esc(tp2)}  \\(${esc(rr2)}R\\)\`\n` +
    `\`ATR    ${esc(atr)}\`\n` +
    `ID: \`${esc(signal.id)}\``

  try {
    await sendMessage(text)
    await db.insert(signalEvents).values({
      signalId: signal.id,
      eventType: 'ALERT_SENT',
      payload: { eventType },
    })
  } catch (err) {
    console.error('[telegram] sendAlert failed:', err)
    await db.insert(signalEvents).values({
      signalId: signal.id,
      eventType: 'ALERT_FAILED',
      payload: { error: String(err), eventType },
    })
    // don't re-throw — alert failure must not kill the trade flow
  }
}
