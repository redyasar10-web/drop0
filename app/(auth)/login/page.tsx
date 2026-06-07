'use client'

import { useFormState, useFormStatus } from 'react-dom'
import Link from 'next/link'
import { loginAction, type AuthState } from '@/app/actions/auth'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className="pbtn" data-submit>
      <span>{pending ? 'Signing in…' : 'Log in'}</span>
      <svg className="pbtn__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 12h15"></path>
        <path d="M13 6l6 6-6 6"></path>
      </svg>
    </button>
  )
}

export default function LoginPage() {
  const [state, formAction] = useFormState<AuthState, FormData>(loginAction, null)

  return (
    <form className="form" action={formAction} noValidate>
      <p className="form__eyebrow">Members</p>
      <h1 className="form__title">Welcome back.</h1>
      <p className="form__lead">
        <em>You&rsquo;re already wearing it.</em> Sign in to pick up your founding spot and the pieces with your name on them.
      </p>

      {state?.error && (
        <div className="formbanner formbanner--error" role="status">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3.2 1.8 20.5h20.4L12 3.2Z"></path>
            <path d="M12 9.6v4.6"></path>
            <path d="M12 17.3v.1" strokeWidth="2"></path>
          </svg>
          <span>
            {state.error}
            {state.email && (
              <>
                {' '}
                <Link href={`/verify-email?email=${encodeURIComponent(state.email)}`}>Resend verification</Link>
              </>
            )}
          </span>
        </div>
      )}

      <div className="field">
        <div className="field__labelrow"><label className="field__label" htmlFor="email">Email</label></div>
        <div className="input-shell">
          <input id="email" name="email" type="email" inputMode="email" autoComplete="email" placeholder="you@email.com" required />
        </div>
      </div>

      <div className="field">
        <div className="field__labelrow">
          <label className="field__label" htmlFor="password">Password</label>
          <Link href="/forgot-password" className="field__link">Forgot password?</Link>
        </div>
        <div className="input-shell">
          <input id="password" name="password" type="password" autoComplete="current-password" placeholder="••••••••" required />
        </div>
      </div>

      <SubmitButton />

      <div className="form__foot">
        <p className="form__newuser">
          New to Chariot? <Link href="/signup">Claim your founding spot</Link>
        </p>
      </div>
      <Link className="form__back" href="/"><span aria-hidden="true">←</span> Back to Drop 0</Link>
    </form>
  )
}
