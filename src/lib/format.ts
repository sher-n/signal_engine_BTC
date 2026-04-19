const BKK = 'Asia/Bangkok'

export function fmtDate(iso: string | number | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('th-TH', {
    timeZone: BKK,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function fmtPrice(v: string | number | null | undefined): string {
  if (v == null) return '—'
  return Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function fmtPnl(v: string | number | null | undefined): string {
  if (v == null) return '—'
  const n = Number(v)
  const sign = n >= 0 ? '+' : ''
  return `${sign}$${Math.abs(n).toFixed(2)}`
}

export function fmtPct(v: number | null | undefined, decimals = 1): string {
  if (v == null) return '—'
  const sign = v >= 0 ? '+' : ''
  return `${sign}${v.toFixed(decimals)}%`
}

export function pnlColor(v: string | number | null | undefined): string {
  if (v == null) return 'var(--color-muted)'
  return Number(v) >= 0 ? 'var(--color-win)' : 'var(--color-loss)'
}
