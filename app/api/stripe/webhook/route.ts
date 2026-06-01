import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendOrderConfirmation } from '@/lib/email'

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

  if (event.type !== 'checkout.session.completed') {
    return new NextResponse('OK', { status: 200 })
  }

  const session = event.data.object as Stripe.Checkout.Session
  const userId = session.metadata?.user_id
  const promoCode = (session.metadata?.promo_code ?? '').trim().toLowerCase()
  const appliedCreditCents = parseInt(session.metadata?.applied_credit_cents ?? '0')
  const appliedCredit = Math.floor(appliedCreditCents / 100)

  if (!userId) {
    console.error('[webhook] checkout.session.completed missing user_id:', session.id)
    return new NextResponse('Missing user_id in metadata', { status: 400 })
  }

  const admin = createAdminClient()

  // ── 1. Fetch user first — need member_number to detect first purchase ─────
  const { data: user } = await admin
    .from('users')
    .select('email, credit_balance, referred_by, founder_status, referral_code, member_number')
    .eq('id', userId)
    .single()

  if (!user) {
    console.error('[webhook] user not found:', userId)
    return new NextResponse('User not found', { status: 404 })
  }

  const isFirstPurchase = user.member_number == null

  // ── 2. Assign member number (atomic + idempotent via Postgres function) ──
  const { data: memberNumber, error: rpcError } = await admin.rpc(
    'assign_member_number',
    { p_user_id: userId }
  )

  if (rpcError || memberNumber == null) {
    console.error('[webhook] assign_member_number failed:', rpcError)
    return new NextResponse('Member number assignment failed', { status: 500 })
  }

  // ── 3. Build credit and status updates ────────────────────────────────────
  const updates: Record<string, unknown> = {}
  let grantedFounderStatus = user.founder_status === true

  if (isFirstPurchase) {
    // Add the $30 base credit on top of any referral credits already held,
    // then deduct whatever was spent as a discount at this checkout.
    // Ceiling: $30 base + $15 max referral credits = $45.
    const newBalance = (user.credit_balance ?? 0) + 30 - appliedCredit
    updates.credit_balance = Math.max(0, newBalance)
  } else if (appliedCredit > 0) {
    // Subsequent purchase: just deduct used credits
    const newBalance = (user.credit_balance ?? 0) - appliedCredit
    updates.credit_balance = Math.max(0, newBalance)
  }

  // ── 4. Handle zarathustra promo ───────────────────────────────────────────
  if (promoCode === 'zarathustra') {
    const { data: redeemed } = await admin.rpc('redeem_promo_code', {
      p_code: 'zarathustra',
    })

    if (redeemed) {
      // Founder credit: always 30 (does not stack with the base credit above
      // because zarathustra bypasses normal checkout credit application)
      updates.credit_balance = 30
      updates.founder_status = true
      grantedFounderStatus = true
    }
  }

  // ── 5. Apply user updates ─────────────────────────────────────────────────
  if (Object.keys(updates).length > 0) {
    await admin.from('users').update(updates).eq('id', userId)
  }

  // ── 6. Credit referrer (if applicable, first purchase only) ──────────────
  if (isFirstPurchase && user.referred_by) {
    await creditReferrer({ admin, referralCode: user.referred_by, referredId: userId })
  }

  // ── 7. Send confirmation email ────────────────────────────────────────────
  const emailAddress = session.customer_email ?? user.email
  const finalCreditBalance = (updates.credit_balance as number | undefined)
    ?? user.credit_balance
    ?? 0

  if (emailAddress && user.referral_code) {
    try {
      await sendOrderConfirmation({
        to: emailAddress,
        memberNumber,
        isFounder: grantedFounderStatus,
        referralCode: user.referral_code,
        creditBalance: finalCreditBalance,
      })
    } catch (err) {
      // Email failure is non-fatal — log and continue
      console.error('[webhook] confirmation email failed:', err)
    }
  }

  return new NextResponse('OK', { status: 200 })
}

async function creditReferrer({
  admin,
  referralCode,
  referredId,
}: {
  admin: ReturnType<typeof import('@/lib/supabase/admin').createAdminClient>
  referralCode: string
  referredId: string
}) {
  // Find referrer by their referral code
  const { data: referrer } = await admin
    .from('users')
    .select('id, credit_balance')
    .eq('referral_code', referralCode)
    .single()

  if (!referrer) return

  // Idempotency: skip if referral already recorded and credited
  const { data: existing } = await admin
    .from('referrals')
    .select('credited')
    .eq('referrer_id', referrer.id)
    .eq('referred_id', referredId)
    .maybeSingle()

  if (existing?.credited) return

  // Enforce 3-referral cap
  const { count } = await admin
    .from('referrals')
    .select('*', { count: 'exact', head: true })
    .eq('referrer_id', referrer.id)
    .eq('credited', true)

  if ((count ?? 0) >= 3) return

  // Record referral (unique constraint prevents double-insert) and credit $5
  await admin.from('referrals').upsert(
    { referrer_id: referrer.id, referred_id: referredId, credited: true },
    { onConflict: 'referrer_id,referred_id' }
  )

  await admin
    .from('users')
    .update({ credit_balance: (referrer.credit_balance ?? 0) + 5 })
    .eq('id', referrer.id)
}
