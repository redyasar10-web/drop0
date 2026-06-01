'use client'

import { useFormState, useFormStatus } from 'react-dom'
import Link from 'next/link'
import { resetPasswordAction, type AuthState } from '@/app/actions/auth'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className="auth-btn">
      {pending ? 'Updating...' : 'Update Password'}
    </button>
  )
}

export default function ResetPasswordPage() {
  const [state, formAction] = useFormState<AuthState, FormData>(resetPasswordAction, null)

  return (
    <div className="auth-card">
      <h1 className="auth-title">Choose a new password</h1>

      <form action={formAction}>
        {state?.error && (
          <p className="auth-error" role="alert">{state.error}</p>
        )}

        <div className="auth-field">
          <label className="auth-label" htmlFor="password">New Password</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="auth-input"
          />
        </div>

        <div className="auth-field">
          <label className="auth-label" htmlFor="confirm_password">Confirm New Password</label>
          <input
            id="confirm_password"
            name="confirm_password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
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
