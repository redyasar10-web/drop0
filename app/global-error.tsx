'use client'

// Top-level error boundary fallback (wraps the root layout). Generic only.
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[global error boundary]', error)
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          padding: '2rem',
          textAlign: 'center',
          background: '#111111',
          color: '#F2EBE0',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <h1 style={{ fontSize: '1.5rem', fontWeight: 500 }}>Something went wrong</h1>
        <p style={{ opacity: 0.7, maxWidth: '32rem' }}>
          We hit an unexpected problem. Please try again.
        </p>
        <button
          onClick={reset}
          style={{
            padding: '0.75rem 1.5rem',
            background: '#C9921E',
            color: '#111111',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Try again
        </button>
      </body>
    </html>
  )
}
