'use client'

import { useState, useEffect } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import Link from 'next/link'
import Image from 'next/image'

// Detect a real Stripe publishable key. Vercel preview/test envs sometimes ship
// the placeholder "pk_test_51Dummy…" — Stripe will reject it and the SDK throws
// "Stripe has not loaded". Catching it here surfaces a clearer error and stops
// us from ever rendering <Elements> with a broken promise.
const RAW_PK = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''
const PK_LOOKS_REAL =
  /^pk_(test|live)_[A-Za-z0-9]{20,}$/.test(RAW_PK) && !/dummy/i.test(RAW_PK)
const stripePromise = PK_LOOKS_REAL
  ? loadStripe(RAW_PK).catch((err) => {
      console.error('[Stripe] loadStripe failed:', err)
      return null
    })
  : null

const DROP0_PRICE_CENTS = 2000
const DROP0_TOTAL = 50

const stripeAppearance = {
  theme: 'flat' as const,
  variables: {
    colorPrimary: '#C9921E',
    colorBackground: '#FAFAF8',
    colorText: '#111111',
    colorTextSecondary: 'rgba(17,17,17,0.70)',
    colorDanger: '#9B4523',
    fontFamily: 'Inter, system-ui, sans-serif',
    borderRadius: '2px',
    fontSizeBase: '15px',
  },
}

type CoState = 'editing' | 'processing' | 'error' | 'success'

interface PromoState {
  status: 'idle' | 'validating' | 'ok' | 'err'
  message: string
  discountCents: number
  isFree: boolean
}

interface CheckoutFormProps {
  creditBalance: number
  userEmail: string
  nextMemberNo: number
}

function pad3(n: number) {
  return String(n).padStart(3, '0')
}

function money(cents: number) {
  return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

// ── Shared summary panel — rendered twice (mobile bar + grid) ─────────────────

interface SummaryPanelProps {
  nextMemberNo: number
  creditCents: number
  promo: PromoState
  promoLabel: string
  effectiveTotal: number
}

function SummaryPanel({ nextMemberNo, creditCents, promo, promoLabel, effectiveTotal }: SummaryPanelProps) {
  return (
    <div className="co-sum__in">
      <div className="co-sum__hd">
        <span className="co-eye">Your order</span>
        <span className="co-sum__spots">{nextMemberNo - 1} of {DROP0_TOTAL} claimed</span>
      </div>

      <div className="co-lines">
        <div className="co-line">
          <div
            className="co-tag"
            role="img"
            aria-label={`Founding Member hangtag, number ${pad3(nextMemberNo)}`}
          >
            <div className="co-tag__wm">Chariot</div>
            <div className="co-tag__no">{pad3(nextMemberNo)}</div>
            <div className="co-tag__cap">Founding</div>
          </div>
          <div>
            <div className="co-line__name">Founding Member</div>
            <div className="co-line__meta">Chariot · Digital</div>
          </div>
          <div>
            <div className="co-line__price">{money(DROP0_PRICE_CENTS)}</div>
          </div>
        </div>
      </div>

      <div className="co-benefits">
        <div className="co-benefits__h">What&rsquo;s included</div>
        <ul>
          <li>
            <svg viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M3 7.4 5.7 10 11 4.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Hangtag with your number, in the order you joined
          </li>
          <li>
            <svg viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M3 7.4 5.7 10 11 4.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            24 hours early on every drop. Permanently.
          </li>
          <li>
            <svg viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M3 7.4 5.7 10 11 4.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            $30 credit toward Drop&nbsp;1
          </li>
        </ul>
      </div>

      <div className="co-totals">
        <div className="co-trow">
          <span>Subtotal</span>
          <b>{money(DROP0_PRICE_CENTS)}</b>
        </div>
        {creditCents > 0 && (
          <div className="co-trow co-trow--discount">
            <span>Store credit</span>
            <b>−{money(creditCents)}</b>
          </div>
        )}
        {promo.status === 'ok' && promo.discountCents > 0 && (
          <div className="co-trow co-trow--discount">
            <span>{promoLabel}</span>
            <b>−{money(promo.isFree ? DROP0_PRICE_CENTS : promo.discountCents)}</b>
          </div>
        )}
        <div className="co-trow">
          <span>Shipping</span>
          <b>Digital — no shipping</b>
        </div>
        <div className="co-trow co-trow--total">
          <span>Total</span>
          <b>{money(effectiveTotal)}</b>
        </div>
      </div>

      <div className="co-sum__fine">
        <span>
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="3" y="7" width="10" height="6.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
            <path d="M5.2 7V5.2a2.8 2.8 0 0 1 5.6 0V7" stroke="currentColor" strokeWidth="1.3" />
          </svg>
          256-bit encrypted · processed by Stripe
        </span>
        <span>
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 2 3 4v3.5C3 11 5.2 13.3 8 14c2.8-.7 5-3 5-6.5V4L8 2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
          </svg>
          Refundable until Drop 1 opens
        </span>
      </div>
    </div>
  )
}

// ── Inner form — inside <Elements>, calls useStripe / useElements ─────────────

interface InnerFormProps {
  name: string
  setName: (v: string) => void
  email: string
  setEmail: (v: string) => void
  nameErr: boolean
  setNameErr: (v: boolean) => void
  emailErr: boolean
  setEmailErr: (v: boolean) => void
  promoInput: string
  setPromoInput: (v: string) => void
  promo: PromoState
  setPromo: (v: PromoState) => void
  coState: CoState
  setCoState: (v: CoState) => void
  errorTitle: string
  setErrorTitle: (v: string) => void
  errorBody: string
  setErrorBody: (v: string) => void
  setSuccessMemberNo: (v: number) => void
  nextMemberNo: number
  effectiveTotal: number
}

function InnerForm({
  name, setName,
  email, setEmail,
  nameErr, setNameErr,
  emailErr, setEmailErr,
  promoInput, setPromoInput,
  promo, setPromo,
  coState, setCoState,
  errorTitle, setErrorTitle,
  errorBody, setErrorBody,
  setSuccessMemberNo,
  nextMemberNo,
  effectiveTotal,
}: InnerFormProps) {
  const stripe   = useStripe()
  const elements = useElements()

  // The Stripe webhook assigns the real member number asynchronously, so the
  // success screen polls /api/member-number until it sees the assigned value.
  // Falls through silently after a few seconds — the user still gets the
  // success UI; the number arrives by email.
  const pollAssignedNumber = async () => {
    for (let i = 0; i < 10; i++) {
      try {
        const r = await fetch('/api/member-number', { cache: 'no-store' })
        if (r.ok) {
          const d = await r.json()
          if (d.memberNumber != null) {
            setSuccessMemberNo(d.memberNumber)
            return
          }
        }
      } catch { /* keep polling */ }
      await new Promise((res) => setTimeout(res, 1500))
    }
  }

  const applyPromo = async () => {
    const code = promoInput.trim()
    if (!code) return
    setPromo({ status: 'validating', message: '', discountCents: 0, isFree: false })
    try {
      const res = await fetch('/api/payment-intent/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promoCode: code }),
      })
      const data = await res.json()
      if (res.ok && data.valid) {
        setPromo({
          status: 'ok',
          message: data.label,
          discountCents: data.discountCents ?? 0,
          isFree: (data.discountCents ?? 0) >= DROP0_PRICE_CENTS,
        })
      } else {
        setPromo({ status: 'err', message: data.error ?? 'That code is invalid.', discountCents: 0, isFree: false })
      }
    } catch {
      setPromo({ status: 'err', message: 'Could not validate — please try again.', discountCents: 0, isFree: false })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (coState === 'processing') return

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    setNameErr(!name.trim())
    setEmailErr(!emailOk)
    if (!name.trim() || !emailOk) return

    setCoState('processing')

    try {
      // Any path with a $0 effective total (free promo OR full credit cover)
      // skips Stripe entirely. Without this guard the paid path would clamp
      // amount to the Stripe 50¢ minimum and charge the user's card despite
      // the UI showing "$0".
      if (promo.isFree || effectiveTotal === 0) {
        const res = await fetch('/api/payment-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ promoCode: promoInput.trim() }),
        })
        const data = await res.json()
        if (!res.ok) {
          setErrorTitle('Order failed.')
          setErrorBody(data.error ?? 'Something went wrong. Please try again.')
          setCoState('error')
          return
        }
        setSuccessMemberNo(data.memberNumber ?? nextMemberNo)
        setCoState('success')
        return
      }

      // Paid path
      if (!stripe || !elements) {
        setErrorTitle('Payment unavailable.')
        setErrorBody(
          PK_LOOKS_REAL
            ? 'Stripe is still loading. Please wait a moment and try again.'
            : "Payments aren't configured for this site yet. Email caleb@chariotarchive.com to claim your spot."
        )
        setCoState('error')
        return
      }

      const { error: submitError } = await elements.submit()
      if (submitError) {
        setErrorTitle(submitError.message ?? 'Payment validation failed.')
        setErrorBody("Your card wasn't charged. Check the details and try again.")
        setCoState('error')
        return
      }

      const piRes = await fetch('/api/payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promoCode: promo.status === 'ok' ? promoInput.trim() : '' }),
      })
      const piData = await piRes.json()

      if (!piRes.ok || !piData.clientSecret) {
        setErrorTitle('Payment could not be started.')
        setErrorBody(piData.error ?? 'Please try again.')
        setCoState('error')
        return
      }

      const { error: confirmError } = await stripe.confirmPayment({
        elements,
        clientSecret: piData.clientSecret,
        confirmParams: {
          return_url: `${window.location.origin}/checkout?paid=1`,
          payment_method_data: { billing_details: { name: name.trim(), email: email.trim() } },
        },
        redirect: 'if_required',
      })

      if (confirmError) {
        setErrorTitle(confirmError.message ?? 'Payment failed.')
        setErrorBody("Your card wasn't charged. Check the details and try again.")
        setCoState('error')
        return
      }

      setCoState('success')
      pollAssignedNumber()
    } catch {
      setErrorTitle('Something went wrong.')
      setErrorBody('Unable to reach our payment processor. Please try again.')
      setCoState('error')
    }
  }

  return (
    <section className="co-form" aria-label="Checkout">
      <h1 className="co-form__title">Claim your spot.</h1>
      <p className="co-form__sub">
        Founding Member No.{' '}
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{pad3(nextMemberNo)}</span>
        {' '}of {DROP0_TOTAL}. Your number is permanent — assigned the moment payment clears.
      </p>

      {/* Error notice — CSS shows this when .co[data-state="error"] */}
      <div className="co-notice" role="alert" aria-live="assertive">
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.4" />
          <path d="M10 6v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="10" cy="13.6" r="0.9" fill="currentColor" />
        </svg>
        <div>
          <b>{errorTitle}</b>
          <p>{errorBody}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate>

        {/* ——— 01 · CONTACT ——— */}
        <div className="co-sec">
          <div className="co-sec__hd">
            <h2><span className="co-sec__n">01</span> Contact</h2>
            <span className="co-sec__note">For your number &amp; receipt</span>
          </div>
          <div className="co-grid2">
            <div className={`co-field co-field--full${nameErr ? ' is-invalid' : ''}`}>
              <label htmlFor="co-name">Full name</label>
              <input
                type="text"
                id="co-name"
                name="name"
                autoComplete="name"
                placeholder="Ama Owusu"
                value={name}
                onChange={e => { setName(e.target.value); if (nameErr) setNameErr(false) }}
                aria-invalid={nameErr}
                aria-describedby="co-err-name"
                required
              />
              <span className="co-field__err" id="co-err-name">Enter your full name.</span>
            </div>
            <div className={`co-field co-field--full${emailErr ? ' is-invalid' : ''}`}>
              <label htmlFor="co-email">Email</label>
              <input
                type="email"
                id="co-email"
                name="email"
                autoComplete="email"
                inputMode="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => { setEmail(e.target.value); if (emailErr) setEmailErr(false) }}
                aria-invalid={emailErr}
                aria-describedby="co-err-email"
                required
              />
              <span className="co-field__err" id="co-err-email">Enter a valid email address.</span>
            </div>
          </div>
        </div>

        {/* ——— 02 · DELIVERY ——— */}
        <div className="co-sec">
          <div className="co-sec__hd">
            <h2><span className="co-sec__n">02</span> Delivery</h2>
            <span className="co-sec__note">Digital — nothing ships</span>
          </div>
          <div className="co-digital-note">
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M3 6.5 10 11l7-4.5" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
              <rect x="3" y="5" width="14" height="10" rx="1" stroke="currentColor" strokeWidth="1.4" />
            </svg>
            <p>
              <b>Founding Member is digital.</b> Your number and welcome note arrive by email
              instantly — nothing ships now. Your physical hangtag travels on your first
              Drop&nbsp;1 piece in August.
            </p>
          </div>
        </div>

        {/* ——— 03 · PAYMENT ——— */}
        <div className="co-sec">
          <div className="co-sec__hd">
            <h2><span className="co-sec__n">03</span> Payment</h2>
            <span className="co-sec__note">Powered by Stripe</span>
          </div>

          {promo.isFree ? (
            <div className="co-free-notice">
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M5 10.5 9 14l6-8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.4" />
              </svg>
              <p>
                <b>No payment needed.</b>{' '}
                This code covers the full cost of your Founding Member spot.
              </p>
            </div>
          ) : (
            <>
              {/* Express pay row */}
              <div className="co-expay-wrap">
                <div className="co-expay-row">
                  <button type="button" className="co-expay co-expay--apple" aria-label="Pay with Apple Pay">
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M17.05 12.04c-.02-2.06 1.68-3.05 1.76-3.1-.96-1.4-2.46-1.6-2.99-1.62-1.27-.13-2.48.75-3.13.75-.64 0-1.64-.73-2.7-.71-1.39.02-2.67.81-3.38 2.05-1.44 2.5-.37 6.2 1.04 8.23.69 1 1.51 2.12 2.58 2.08 1.04-.04 1.43-.67 2.69-.67 1.25 0 1.61.67 2.71.65 1.12-.02 1.83-1.02 2.51-2.02.79-1.16 1.12-2.28 1.14-2.34-.03-.01-2.18-.84-2.2-3.33zM15 6.2c.57-.69.95-1.65.85-2.6-.82.03-1.81.54-2.4 1.23-.53.61-.99 1.59-.87 2.52.91.07 1.85-.46 2.42-1.15z" />
                    </svg>
                    <span>Pay</span>
                  </button>
                  <button type="button" className="co-expay co-expay--gpay" aria-label="Pay with Google Pay">
                    <svg viewBox="0 0 41 17" aria-hidden="true" height="18">
                      <path fill="#5f6368" d="M19.5 8.3v4.9h-1.6V1.2h4.1c1 0 1.9.3 2.6 1 .7.6 1.1 1.5 1.1 2.4 0 1-.4 1.8-1.1 2.5-.7.6-1.6 1-2.6 1h-2.5zm0-5.6v4.1h2.6c.6 0 1.1-.2 1.5-.6.8-.8.8-2 0-2.8-.4-.4-.9-.6-1.5-.7h-2.6z" />
                      <path fill="#5f6368" d="M30.3 4.5c1.2 0 2.1.3 2.8.9.7.6 1 1.5 1 2.6v5.2h-1.5v-1.2h-.1c-.7 1-1.5 1.4-2.6 1.4-1 0-1.7-.3-2.4-.8-.6-.6-.9-1.2-.9-2.1 0-.9.3-1.6 1-2.1.7-.5 1.6-.8 2.7-.8.9 0 1.7.2 2.3.5v-.4c0-.6-.2-1-.7-1.4-.4-.4-1-.6-1.6-.6-.9 0-1.6.4-2.1 1.1l-1.4-.9c.8-1.1 1.9-1.6 3.3-1.6zm-2.1 6.1c0 .4.2.8.5 1 .3.3.7.4 1.2.4.6 0 1.2-.2 1.7-.7.5-.5.8-1 .8-1.6-.5-.4-1.2-.6-2-.6-.6 0-1.2.2-1.6.5-.4.3-.6.6-.6 1.1z" />
                      <path fill="#5f6368" d="M41 4.7l-5 11.5h-1.6l1.9-4-3.3-7.5h1.7l2.4 5.7 2.3-5.7z" />
                      <path fill="#4285f4" d="M13.3 7.3c0-.5 0-1-.1-1.4H6.8v2.7h3.7c-.2.9-.6 1.6-1.4 2.1v1.8h2.3c1.3-1.2 2.1-3 2.1-5.2z" />
                      <path fill="#34a853" d="M6.8 14c1.9 0 3.5-.6 4.7-1.7l-2.3-1.8c-.6.4-1.4.7-2.4.7-1.9 0-3.4-1.3-4-3H.4v1.8C1.6 12.5 4 14 6.8 14z" />
                      <path fill="#fbbc04" d="M2.8 8.2c-.2-.5-.2-1-.2-1.6s.1-1.1.2-1.6V3.2H.4C-.1 4.3-.1 5.5-.1 6.6s0 2.3.5 3.4l2.4-1.8z" />
                      <path fill="#ea4335" d="M6.8 2.6c1.1 0 2 .4 2.8 1.1l2-2C10.3.5 8.7-.1 6.8-.1 4 0 1.6 1.5.4 3.8l2.4 1.8c.6-1.7 2.1-3 4-3z" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="co-ordiv">or pay with card</div>

              <div id="payment-element">
                <PaymentElement options={{ layout: 'accordion' }} />
              </div>
            </>
          )}

          {/* Promo code */}
          <div className="co-field co-field--full" style={{ marginTop: 22 }}>
            <label htmlFor="co-promo">
              Promo code{' '}
              <span style={{ textTransform: 'none', fontWeight: 400, color: 'var(--co-ink-35)' }}>
                (optional)
              </span>
            </label>
            <div className="co-promo">
              <input
                type="text"
                id="co-promo"
                placeholder="CODE"
                autoComplete="off"
                value={promoInput}
                onChange={e => setPromoInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyPromo() } }}
                aria-describedby="co-promo-msg"
                disabled={coState === 'processing'}
              />
              <button
                type="button"
                className="co-promo__btn"
                onClick={applyPromo}
                disabled={promo.status === 'validating' || coState === 'processing'}
              >
                {promo.status === 'validating' ? '…' : 'Apply'}
              </button>
            </div>
            {promo.status !== 'idle' && (
              <div
                id="co-promo-msg"
                className={[
                  'co-promo__msg',
                  promo.status === 'ok'  ? 'co-promo__msg--ok'  : '',
                  promo.status === 'err' ? 'co-promo__msg--err' : '',
                ].join(' ').trim()}
                role="status"
                aria-live="polite"
              >
                {promo.message}
              </div>
            )}
          </div>
        </div>

        {/* ——— PAY ——— */}
        <div className="co-pay-wrap">
          <button type="submit" className="co-cta" disabled={coState === 'processing'}>
            <span className="co-spin" aria-hidden="true" />
            <span className="co-cta-label">
              {promo.isFree
                ? 'Claim your spot — free'
                : `Claim your spot — ${money(effectiveTotal)}`}
            </span>
          </button>
          <p className="co-pay-note" style={{ textTransform: 'none', letterSpacing: '0.04em' }}>
            Refundable until Drop&nbsp;1 opens. By claiming you agree to Chariot&rsquo;s{' '}
            <Link href="/terms">terms</Link>.
          </p>
        </div>
      </form>
    </section>
  )
}

// ── Outer component — state owner, layout shell ───────────────────────────────

export default function CheckoutForm({ creditBalance, userEmail, nextMemberNo }: CheckoutFormProps) {
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState(userEmail)
  const [nameErr, setNameErr]   = useState(false)
  const [emailErr, setEmailErr] = useState(false)

  const [promoInput, setPromoInput] = useState('')
  const [promo, setPromo] = useState<PromoState>({
    status: 'idle', message: '', discountCents: 0, isFree: false,
  })

  const [coState, setCoState]       = useState<CoState>('editing')
  const [errorTitle, setErrorTitle] = useState('Payment failed.')
  const [errorBody, setErrorBody]   = useState("Your card wasn't charged. Check the details and try again.")
  const [successMemberNo, setSuccessMemberNo] = useState(nextMemberNo)
  const [msumOpen, setMsumOpen]     = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('paid') === '1') {
      setCoState('success')
      window.history.replaceState({}, '', '/checkout')
      // Redirect-based 3DS came back; fetch the assigned number so the success
      // card shows the real member number, not the page-load estimate.
      ;(async () => {
        for (let i = 0; i < 10; i++) {
          try {
            const r = await fetch('/api/member-number', { cache: 'no-store' })
            if (r.ok) {
              const d = await r.json()
              if (d.memberNumber != null) { setSuccessMemberNo(d.memberNumber); return }
            }
          } catch { /* keep polling */ }
          await new Promise((res) => setTimeout(res, 1500))
        }
      })()
    }
  }, [])

  useEffect(() => {
    if (coState === 'error' || coState === 'success') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [coState])

  const creditCents    = Math.min(creditBalance * 100, DROP0_PRICE_CENTS)
  const afterCredit    = DROP0_PRICE_CENTS - creditCents
  const effectiveTotal = promo.isFree ? 0 : Math.max(afterCredit - promo.discountCents, 0)
  const promoLabel     = promoInput.trim().toUpperCase()

  const elementsOptions = {
    mode: 'payment' as const,
    amount: Math.max(effectiveTotal, 50),
    currency: 'usd' as const,
    appearance: stripeAppearance,
  }

  const summaryProps: SummaryPanelProps = {
    nextMemberNo,
    creditCents,
    promo,
    promoLabel,
    effectiveTotal,
  }

  const handleBack = () => {
    if (window.history.length > 1) window.history.back()
    else window.location.href = '/'
  }

  return (
    <>
      {/* ===================== NAV ===================== */}
      <header className="co-nav">
        <div className="co-nav__in">
          <button className="co-nav__back" onClick={handleBack} aria-label="Back">
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M10 3 5 8l5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Back</span>
          </button>

          <Link href="/" aria-label="Chariot home" className="co-nav__home">
            <Image
              className="co-nav__logo"
              src="/chariot-wordmark.svg"
              alt="Chariot"
              width={176}
              height={40}
              priority
            />
          </Link>

          <span className="co-nav__secure">
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="3" y="7" width="10" height="6.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
              <path d="M5.2 7V5.2a2.8 2.8 0 0 1 5.6 0V7" stroke="currentColor" strokeWidth="1.3" />
            </svg>
            <span>Secure checkout</span>
          </span>
        </div>
      </header>

      <div className="co" data-state={coState}>

        {/* ===== MOBILE SUMMARY BAR ===== */}
        <div className={`msum${msumOpen ? ' is-open' : ''}`}>
          <button
            className="msum__bar"
            aria-expanded={msumOpen}
            aria-controls="msum-panel"
            onClick={() => setMsumOpen(o => !o)}
          >
            <span className="msum__l">
              <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M4 6.5 8 10l4-3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {msumOpen ? 'Hide order summary' : 'Show order summary'}
            </span>
            <span className="msum__r">{money(effectiveTotal)}</span>
          </button>
          {/* Mobile summary — shown inside collapsible bar */}
          <div className="msum__panel" id="msum-panel">
            <aside className="co-summary" aria-label="Order summary (mobile)">
              <SummaryPanel {...summaryProps} />
            </aside>
          </div>
        </div>

        {/* ===== TWO-COLUMN GRID ===== */}
        <div className="co-grid">
          <Elements stripe={stripePromise} options={elementsOptions}>
            <InnerForm
              name={name} setName={setName}
              email={email} setEmail={setEmail}
              nameErr={nameErr} setNameErr={setNameErr}
              emailErr={emailErr} setEmailErr={setEmailErr}
              promoInput={promoInput} setPromoInput={setPromoInput}
              promo={promo} setPromo={setPromo}
              coState={coState} setCoState={setCoState}
              errorTitle={errorTitle} setErrorTitle={setErrorTitle}
              errorBody={errorBody} setErrorBody={setErrorBody}
              setSuccessMemberNo={setSuccessMemberNo}
              nextMemberNo={nextMemberNo}
              effectiveTotal={effectiveTotal}
            />
          </Elements>

          {/* Desktop-only summary column — hidden on mobile via CSS */}
          <aside className="co-summary co-summary--desktop" aria-label="Order summary">
            <SummaryPanel {...summaryProps} />
          </aside>
        </div>

        {/* ===================== SUCCESS STATE ===================== */}
        <section className="co-success" aria-label="Order confirmed">
          <div className="co-succ__in">
            <div className="co-succ__seal">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 12.5 10 17l9-10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="co-eye co-succ__eye">You&rsquo;re in</span>
            <h2 className="co-succ__h">Welcome to the founding fifty.</h2>
            <p className="co-succ__no">
              Founding Member No.{' '}
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{pad3(successMemberNo)}</span>
            </p>
            <p className="co-succ__body">
              Your number is permanent — yours, in the order you joined. A receipt and welcome
              note are on their way to <b>{email || 'your inbox'}</b>. We&rsquo;ll email you the
              moment Drop&nbsp;1 opens, twenty-four hours before anyone else.
            </p>

            <div className="co-succ__tl">
              <div className="co-succ__step">
                <span className="co-succ__when">Now</span>
                <span className="co-succ__what">Your number is locked. Receipt sent.</span>
              </div>
              <div className="co-succ__step">
                <span className="co-succ__when">July</span>
                <span className="co-succ__what">Drop 1 opens — you go in at hour 00.</span>
              </div>
              <div className="co-succ__step">
                <span className="co-succ__when">August</span>
                <span className="co-succ__what">First pieces ship from Austin. Your hangtag rides along.</span>
              </div>
            </div>

            <div className="co-succ__cta">
              <Link href="/account" className="a-gold">View my account</Link>
              <Link href="/" className="a-ghost">Back to Chariot</Link>
            </div>
          </div>
        </section>

      </div>
    </>
  )
}
