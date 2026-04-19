'use client'

import { useEffect, useState, useCallback } from 'react'
import { fmtDate, fmtPrice, fmtPnl, pnlColor } from '../../lib/format'

const REFRESH_MS = 10 * 60 * 1000

type Filter = 'ALL' | 'WIN' | 'LOSS' | 'ACTIVE'

interface SignalRow {
  id: string
  side: 'LONG' | 'SHORT'
  status: string
  entryPrice: string
  stopLoss: string
  tp1: string
  tp2: string
  atrAtEntry: string
  quantity: string
  realizedPnl: string | null
  openedAt: number | null
  closedAt: number | null
  fillCount: number
}

function sideChip(side: 'LONG' | 'SHORT') {
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

function statusColor(status: string): string {
  const map: Record<string, string> = {
    ACTIVE: 'var(--color-primary)',
    TP1_HIT: '#facc15',
    TP2_HIT: '#f97316',
    CLOSED: 'var(--color-muted)',
    CANCELLED: 'var(--color-subtle)',
  }
  return map[status] ?? 'var(--color-muted)'
}

export default function SignalsPage() {
  const [rows, setRows] = useState<SignalRow[]>([])
  const [filter, setFilter] = useState<Filter>('ALL')
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    const res = await fetch('/api/signals/history')
    if (res.ok) setRows(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
    const id = setInterval(fetchData, REFRESH_MS)
    return () => clearInterval(id)
  }, [fetchData])

  const filtered = rows.filter((r) => {
    if (filter === 'WIN') return r.status === 'CLOSED' && Number(r.realizedPnl ?? 0) > 0
    if (filter === 'LOSS') return r.status === 'CLOSED' && Number(r.realizedPnl ?? 0) <= 0
    if (filter === 'ACTIVE') return r.status !== 'CLOSED' && r.status !== 'CANCELLED'
    return true
  })

  const filterBtn = (f: Filter) => (
    <button
      key={f}
      onClick={() => setFilter(f)}
      style={{
        padding: '4px 14px',
        borderRadius: '6px',
        fontSize: '12px',
        fontWeight: 500,
        border: 'none',
        cursor: 'pointer',
        background: filter === f ? 'var(--color-primary)' : 'var(--color-surface-2)',
        color: filter === f ? '#fff' : 'var(--color-muted)',
        transition: 'background 0.15s',
      }}
    >
      {f}
    </button>
  )

  const COLS = [
    'Side',
    'Status',
    'Entry',
    'SL',
    'TP1',
    'TP2',
    'ATR',
    'Qty',
    'PnL',
    'Fills',
    'Opened',
    'Closed',
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <h1 style={{ fontSize: '18px', fontWeight: 600 }}>Signal History</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          {(['ALL', 'ACTIVE', 'WIN', 'LOSS'] as Filter[]).map(filterBtn)}
        </div>
      </div>

      {/* Table */}
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '8px',
          overflow: 'auto',
        }}
      >
        {loading ? (
          <p style={{ padding: '24px', color: 'var(--color-muted)', fontSize: '13px' }}>Loading…</p>
        ) : filtered.length === 0 ? (
          <p style={{ padding: '24px', color: 'var(--color-subtle)', fontSize: '13px' }}>
            No signals found.
          </p>
        ) : (
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '13px',
              whiteSpace: 'nowrap',
            }}
          >
            <thead>
              <tr
                style={{
                  color: 'var(--color-subtle)',
                  borderBottom: '1px solid var(--color-border)',
                }}
              >
                {COLS.map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '10px 14px',
                      textAlign: ['Side', 'Status'].includes(h) ? 'left' : 'right',
                      fontWeight: 500,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr
                  key={r.id}
                  style={{
                    borderBottom:
                      i < filtered.length - 1 ? '1px solid var(--color-border)' : 'none',
                    background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                  }}
                >
                  <td style={{ padding: '9px 14px' }}>{sideChip(r.side)}</td>
                  <td
                    style={{ padding: '9px 14px', color: statusColor(r.status), fontSize: '12px' }}
                  >
                    {r.status.replace('_', ' ')}
                  </td>
                  {[r.entryPrice, r.stopLoss, r.tp1, r.tp2, r.atrAtEntry].map((v, j) => (
                    <td
                      key={j}
                      style={{
                        padding: '9px 14px',
                        textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {fmtPrice(v)}
                    </td>
                  ))}
                  <td
                    style={{ padding: '9px 14px', textAlign: 'right', color: 'var(--color-muted)' }}
                  >
                    {r.quantity}
                  </td>
                  <td
                    style={{
                      padding: '9px 14px',
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                      color: pnlColor(r.realizedPnl),
                      fontWeight: 600,
                    }}
                  >
                    {r.realizedPnl != null ? fmtPnl(r.realizedPnl) : '—'}
                  </td>
                  <td
                    style={{
                      padding: '9px 14px',
                      textAlign: 'right',
                      color: 'var(--color-subtle)',
                    }}
                  >
                    {r.fillCount}
                  </td>
                  <td
                    style={{ padding: '9px 14px', textAlign: 'right', color: 'var(--color-muted)' }}
                  >
                    {fmtDate(r.openedAt ? new Date(r.openedAt).toISOString() : null)}
                  </td>
                  <td
                    style={{ padding: '9px 14px', textAlign: 'right', color: 'var(--color-muted)' }}
                  >
                    {r.closedAt ? fmtDate(new Date(r.closedAt).toISOString()) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p style={{ fontSize: '12px', color: 'var(--color-subtle)', textAlign: 'right' }}>
        {filtered.length} signals · all times UTC+7 · auto-refresh 10 min
      </p>
    </div>
  )
}
