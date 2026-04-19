import type { Metadata } from 'next'
import Link from 'next/link'
import { Fredoka } from 'next/font/google'
import './globals.css'

const fredoka = Fredoka({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700'] })

export const metadata: Metadata = {
  title: 'BTC Signal Engine',
  description: 'BTC/USDT LOOSE-3 signal dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={fredoka.className}
        style={{ backgroundColor: 'var(--color-bg)', minHeight: '100vh' }}
      >
        <nav
          style={{
            backgroundColor: 'var(--color-surface)',
            borderBottom: '1px solid var(--color-border)',
            padding: '0 24px',
            height: '52px',
            display: 'flex',
            alignItems: 'center',
            gap: '32px',
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          <span
            style={{
              color: 'var(--color-primary)',
              fontWeight: 700,
              fontSize: '15px',
              letterSpacing: '0.05em',
            }}
          >
            BTC/USDT
          </span>
          <Link
            href="/"
            style={{ color: 'var(--color-muted)', fontSize: '14px', textDecoration: 'none' }}
          >
            Dashboard
          </Link>
          <Link
            href="/signals"
            style={{ color: 'var(--color-muted)', fontSize: '14px', textDecoration: 'none' }}
          >
            Signals
          </Link>
        </nav>
        <main style={{ padding: '24px', maxWidth: '1280px', margin: '0 auto' }}>{children}</main>
      </body>
    </html>
  )
}
