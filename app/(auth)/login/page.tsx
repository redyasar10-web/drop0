'use client'

import { useFormState, useFormStatus } from 'react-dom'
import Link from 'next/link'
import { loginAction, type AuthState } from '@/app/actions/auth'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className="auth-btn">
      {pending ? 'Signing in...' : 'Sign In'}
    </button>
  )
}

export default function LoginPage() {
  const [state, formAction] = useFormState<AuthState, FormData>(loginAction, null)

  return (
    <div className="auth-card">
      <h1 className="auth-title">Sign In</h1>

      <form action={formAction}>
        {state?.error && (
          <p className="auth-error" role="alert">
            {state.error}
            {state.email && (
              <>
                {' '}
                <Link href={`/verify-email?email=${encodeURIComponent(state.email)}`}>
                  Resend verification
                </Link>
              </>
            )}
          </p>
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

        <div className="auth-field">
          <label className="auth-label" htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="auth-input"
          />
        </div>

        <SubmitButton />
      </form>

      <div className="auth-links">
        <Link href="/forgot-password" className="auth-link">
          Forgot your password?
        </Link>
        <p className="auth-link">
          No account?{' '}
          <Link href="/signup"><span>Create one</span></Link>
        </p>
      </div>
    </div>
  )
}
