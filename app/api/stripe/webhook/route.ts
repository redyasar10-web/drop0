import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { fulfillOrder } from '@/lib/order-fulfillment'
import { logAudit } from '@/lib/audit'

// Stripe signature verification uses Node `crypto` — pin explicitly so a
// future Next default flip to Edge doesn't silently break webhooks.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig) {
    return new NextResponse('Missing stripe-signature header', { status: 400 })
  }

  // Secret rotation: Stripe permits up to 24h of overlap during rollover. The
  // SDK only accepts one secret per call, so iterate the active secrets. The
  // SDK's v1-only verification + 300s tolerance applies on every attempt.
  const activeSecrets = [
    process.env.STRIPE_WEBHOOK_SECRET,
    process.env.STRIPE_WEBHOOK_SECRET_PREV,
  ].filter((s): s is string => Boolean(s))

  if (activeSecrets.length === 0) {
    console.error('[webhook] no webhook secret configured')
    return new NextResponse('Server misconfigured', { status: 500 })
  }

  let event: Stripe.Event | null = null
  let lastErr: unknown = null
  for (const secret of activeSecrets) {
    try {
      event = stripe.webhooks.constructEvent(body, sig, secret)
      break
    } catch (err) {
      lastErr = err
    }
  }
  if (!event) {
    console.error('[webhook] signature verification failed:', lastErr)
    return new NextResponse('Invalid signature', { status: 400 })
  }

  if (event.type !== 'payment_intent.succeeded') {
    return new NextResponse('OK', { status: 200 })
  }

  const pi = event.data.object as Stripe.PaymentIntent
  const userId = pi.metadata?.user_id

  if (!userId) {
    // Returning 400 tells Stripe "permanent failure, stop retrying" — but the
    // PI itself may be a real, fulfilled charge for which we just lost the
    // metadata link. Acknowledge with 200 (so Stripe doesn't keep retrying a
    // genuinely unrecoverable event) and emit a high-severity audit row so the
    // reconcile job + ops can recover it.
    await logAudit({
      event: 'webhook.missing_user_id',
      level: 'alert',
      detail: { payment_intent: pi.id, amount_received: pi.amount_received },
    })
    return new NextResponse('Acknowledged (no metadata)', { status: 200 })
  }

  // Fulfillment is transactional, idempotent, and dedup'd by event.id inside
  // fulfill_order. Money fields (promo, applied credit) are read from the
  // server-stored order, never trusted from the PI metadata (PAY-1). If
  // fulfillment fails the txn rolls back and we return 500 so Stripe retries.
  try {
    await fulfillOrder({
      userId,
      source: 'stripe',
      stripePaymentIntentId: pi.id,
      eventId: event.id,
      eventType: event.type,
      // Pass the actual charged amount so the recovery branch in fulfill_order
      // (which inserts a placeholder order when the PI-creation insert was
      // lost) records the real charge instead of $0.00.
      amountChargedCents: pi.amount_received,
      appliedCreditCents:
        parseInt(pi.metadata?.applied_credit_cents ?? '0', 10) || 0,
      promoCode: pi.metadata?.promo_code || null,
      emailOverride: pi.receipt_email,
    })
  } catch (err) {
    console.error('[webhook] fulfillOrder failed for PI:', pi.id, err)
    return new NextResponse('Order fulfillment failed', { status: 500 })
  }

  return new NextResponse('OK', { status: 200 })
}
