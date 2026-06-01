'use client'

import { useFormState, useFormStatus } from 'react-dom'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { signupAction, type AuthState } from '@/app/actions/auth'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className="auth-btn">
      {pending ? 'Creating account...' : 'Create Account'}
    </button>
  )
}

function SignupForm() {
  const [state, formAction] = useFormState<AuthState, FormData>(signupAction, null)
  const searchParams = useSearchParams()
  const ref = searchParams.get('ref') || ''

  return (
    <div className="auth-card">
      <h1 className="auth-title">Create your account</h1>

      <form action={formAction}>
        {/* Preserve referral code through signup */}
        {ref && <input type="hidden" name="referred_by" value={ref} />}

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

        <div className="auth-field">
          <label className="auth-label" htmlFor="password">Password</label>
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
          <label className="auth-label" htmlFor="confirm_password">Confirm Password</label>
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

        {/* T&C checkbox — required, blocks submit if unchecked */}
        <div className="auth-tc-row">
          <input
            id="tc_agreed"
            name="tc_agreed"
            type="checkbox"
            required
            className="auth-tc-checkbox"
          />
          <label htmlFor="tc_agreed" className="auth-tc-label">
            I have read and agree to the{' '}
            <Link href="/terms" target="_blank" rel="noopener noreferrer">
              Terms &amp; Conditions
            </Link>
            . I understand my email will be used to manage my account and send order updates.
          </label>
        </div>

        <SubmitButton />
      </form>

      <div className="auth-links">
        <p className="auth-link">
          Already have an account?{' '}
          <Link href="/login"><span>Sign in</span></Link>
        </p>
      </div>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="auth-card"><p className="auth-link">Loading...</p></div>}>
      <SignupForm />
    </Suspense>
  )
}
