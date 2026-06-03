import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fulfillOrder } from '@/lib/order-fulfillment'

const DROP0_PRICE_CENTS = parseInt(process.env.DROP0_PRICE_CENTS ?? '2000', 10)

export async function POST(request: Request) {
  const supabase = createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { promoCode } = await request.json()
  const cleanPromo = ((promoCode as string | null) ?? '').trim().toLowerCase()

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('users')
    .select('credit_balance')
    .eq('id', user.id)
    .single()

  const creditBalance = profile?.credit_balance ?? 0

  // Validate promo code
  let applyZarathustra = false
  if (cleanPromo) {
    const { data: promo } = await admin
      .from('promo_codes')
      .select('active, use_count, max_uses')
      .eq('code', cleanPromo)
      .single()

    if (!promo || !promo.active || promo.use_count >= promo.max_uses) {
      return NextResponse.json(
        { error: 'That promo code is invalid or has expired.' },
        { status: 400 }
      )
    }
    if (cleanPromo === 'zarathustra') applyZarathustra = true
  }

  // Zarathustra: free path — process order synchronously without Stripe
  if (applyZarathustra) {
    try {
      const result = await fulfillOrder({
        userId: user.id,
        promoCode: 'zarathustra',
        appliedCreditCents: 0,
        idempotencyKey: `zara:${user.id}`,
        emailOverride: user.email,
      })
      return NextResponse.json({ free: true, memberNumber: result.memberNumber })
    } catch (err) {
      console.error('[payment-intent] zarathustra fulfillment failed:', err)
      return NextResponse.json({ error: 'Order processing failed.' }, { status: 500 })
    }
  }

  // Compute amount after credit balance
  let amount = DROP0_PRICE_CENTS
  let appliedCreditCents = 0
  if (creditBalance > 0) {
    appliedCreditCents = Math.min(creditBalance * 100, DROP0_PRICE_CENTS)
    amount = DROP0_PRICE_CENTS - appliedCreditCents
  }

  // Create PaymentIntent
  try {
    const paymentIntent = await stripe.paymentIntents.create({
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

    return NextResponse.json({ clientSecret: paymentIntent.client_secret })
  } catch (err) {
    console.error('[payment-intent] create failed:', err)
    return NextResponse.json({ error: 'Could not start payment.' }, { status: 500 })
  }
}
