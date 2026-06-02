'use server'

import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { stripe } from '@/lib/stripe'

export type CheckoutState = { error?: string } | null

const ZARATHUSTRA_COUPON_ID = 'zarathustra-founding-100off'

export async function createCheckoutSession(
  prevState: CheckoutState,
  formData: FormData
): Promise<CheckoutState> {
  const rawPromo = (formData.get('promo_code') as string | null) ?? ''
  const promoCode = rawPromo.trim().toLowerCase()

  const supabase = createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const admin = createAdminClient()

  // Fetch user profile for credit balance
  const { data: profile } = await admin
    .from('users')
    .select('credit_balance')
    .eq('id', user.id)
    .single()

  const creditBalance = profile?.credit_balance ?? 0

  // ── Validate promo code server-side ───────────────────────────────────────
  let applyZarathustra = false

  if (promoCode) {
    const { data: promo } = await admin
      .from('promo_codes')
      .select('active, use_count, max_uses')
      .eq('code', promoCode)
      .single()

    if (!promo || !promo.active || promo.use_count >= promo.max_uses) {
      return { error: 'That promo code is invalid or has expired.' }
    }

    if (promoCode === 'zarathustra') {
      applyZarathustra = true
      // Ensure the 100% coupon exists in Stripe (idempotent)
      try {
        await stripe.coupons.retrieve(ZARATHUSTRA_COUPON_ID)
      } catch {
        await stripe.coupons.create({
          id: ZARATHUSTRA_COUPON_ID,
          percent_off: 100,
          duration: 'once',
          name: 'Zarathustra — Founding Member',
          metadata: { managed_by: 'chariot' },
        })
      }
    }
  }

  const priceInCents = parseInt(process.env.DROP0_PRICE_CENTS ?? '2000')
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  // ── Apply store credit ────────────────────────────────────────────────────
  // Credits are not combinable with zarathustra (already 100% off).
  // Cap the discount so the order total never goes negative.
  let creditCouponId: string | undefined
  let appliedCreditCents = 0

  if (creditBalance > 0 && !applyZarathustra) {
    appliedCreditCents = Math.min(creditBalance * 100, priceInCents)

    const coupon = await stripe.coupons.create({
      amount_off: appliedCreditCents,
      currency: 'usd',
      duration: 'once',
      max_redemptions: 1,
      name: 'Chariot store credit',
    })
    creditCouponId = coupon.id
  }

  // ── Create Stripe Checkout session ────────────────────────────────────────
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: user.email ?? undefined,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Chariot Drop 0 — Founding Member',
            description:
              'Limited pre-order. Confirms your place and assigns your permanent member number.',
          },
          unit_amount: priceInCents,
        },
        quantity: 1,
      },
    ],
    discounts: applyZarathustra
      ? [{ coupon: ZARATHUSTRA_COUPON_ID }]
      : creditCouponId
      ? [{ coupon: creditCouponId }]
      : [],
    metadata: {
      user_id: user.id,
      promo_code: promoCode,
      applied_credit_cents: String(appliedCreditCents),
    },
    success_url: `${siteUrl}/account?order=confirmed`,
    cancel_url: `${siteUrl}/checkout`,
  })

  redirect(session.url!)
}
