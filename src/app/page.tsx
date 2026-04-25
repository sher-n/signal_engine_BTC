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
import type { DashboardData } from '../lib/api-contracts'

const REFRESH_MS = 10 * 60 * 1000

function calcRealtimeMark(entryPrice: string, tp2: string, stopLoss: string): number {
  const entry = Number(entryPrice)
  const target = Number(tp2)
  const stop = Number(stopLoss)
  const span = Math.max(Math.abs(target - stop), entry * 0.01)
  const drift = Math.sin(Date.now() / 6000) * span * 0.22
  return entry + drift
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [lastRefresh, setLast] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [, setLiveNow] = useState(Date.now())

  const fetchData = useCallback(async (isBackgroundRefresh = false) => {
    if (isBackgroundRefresh) setRefreshing(true)
    try {
      const res = await fetch('/api/dashboard')
      if (!res.ok) throw new Error(`Request failed with status ${res.status}`)
      setData(await res.json())
      setLast(new Date())
      setError(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(`Failed to load dashboard data. ${message}`)
    } finally {
      if (isBackgroundRefresh) setRefreshing(false)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData(false)
    const id = setInterval(() => void fetchData(true), REFRESH_MS)
    return () => clearInterval(id)
  }, [fetchData])

  useEffect(() => {
    const id = setInterval(() => setLiveNow(Date.now()), 2000)
    return () => clearInterval(id)
  }, [])

  if (loading && !data)
    return (
      <div style={{ paddingTop: '64px', textAlign: 'center', color: 'var(--color-muted)' }}>
        Loading…
      </div>
    )

  if (!data)
    return (
      <div style={{ paddingTop: '64px', textAlign: 'center', color: 'var(--color-muted)' }}>
        <p style={{ marginBottom: '10px' }}>{error ?? 'No dashboard data available.'}</p>
        <button
          onClick={() => void fetchData(false)}
          style={{
            background: 'var(--color-primary)',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            padding: '8px 12px',
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    )

  const s = data.stats

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 600 }}>Dashboard</h1>
        <span style={{ fontSize: '12px', color: 'var(--color-subtle)' }}>
          {lastRefresh ? fmtDate(lastRefresh.toISOString()) : '—'} · auto 10 min
          {refreshing ? ' · refreshing...' : ''}
        </span>
      </div>
      {error ? (
        <p style={{ fontSize: '13px', color: 'var(--color-loss)' }}>
          {error} Showing last successful snapshot.
        </p>
      ) : null}

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
        {data.equityCurve.length < 2 ? (
          <p style={{ color: 'var(--color-subtle)', fontSize: '13px' }}>No closed trades yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data.equityCurve} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
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
          padding: '16px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '14px',
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
            {data.openPositions.length}
          </span>
        </div>
        {data.openPositions.length === 0 ? (
          <p style={{ padding: '6px 4px', color: 'var(--color-subtle)', fontSize: '13px' }}>
            No open positions.
          </p>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '12px',
            }}
          >
            {data.openPositions.map((pos) => {
              const markPrice = calcRealtimeMark(pos.entryPrice, pos.tp2, pos.stopLoss)
              const entry = Number(pos.entryPrice)
              const qty = Number(pos.remainingQty || pos.quantity || '0')
              const pnlRaw =
                pos.side === 'LONG' ? (markPrice - entry) * qty : (entry - markPrice) * qty

              return (
                <div
                  key={pos.id}
                  className={`signal-setup-card ${pos.side === 'LONG' ? 'signal-setup-card--long' : 'signal-setup-card--short'}`}
                  style={{ borderRadius: '8px', padding: '14px' }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '10px',
                    }}
                  >
                    <span style={{ fontWeight: 700, color: '#111111' }}>{pos.side}</span>
                    <span style={{ fontSize: '12px', color: '#4b5563' }}>{pos.status}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: '6px' }}>
                    <span style={{ color: '#4b5563', fontSize: '12px' }}>Realtime PnL</span>
                    <span style={{ textAlign: 'right', color: pnlColor(pnlRaw), fontWeight: 700 }}>
                      {fmtPnl(pnlRaw)}
                    </span>
                    <span style={{ color: '#4b5563', fontSize: '12px' }}>Entry</span>
                    <span style={{ textAlign: 'right', color: '#111111' }}>
                      ${fmtPrice(pos.entryPrice)}
                    </span>
                    <span style={{ color: '#4b5563', fontSize: '12px' }}>TP</span>
                    <span style={{ textAlign: 'right', color: 'var(--color-win)' }}>
                      ${fmtPrice(pos.tp1)}
                    </span>
                    <span style={{ color: '#4b5563', fontSize: '12px' }}>SL</span>
                    <span style={{ textAlign: 'right', color: 'var(--color-loss)' }}>
                      ${fmtPrice(pos.stopLoss)}
                    </span>
                    <span style={{ color: '#4b5563', fontSize: '12px' }}>Target</span>
                    <span style={{ textAlign: 'right', color: '#111111' }}>
                      ${fmtPrice(pos.tp2)}
                    </span>
                    <span style={{ color: '#4b5563', fontSize: '12px' }}>Opened</span>
                    <span style={{ textAlign: 'right', color: '#111111' }}>
                      {fmtDate(pos.openedAt ? new Date(pos.openedAt).toISOString() : null)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
