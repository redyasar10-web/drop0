'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import { resendVerificationAction, type AuthState } from '@/app/actions/auth'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className="auth-btn" style={{ marginTop: '0' }}>
      {pending ? 'Sending...' : 'Resend Verification Email'}
    </button>
  )
}

function VerifyContent() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email') ?? ''
  const [state, formAction] = useFormState<AuthState, FormData>(resendVerificationAction, null)

  return (
    <div className="auth-card">
      <span className="verify-icon" aria-hidden="true">✉</span>
      <h1 className="auth-title">Check your email</h1>
      <p className="auth-subtitle">
        We sent a verification link to <strong>{email || 'your email'}</strong>.
        Click the link to activate your account.
      </p>

      {state?.error && <p className="auth-error" role="alert">{state.error}</p>}
      {state?.success && <p className="auth-success">Verification email resent.</p>}

      <form action={formAction}>
        <input type="hidden" name="email" value={email} />
        <SubmitButton />
      </form>

      <div className="auth-links">
        <Link href="/login" className="auth-link">
          <span>Back to sign in</span>
        </Link>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="auth-card"><p className="auth-link">Loading...</p></div>}>
      <VerifyContent />
    </Suspense>
  )
}
