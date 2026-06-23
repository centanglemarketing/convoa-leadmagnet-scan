import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Free Google Business Profile Scanner | Convoa',
  description:
    "See exactly what your Google Business Profile is missing — and how it's costing you customers. Free instant scan for trades businesses.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
