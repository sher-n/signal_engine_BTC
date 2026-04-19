'use client'

interface Props {
  label: string
  value: string
  sub?: string
  color?: string
}

export function StatCard({ label, value, sub, color }: Props) {
  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: '8px',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
      }}
    >
      <span
        style={{
          fontSize: '12px',
          color: 'var(--color-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: '22px',
          fontWeight: 700,
          color: color ?? 'var(--color-text)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </span>
      {sub && <span style={{ fontSize: '12px', color: 'var(--color-subtle)' }}>{sub}</span>}
    </div>
  )
}
