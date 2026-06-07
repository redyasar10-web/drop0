'use client'

import { useFormState, useFormStatus } from 'react-dom'
import Link from 'next/link'
import { resetPasswordAction, type AuthState } from '@/app/actions/auth'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className="pbtn">
      <span>{pending ? 'Updating…' : 'Update password'}</span>
    </button>
  )
}

export default function ResetPasswordPage() {
  const [state, formAction] = useFormState<AuthState, FormData>(resetPasswordAction, null)

  return (
    <form className="form" action={formAction} noValidate>
      <p className="form__eyebrow">Members</p>
      <h1 className="form__title">Choose a new password.</h1>
      <p className="form__lead">At least 12 characters. Make it something you don&rsquo;t use elsewhere.</p>

      {state?.error && (
        <div className="formbanner formbanner--error" role="status">
          <span>{state.error}</span>
        </div>
      )}

      <div className="field">
        <div className="field__labelrow"><label className="field__label" htmlFor="password">New password</label></div>
        <div className="input-shell">
          <input id="password" name="password" type="password" minLength={12} autoComplete="new-password" placeholder="At least 12 characters" required />
        </div>
      </div>

      <div className="field">
        <div className="field__labelrow"><label className="field__label" htmlFor="confirm_password">Confirm new password</label></div>
        <div className="input-shell">
          <input id="confirm_password" name="confirm_password" type="password" minLength={12} autoComplete="new-password" placeholder="••••••••" required />
        </div>
      </div>

      <SubmitButton />

      <Link className="form__back" href="/login"><span aria-hidden="true">←</span> Back to sign in</Link>
    </form>
  )
}
