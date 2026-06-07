'use client'

import { useFormState, useFormStatus } from 'react-dom'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { signupAction, type AuthState } from '@/app/actions/auth'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className="pbtn" data-submit>
      <span>{pending ? 'Creating account…' : 'Create account'}</span>
      <svg className="pbtn__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 12h15"></path>
        <path d="M13 6l6 6-6 6"></path>
      </svg>
    </button>
  )
}

function SignupForm() {
  const [state, formAction] = useFormState<AuthState, FormData>(signupAction, null)
  const searchParams = useSearchParams()
  const ref = searchParams.get('ref') || ''

  return (
    <form className="form" action={formAction} noValidate>
      {/* Preserve referral code through signup (resolved to the referrer's id server-side) */}
      {ref && <input type="hidden" name="referred_by" value={ref} />}

      <p className="form__eyebrow">The Founding Fifty</p>
      <h1 className="form__title">Claim your spot.</h1>
      <p className="form__lead">
        One of fifty founding spots. $20 holds yours — with $30 in Drop&nbsp;1 credit and first access, for life.
      </p>

      {state?.error && (
        <div className="formbanner formbanner--error" role="status">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3.2 1.8 20.5h20.4L12 3.2Z"></path>
            <path d="M12 9.6v4.6"></path>
            <path d="M12 17.3v.1" strokeWidth="2"></path>
          </svg>
          <span>{state.error}</span>
        </div>
      )}

      <div className="field">
        <div className="field__labelrow"><label className="field__label" htmlFor="email">Email</label></div>
        <div className="input-shell">
          <input id="email" name="email" type="email" inputMode="email" autoComplete="email" placeholder="you@email.com" required />
        </div>
      </div>

      <div className="field">
        <div className="field__labelrow"><label className="field__label" htmlFor="password">Password</label></div>
        <div className="input-shell">
          <input id="password" name="password" type="password" minLength={12} autoComplete="new-password" placeholder="At least 12 characters" required />
        </div>
      </div>

      <div className="field">
        <div className="field__labelrow"><label className="field__label" htmlFor="confirm_password">Confirm password</label></div>
        <div className="input-shell">
          <input id="confirm_password" name="confirm_password" type="password" minLength={12} autoComplete="new-password" placeholder="••••••••" required />
        </div>
      </div>

      <div className="optrow">
        <label className="check" htmlFor="tc_agreed">
          <input id="tc_agreed" name="tc_agreed" type="checkbox" required />
          <span className="check__box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12.5l5 5L20 6.5"></path></svg>
          </span>
          <span className="check__label">
            I have read and agree to the{' '}
            <Link href="/terms" target="_blank" rel="noopener noreferrer">Terms &amp; Conditions</Link>.
          </span>
        </label>
      </div>

      <SubmitButton />

      <div className="form__foot">
        <p className="form__newuser">
          Already a member? <Link href="/login">Log in</Link>
        </p>
      </div>
      <Link className="form__back" href="/"><span aria-hidden="true">←</span> Back to Drop 0</Link>
    </form>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="form"><p className="form__lead">Loading…</p></div>}>
      <SignupForm />
    </Suspense>
  )
}
