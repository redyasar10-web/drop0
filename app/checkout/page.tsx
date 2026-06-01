'use client'

import { useFormState, useFormStatus } from 'react-dom'
import Link from 'next/link'
import { createCheckoutSession, type CheckoutState } from '@/app/actions/checkout'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className="auth-btn">
      {pending ? 'Redirecting to checkout...' : 'Continue to checkout'}
    </button>
  )
}

export default function CheckoutPage() {
  const [state, formAction] = useFormState<CheckoutState, FormData>(
    createCheckoutSession,
    null
  )

  return (
    <div className="checkout-shell">
      <header className="checkout-header">
        <Link href="/account" className="checkout-wordmark">Chariot</Link>
      </header>

      <main className="checkout-main">
        <div className="checkout-card">
          <div className="checkout-product">
            <p className="checkout-eyebrow">Drop 0</p>
            <h1 className="checkout-title">Founding Member</h1>
            <p className="checkout-desc">
              Limited pre-order. Confirms your place in Drop 0 and assigns your permanent
              member number. Includes $30 in store credit toward this or any future drop.
            </p>
          </div>

          <div className="checkout-divider" />

          <form action={formAction}>
            {state?.error && (
              <p className="auth-error" role="alert">{state.error}</p>
            )}

            <div className="auth-field">
              <label className="auth-label" htmlFor="promo_code">
                Promo code <span className="checkout-optional">(optional)</span>
              </label>
              <input
                id="promo_code"
                name="promo_code"
                type="text"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                className="auth-input"
                placeholder="Enter code"
              />
            </div>

            <SubmitButton />
          </form>

          <div className="auth-links">
            <p className="auth-link">
              <Link href="/account"><span>Back to account</span></Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
