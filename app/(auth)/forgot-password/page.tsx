'use client'

import { useFormState, useFormStatus } from 'react-dom'
import Link from 'next/link'
import { forgotPasswordAction, type AuthState } from '@/app/actions/auth'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className="pbtn">
      <span>{pending ? 'Sending…' : 'Send reset link'}</span>
    </button>
  )
}

export default function ForgotPasswordPage() {
  const [state, formAction] = useFormState<AuthState, FormData>(forgotPasswordAction, null)

  if (state?.success) {
    return (
      <div className="form">
        <p className="form__eyebrow">Members</p>
        <h1 className="form__title">Check your email.</h1>
        <p className="form__lead">
          We sent a password reset link to <strong>{state.email}</strong>. The link expires in one hour.
        </p>
        <Link className="form__back" href="/login"><span aria-hidden="true">←</span> Back to sign in</Link>
      </div>
    )
  }

  return (
    <form className="form" action={formAction} noValidate>
      <p className="form__eyebrow">Members</p>
      <h1 className="form__title">Reset your password.</h1>
      <p className="form__lead">Enter your email and we&rsquo;ll send a link to choose a new password.</p>

      {state?.error && (
        <div className="formbanner formbanner--error" role="status">
          <span>{state.error}</span>
        </div>
      )}

      <div className="field">
        <div className="field__labelrow"><label className="field__label" htmlFor="email">Email</label></div>
        <div className="input-shell">
          <input id="email" name="email" type="email" inputMode="email" autoComplete="email" placeholder="you@email.com" required />
        </div>
      </div>

      <SubmitButton />

      <Link className="form__back" href="/login"><span aria-hidden="true">←</span> Back to sign in</Link>
    </form>
  )
}
