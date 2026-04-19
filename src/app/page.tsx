'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { StatCard } from '../components/StatCard'
import { fmtDate, fmtPrice, fmtPnl, fmtPct, pnlColor } from '../lib/format'

const REFRESH_MS = 10 * 60 * 1000

interface DashboardData {
  stats: {
    netPnl: number
    returnPct: number
    totalTrades: number
    winRate: number
    profitFactor: number | null
    maxDrawdown: number
    openCount: number
  }
  equityCurve: { date: string; equity: number }[]
  openPositions: {
    id: string
    side: 'LONG' | 'SHORT'
    status: string
    entryPrice: string
    stopLoss: string
    tp1: string
    tp2: string
    quantity: string
    remainingQty: string
    openedAt: number | null
  }[]
}

function SideChip({ side }: { side: 'LONG' | 'SHORT' }) {
  const bg = side === 'LONG' ? 'var(--color-long-dim)' : 'var(--color-short-dim)'
  const col = side === 'LONG' ? 'var(--color-win)' : 'var(--color-loss)'
  return (
    <span
      style={{
        background: bg,
        color: col,
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '11px',
        fontWeight: 700,
      }}
    >
      {side}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ACTIVE: 'var(--color-muted)',
    TP1_HIT: '#facc15',
    TP2_HIT: '#f97316',
  }
  return (
    <span style={{ color: colors[status] ?? 'var(--color-muted)', fontSize: '12px' }}>
      {status.replace('_', ' ')}
    </span>
  )
}

const tdR: React.CSSProperties = {
  padding: '10px 16px',
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
}
const tdL: React.CSSProperties = { padding: '10px 16px', textAlign: 'left' }
const thR: React.CSSProperties = {
  padding: '8px 16px',
  textAlign: 'right',
  fontWeight: 500,
  color: 'var(--color-subtle)',
  whiteSpace: 'nowrap',
}
const thL: React.CSSProperties = {
  padding: '8px 16px',
  textAlign: 'left',
  fontWeight: 500,
  color: 'var(--color-subtle)',
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [lastRefresh, setLast] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard')
      if (res.ok) {
        setData(await res.json())
        setLast(new Date())
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const id = setInterval(fetchData, REFRESH_MS)
    return () => clearInterval(id)
  }, [fetchData])

  if (loading)
    return (
      <div style={{ paddingTop: '64px', textAlign: 'center', color: 'var(--color-muted)' }}>
        Loading…
      </div>
    )

  const s = data?.stats

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 600 }}>Dashboard</h1>
        <span style={{ fontSize: '12px', color: 'var(--color-subtle)' }}>
          {lastRefresh ? fmtDate(lastRefresh.toISOString()) : '—'} · auto 10 min
        </span>
      </div>

      {/* Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: '12px',
        }}
      >
        <StatCard
          label="Net PnL"
          value={fmtPnl(s?.netPnl)}
          sub={fmtPct(s?.returnPct) + ' return'}
          color={pnlColor(s?.netPnl)}
        />
        <StatCard label="Total Trades" value={String(s?.totalTrades ?? 0)} />
        <StatCard label="Win Rate" value={s?.winRate != null ? `${s.winRate.toFixed(1)}%` : '—'} />
        <StatCard
          label="Profit Factor"
          value={s?.profitFactor != null ? s.profitFactor.toFixed(2) : '—'}
        />
        <StatCard
          label="Max Drawdown"
          value={s?.maxDrawdown != null ? `${s.maxDrawdown.toFixed(1)}%` : '—'}
          color="var(--color-loss)"
        />
        <StatCard
          label="Open Positions"
          value={String(s?.openCount ?? 0)}
          color="var(--color-primary)"
        />
      </div>

      {/* Equity Curve */}
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '8px',
          padding: '20px',
        }}
      >
        <p
          style={{
            fontSize: '12px',
            color: 'var(--color-muted)',
            marginBottom: '16px',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          Equity Curve
        </p>
        {(data?.equityCurve?.length ?? 0) < 2 ? (
          <p style={{ color: 'var(--color-subtle)', fontSize: '13px' }}>No closed trades yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data!.equityCurve} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <XAxis
                dataKey="date"
                tickFormatter={(v) =>
                  new Date(v).toLocaleDateString('th-TH', {
                    timeZone: 'Asia/Bangkok',
                    month: 'short',
                    day: 'numeric',
                  })
                }
                tick={{ fill: 'var(--color-subtle)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: 'var(--color-subtle)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `$${v.toFixed(0)}`}
                width={64}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '6px',
                  fontSize: '12px',
                }}
                labelStyle={{ color: 'var(--color-muted)' }}
                labelFormatter={(v) => fmtDate(v as string)}
                formatter={(v: number) => [`$${v.toFixed(2)}`, 'Equity']}
              />
              <ReferenceLine y={10000} stroke="var(--color-border)" strokeDasharray="4 4" />
              <Line
                type="monotone"
                dataKey="equity"
                stroke="var(--color-primary)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: 'var(--color-primary)' }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Open Positions */}
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <p
            style={{
              fontSize: '12px',
              color: 'var(--color-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            Open Positions
          </p>
          <span style={{ fontSize: '12px', color: 'var(--color-primary)', fontWeight: 700 }}>
            {data?.openPositions.length ?? 0}
          </span>
        </div>
        {(data?.openPositions.length ?? 0) === 0 ? (
          <p style={{ padding: '20px', color: 'var(--color-subtle)', fontSize: '13px' }}>
            No open positions.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <th style={thL}>Side</th>
                  <th style={thL}>Status</th>
                  <th style={thR}>Entry</th>
                  <th style={thR}>SL</th>
                  <th style={thR}>TP1</th>
                  <th style={thR}>TP2</th>
                  <th style={thR}>Rem. Qty</th>
                  <th style={thR}>Opened (UTC+7)</th>
                </tr>
              </thead>
              <tbody>
                {data?.openPositions.map((pos, i) => (
                  <tr
                    key={pos.id}
                    style={{
                      borderBottom:
                        i < data.openPositions.length - 1
                          ? '1px solid var(--color-border)'
                          : 'none',
                    }}
                  >
                    <td style={tdL}>
                      <SideChip side={pos.side} />
                    </td>
                    <td style={tdL}>
                      <StatusBadge status={pos.status} />
                    </td>
                    <td style={tdR}>{fmtPrice(pos.entryPrice)}</td>
                    <td style={{ ...tdR, color: 'var(--color-loss)' }}>{fmtPrice(pos.stopLoss)}</td>
                    <td style={{ ...tdR, color: 'var(--color-win)' }}>{fmtPrice(pos.tp1)}</td>
                    <td style={{ ...tdR, color: 'var(--color-win)' }}>{fmtPrice(pos.tp2)}</td>
                    <td style={{ ...tdR, color: 'var(--color-muted)' }}>{pos.remainingQty}</td>
                    <td style={{ ...tdR, color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>
                      {fmtDate(pos.openedAt ? new Date(pos.openedAt).toISOString() : null)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
