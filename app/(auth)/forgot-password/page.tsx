'use client'

import { useFormState, useFormStatus } from 'react-dom'
import Link from 'next/link'
import { forgotPasswordAction, type AuthState } from '@/app/actions/auth'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className="auth-btn">
      {pending ? 'Sending...' : 'Send Reset Link'}
    </button>
  )
}

export default function ForgotPasswordPage() {
  const [state, formAction] = useFormState<AuthState, FormData>(forgotPasswordAction, null)

  if (state?.success) {
    return (
      <div className="auth-card">
        <h1 className="auth-title">Check your email</h1>
        <p className="auth-subtitle">
          We sent a password reset link to{' '}
          <strong>{state.email}</strong>. Check your inbox and follow the link.
        </p>
        <div className="auth-links">
          <Link href="/login" className="auth-link">
            <span>Back to sign in</span>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-card">
      <h1 className="auth-title">Reset your password</h1>
      <p className="auth-subtitle">
        Enter your email and we&apos;ll send you a link to choose a new password.
      </p>

      <form action={formAction}>
        {state?.error && (
          <p className="auth-error" role="alert">{state.error}</p>
        )}

        <div className="auth-field">
          <label className="auth-label" htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="auth-input"
          />
        </div>

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
