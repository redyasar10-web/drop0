import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { fulfillOrder } from '@/lib/order-fulfillment'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig) {
    return new NextResponse('Missing stripe-signature header', { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('[webhook] signature verification failed:', err)
    return new NextResponse('Invalid signature', { status: 400 })
  }

  if (event.type !== 'payment_intent.succeeded') {
    return new NextResponse('OK', { status: 200 })
  }

  const pi = event.data.object as Stripe.PaymentIntent
  const userId = pi.metadata?.user_id

  if (!userId) {
    console.error('[webhook] payment_intent.succeeded missing user_id:', pi.id)
    return new NextResponse('Missing user_id in metadata', { status: 400 })
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
      emailOverride: pi.receipt_email,
    })
  } catch (err) {
    console.error('[webhook] fulfillOrder failed for PI:', pi.id, err)
    return new NextResponse('Order fulfillment failed', { status: 500 })
  }

  return new NextResponse('OK', { status: 200 })
}
