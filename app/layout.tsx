import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Chariot — Drop 0 · The Founding Fifty',
  description:
    '1NRI, direct from Accra. No customs, no three-week wait. $20 gets you a founding spot, $30 in Drop 1 credit, and first access to every drop — for life.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <noscript>
          <style>{`.reveal{opacity:1 !important;transform:none !important}`}</style>
        </noscript>
        {children}
      </body>
    </html>
  )
}
