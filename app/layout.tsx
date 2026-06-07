import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Chariot',
  description: 'Founding Member — Drop 0',
}

// Explicit viewport config. `viewportFit: 'cover'` makes safe-area-inset
// values reflect actual notch / home indicator on iOS so the sticky CTA
// rules in landing.page.css work as intended. `themeColor` paints the
// browser chrome (Safari address bar) the same ink as the nav for a
// seamless full-bleed feel.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F2EBE0' },
    { media: '(prefers-color-scheme: dark)',  color: '#111111' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Skip-to-content link — WCAG 2.4.1 bypass-blocks. Visually hidden
            until keyboard-focused, then slides into view at the top-left so
            screen-reader + Tab users can jump past the nav directly into
            page content. Every page's main landmark uses id="top" or
            id="main". */}
        <a href="#top" className="skip-link">Skip to content</a>
        {children}
      </body>
    </html>
  )
}
