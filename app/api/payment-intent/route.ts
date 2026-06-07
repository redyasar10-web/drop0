import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fulfillOrder } from '@/lib/order-fulfillment'
import { checkAuthRateLimit } from '@/lib/rate-limit'
import { CONFIG } from '@/lib/config'

const FOUNDING_ITEMS = [{ sku: 'founding-member', qty: 1 }]

export async function POST(request: Request) {
  const supabase = createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Without this an attacker can flood Stripe with PI creates from one
  // account; also damps free-promo double-click spurious-500 retries below.
  if (!(await checkAuthRateLimit('payment_intent', user.id))) {
    return NextResponse.json(
      { error: 'Too many attempts. Please wait a minute and try again.' },
      { status: 429 }
    )
  }

  const { promoCode } = await request.json()
  const cleanPromo = ((promoCode as string | null) ?? '').trim().toLowerCase()

  const admin = createAdminClient()

  // FM-4 — refuse before any charge once all 50 founding numbers are assigned.
  // member_sequence.next_number is the next number to hand out; > 50 means sold out.
  const { data: seq } = await admin
    .from('member_sequence')
    .select('next_number')
    .eq('id', 1)
    .single()
  if ((seq?.next_number ?? 1) > CONFIG.TOTAL_FOUNDING_SPOTS) {
    return NextResponse.json(
      { error: 'All founding member spots have been claimed.', soldOut: true },
      { status: 409 }
    )
  }

  // Available credit is ledger-derived (BAL-2/BAL-5): SUM(credit_events) in cents.
  const { data: balanceCents } = await admin.rpc('available_balance', { p_user_id: user.id })
  const availableCreditCents = (balanceCents as number | null) ?? 0

  // Validate promo code (server-side; client never determines validity — PROMO-1).
  // Case-insensitive so user typing ZARATHUSTRA / Zarathustra both work.
  let applyZarathustra = false
  if (cleanPromo) {
    const { data: promo, error: promoErr } = await admin
      .from('promo_codes')
      .select('code, active, use_count, max_uses')
      .ilike('code', cleanPromo)
      .maybeSingle()

    if (promoErr) {
      console.error('[payment-intent] promo lookup failed:', promoErr)
      return NextResponse.json(
        { error: 'Could not validate promo code — please try again.' },
        { status: 500 }
      )
    }
    if (!promo || !promo.active || promo.use_count >= promo.max_uses) {
      return NextResponse.json(
        { error: 'That promo code is invalid or has expired.' },
        { status: 400 }
      )
    }
    if ((promo.code ?? '').toLowerCase() === 'zarathustra') applyZarathustra = true
  }

  // Zarathustra: free path — fulfilled synchronously through the shared,
  // transactional fulfill_order (PAY-7). The order row is created inside it.
  if (applyZarathustra) {
    // Optimistic short-circuit on retry: a double-click would otherwise race
    // into fulfill_order, hit the orders_one_promo_per_user unique index, and
    // surface a spurious 500 to the second click even though the first
    // succeeded. Resolve from the existing completed order instead.
    const { data: existing } = await admin
      .from('orders')
      .select('status')
      .eq('user_id', user.id)
      .eq('source', 'promo_zarathustra')
      .maybeSingle()
    if (existing?.status === 'completed') {
      const { data: prof } = await admin
        .from('users')
        .select('member_number')
        .eq('id', user.id)
        .maybeSingle()
      return NextResponse.json({ free: true, memberNumber: prof?.member_number ?? null })
    }

    try {
      const result = await fulfillOrder({
        userId: user.id,
        source: 'promo_zarathustra',
        promoCode: 'zarathustra',
        emailOverride: user.email,
      })
      return NextResponse.json({ free: true, memberNumber: result.memberNumber })
    } catch (err: unknown) {
      // Postgres unique_violation (23505) means a parallel call beat us to
      // creating the single allowed promo order — that's a retry, not a
      // failure. Look up the now-existing record and return idempotently.
      const code = (err as { code?: string })?.code
      const msg = (err as { message?: string })?.message ?? ''
      if (code === '23505' || msg.includes('orders_one_promo_per_user')) {
        const { data: prof } = await admin
          .from('users')
          .select('member_number')
          .eq('id', user.id)
          .maybeSingle()
        return NextResponse.json({ free: true, memberNumber: prof?.member_number ?? null })
      }
      console.error('[payment-intent] zarathustra fulfillment failed:', err)
      return NextResponse.json({ error: 'Order processing failed.' }, { status: 500 })
    }
  }

  // Compute amount server-side from price minus available credit (PAY-1, BAL-5).
  const appliedCreditCents = Math.min(Math.max(availableCreditCents, 0), CONFIG.DROP0_PRICE_CENTS)
  const amount = CONFIG.DROP0_PRICE_CENTS - appliedCreditCents

  // Create PaymentIntent, then record the order row at PI-creation (LED-1).
  let paymentIntent
  try {
    paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      receipt_email: user.email ?? undefined,
      metadata: {
        user_id: user.id,
        promo_code: cleanPromo,
        applied_credit_cents: String(appliedCreditCents),
      },
    })
  } catch (err) {
    console.error('[payment-intent] create failed:', err)
    return NextResponse.json({ error: 'Could not start payment.' }, { status: 500 })
  }

  // LED-1 — append the pending order. Money fields are server-authoritative and
  // are what fulfillment reads later (not the PI metadata). Non-fatal on failure:
  // fulfill_order will defensively create the order if this insert was lost.
  const { error: orderErr } = await admin.from('orders').insert({
    user_id: user.id,
    status: 'pending',
    amount_charged_cents: amount,
    list_price_cents: CONFIG.DROP0_PRICE_CENTS,
    credit_applied_cents: appliedCreditCents,
    promo_code: cleanPromo || null,
    source: 'stripe',
    stripe_payment_intent_id: paymentIntent.id,
    items: FOUNDING_ITEMS,
  })
  if (orderErr) {
    console.error('[payment-intent] pending order insert failed:', orderErr.message)
  }

  return NextResponse.json({ clientSecret: paymentIntent.client_secret })
}
