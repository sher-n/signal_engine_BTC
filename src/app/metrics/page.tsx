'use client'

import { useCallback, useEffect, useState } from 'react'
import { fmtDate, fmtPct, fmtPrice } from '../../lib/format'
import type { MetricTop10Row } from '../../lib/api-contracts'

const REFRESH_MS = 10 * 60 * 1000
type Filter = 'ALL' | MetricTop10Row['bias']

function biasColor(bias: MetricTop10Row['bias']): string {
  if (bias === 'BULLISH') return 'var(--color-win)'
  if (bias === 'BEARISH') return 'var(--color-loss)'
  return 'var(--color-muted)'
}

function toSignalSetup(row: MetricTop10Row) {
  const entry = Number(row.price)
  const rr = 2

  if (row.bias === 'BEARISH') {
    const stopLoss = entry * 1.015
    const tp = entry - (stopLoss - entry) * rr
    return { side: 'SHORT', entry, stopLoss, tp, rr }
  }

  const stopLoss = entry * 0.985
  const tp = entry + (entry - stopLoss) * rr
  return { side: 'LONG', entry, stopLoss, tp, rr }
}

export default function MetricsPage() {
  const [rows, setRows] = useState<MetricTop10Row[]>([])
  const [filter, setFilter] = useState<Filter>('ALL')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const fetchData = useCallback(async (isBackgroundRefresh = false) => {
    if (isBackgroundRefresh) setRefreshing(true)
    try {
      const res = await fetch('/api/metrics/top10')
      if (!res.ok) throw new Error(`Request failed with status ${res.status}`)
      const payload = (await res.json()) as MetricTop10Row[]
      setRows(payload)
      setError(null)
      setLastRefresh(new Date())
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(`Failed to load metrics. ${message}`)
    } finally {
      if (isBackgroundRefresh) setRefreshing(false)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData(false)
    const id = setInterval(() => void fetchData(true), REFRESH_MS)
    return () => clearInterval(id)
  }, [fetchData])

  const filteredRows = rows.filter((row) => (filter === 'ALL' ? true : row.bias === filter))
  const signalRows = filteredRows.slice(0, 4)

  const filterBtn = (value: Filter) => (
    <button
      key={value}
      onClick={() => setFilter(value)}
      style={{
        padding: '4px 14px',
        borderRadius: '6px',
        fontSize: '12px',
        fontWeight: 500,
        border: 'none',
        cursor: 'pointer',
        background: filter === value ? 'var(--color-primary)' : 'var(--color-surface-2)',
        color: filter === value ? '#fff' : 'var(--color-muted)',
        transition: 'background 0.15s',
      }}
    >
      {value}
    </button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <h1 style={{ fontSize: '18px', fontWeight: 600 }}>Metric</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--color-subtle)', fontSize: '12px' }}>
            {lastRefresh ? fmtDate(lastRefresh.toISOString()) : '—'} · auto 10 min
            {refreshing ? ' · refreshing...' : ''}
          </span>
          {(['ALL', 'BULLISH', 'NEUTRAL', 'BEARISH'] as Filter[]).map(filterBtn)}
        </div>
      </div>

      {error ? (
        <p style={{ fontSize: '13px', color: 'var(--color-loss)' }}>
          {error} {rows.length > 0 ? 'Showing last successful snapshot.' : ''}
        </p>
      ) : null}

      {signalRows.length > 0 ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: '12px',
          }}
        >
          {signalRows.map((row) => {
            const setup = toSignalSetup(row)
            return (
              <div
                key={`signal-${row.symbol}`}
                className={`signal-setup-card ${setup.side === 'LONG' ? 'signal-setup-card--long' : 'signal-setup-card--short'}`}
                style={{
                  borderRadius: '8px',
                  padding: '14px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '10px',
                  }}
                >
                  <span style={{ fontWeight: 700, color: '#111111' }}>{row.symbol}</span>
                  <span style={{ fontSize: '12px', color: biasColor(row.bias) }}>
                    {setup.side} · {row.bias}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: '6px' }}>
                  <span style={{ color: '#4b5563', fontSize: '12px' }}>Entry</span>
                  <span style={{ textAlign: 'right', color: '#111111' }}>
                    ${fmtPrice(setup.entry)}
                  </span>
                  <span style={{ color: '#4b5563', fontSize: '12px' }}>TP</span>
                  <span style={{ textAlign: 'right', color: 'var(--color-win)' }}>
                    ${fmtPrice(setup.tp)}
                  </span>
                  <span style={{ color: '#4b5563', fontSize: '12px' }}>SL</span>
                  <span style={{ textAlign: 'right', color: 'var(--color-loss)' }}>
                    ${fmtPrice(setup.stopLoss)}
                  </span>
                  <span style={{ color: '#4b5563', fontSize: '12px' }}>RR</span>
                  <span style={{ textAlign: 'right', color: '#111111' }}>
                    {setup.rr.toFixed(2)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      ) : null}

      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '8px',
          overflow: 'auto',
        }}
      >
        {loading && rows.length === 0 ? (
          <p style={{ padding: '24px', color: 'var(--color-muted)', fontSize: '13px' }}>Loading…</p>
        ) : rows.length === 0 ? (
          <div style={{ padding: '24px', color: 'var(--color-subtle)', fontSize: '13px' }}>
            <p style={{ marginBottom: '10px' }}>No metrics available.</p>
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
        ) : filteredRows.length === 0 ? (
          <p style={{ padding: '24px', color: 'var(--color-subtle)', fontSize: '13px' }}>
            No symbols found for filter {filter}.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr
                style={{
                  borderBottom: '1px solid var(--color-border)',
                  color: 'var(--color-subtle)',
                }}
              >
                {[
                  'Symbol',
                  'Price',
                  '24h %',
                  'RSI',
                  'MACD',
                  'EMA',
                  'Volume',
                  'OI',
                  'Score',
                  'Bias',
                  'Updated (UTC+7)',
                ].map((h) => (
                  <th
                    key={h}
                    style={{ padding: '10px 14px', textAlign: h === 'Symbol' ? 'left' : 'right' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, i) => (
                <tr
                  key={row.symbol}
                  style={{
                    borderBottom:
                      i < filteredRows.length - 1 ? '1px solid var(--color-border)' : 'none',
                    background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                  }}
                >
                  <td style={{ padding: '9px 14px', fontWeight: 600 }}>{row.symbol}</td>
                  <td style={{ padding: '9px 14px', textAlign: 'right' }}>
                    ${fmtPrice(row.price)}
                  </td>
                  <td
                    style={{
                      padding: '9px 14px',
                      textAlign: 'right',
                      color: row.change24hPct >= 0 ? 'var(--color-win)' : 'var(--color-loss)',
                    }}
                  >
                    {fmtPct(row.change24hPct, 2)}
                  </td>
                  <td style={{ padding: '9px 14px', textAlign: 'right' }}>
                    {row.metrics.rsi.toFixed(1)}
                  </td>
                  <td style={{ padding: '9px 14px', textAlign: 'right' }}>
                    {row.metrics.macd.toFixed(1)}
                  </td>
                  <td style={{ padding: '9px 14px', textAlign: 'right' }}>
                    {row.metrics.emaTrend.toFixed(1)}
                  </td>
                  <td style={{ padding: '9px 14px', textAlign: 'right' }}>
                    {row.metrics.volumeProfile.toFixed(1)}
                  </td>
                  <td style={{ padding: '9px 14px', textAlign: 'right' }}>
                    {row.metrics.openInterest.toFixed(1)}
                  </td>
                  <td style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 700 }}>
                    {row.score.toFixed(1)}
                  </td>
                  <td
                    style={{ padding: '9px 14px', textAlign: 'right', color: biasColor(row.bias) }}
                  >
                    {row.bias}
                  </td>
                  <td
                    style={{ padding: '9px 14px', textAlign: 'right', color: 'var(--color-muted)' }}
                  >
                    {fmtDate(row.updatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
