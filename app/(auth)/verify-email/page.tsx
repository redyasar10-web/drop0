'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import { resendVerificationAction, type AuthState } from '@/app/actions/auth'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className="pbtn">
      <span>{pending ? 'Sending…' : 'Resend verification email'}</span>
    </button>
  )
}

function VerifyContent() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email') ?? ''
  const [state, formAction] = useFormState<AuthState, FormData>(resendVerificationAction, null)

  return (
    <div className="form">
      <p className="form__eyebrow">The Founding Fifty</p>
      <h1 className="form__title">Check your email.</h1>
      <p className="form__lead">
        We sent a verification link to <strong>{email || 'your email'}</strong>. Click it to activate your account.
      </p>

      {state?.error && (
        <div className="formbanner formbanner--error" role="status">
          <span>{state.error}</span>
        </div>
      )}
      {state?.success && (
        <div className="formbanner" role="status">
          <span>Verification email resent.</span>
        </div>
      )}

      <form action={formAction}>
        <input type="hidden" name="email" value={email} />
        <SubmitButton />
      </form>

      <Link className="form__back" href="/login"><span aria-hidden="true">←</span> Back to sign in</Link>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="form"><p className="form__lead">Loading…</p></div>}>
      <VerifyContent />
    </Suspense>
  )
}
