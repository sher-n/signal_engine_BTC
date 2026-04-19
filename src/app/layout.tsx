import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'BTC Signal Engine',
  description: 'BTC/USDT LOOSE-3 signal dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
