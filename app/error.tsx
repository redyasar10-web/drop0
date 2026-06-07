'use client'

// Route-level error boundary (NF-7). Shows a generic, calm message — never
// the underlying error — and offers a retry. The real error is logged.
import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[app error boundary]', error)
  }, [error])

  return (
    <main
      style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-24)' }}>
        Something went wrong
      </h1>
      <p style={{ fontFamily: 'var(--font-body)', color: 'var(--fg-2)', maxWidth: '32rem' }}>
        We hit an unexpected problem. Your account and any completed purchase are safe.
        Please try again.
      </p>
      <button onClick={reset} className="auth-btn" style={{ width: 'auto' }}>
        Try again
      </button>
    </main>
  )
}
