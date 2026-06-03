import { createAdminClient } from '@/lib/supabase/admin'
import { sendOrderConfirmation } from '@/lib/email'

export interface FulfillOrderResult {
  memberNumber: number
  founderStatus: boolean
  creditBalance: number
}

/**
 * Called by both the Stripe webhook (paid path) and the payment-intent
 * API route (zarathustra free path). Never call this from client code.
 *
 * Idempotent: the first thing it does is claim `idempotencyKey` in
 * `fulfilled_orders`. Stripe delivers `payment_intent.succeeded` at-least-once
 * and retries on any non-2xx, so without this the incremental credit math would
 * be re-applied on every retry and corrupt balances. On a duplicate key it
 * returns the already-computed state without mutating anything.
 *
 * idempotencyKey: the PaymentIntent id for paid orders, `zara:<userId>` for the
 * zarathustra free path.
 */
export async function fulfillOrder({
  userId,
  promoCode,
  appliedCreditCents,
  idempotencyKey,
  emailOverride,
}: {
  userId: string
  promoCode: string           // lowercase, empty string if none
  appliedCreditCents: number  // cents already deducted as a discount at this payment
  idempotencyKey: string
  emailOverride?: string | null
}): Promise<FulfillOrderResult> {
  const admin = createAdminClient()
  const appliedCredit = Math.round(appliedCreditCents / 100)
  const isZarathustra = promoCode === 'zarathustra'

  // 0. Idempotency claim — exactly-once gate for all mutations below.
  const { error: claimError } = await admin
    .from('fulfilled_orders')
    .insert({ idempotency_key: idempotencyKey, user_id: userId })

  if (claimError) {
    // 23505 = unique_violation -> already fulfilled. Return current state, no mutation.
    if ((claimError as { code?: string }).code === '23505') {
      const { data: u } = await admin
        .from('users')
        .select('member_number, credit_balance, founder_status')
        .eq('id', userId)
        .single()
      return {
        memberNumber: u?.member_number ?? 0,
        founderStatus: u?.founder_status === true,
        creditBalance: u?.credit_balance ?? 0,
      }
    }
    throw new Error(`fulfillment idempotency claim failed: ${claimError.message}`)
  }

  // Helper: release the claim so a transient failure can be retried by Stripe.
  const releaseClaim = () =>
    admin.from('fulfilled_orders').delete().eq('idempotency_key', idempotencyKey)

  try {
    // 1. Zarathustra: redeem the promo FIRST (authoritative, atomic). Abort before
    //    assigning a member number if the code is exhausted/invalid.
    if (isZarathustra) {
      const { data: redeemed } = await admin.rpc('redeem_promo_code', { p_code: 'zarathustra' })
      if (!redeemed) {
        await releaseClaim()
        throw new Error('This promo code is no longer available.')
      }
    }

    // 2. Fetch user
    const { data: user } = await admin
      .from('users')
      .select('email, credit_balance, referred_by, founder_status, referral_code, member_number')
      .eq('id', userId)
      .single()

    if (!user) {
      await releaseClaim()
      throw new Error(`User not found: ${userId}`)
    }

    const isFirstPurchase = user.member_number == null

    // 3. Assign member number — idempotent RPC.
    const { data: memberNumber, error: rpcError } = await admin.rpc('assign_member_number', {
      p_user_id: userId,
    })
    if (rpcError || memberNumber == null) {
      await releaseClaim()
      throw new Error(`assign_member_number failed: ${rpcError?.message ?? 'null result'}`)
    }

    // 4. Compute updates
    const updates: Record<string, unknown> = {}
    let grantedFounderStatus = user.founder_status === true

    if (isZarathustra) {
      // Free founding spot: fixed grant (absolute, so idempotent by value).
      updates.credit_balance = 30
      updates.founder_status = true
      grantedFounderStatus = true
    } else if (isFirstPurchase) {
      // $30 base credit + any referral credits already held, minus discount applied.
      updates.credit_balance = Math.max(0, (user.credit_balance ?? 0) + 30 - appliedCredit)
    } else if (appliedCredit > 0) {
      updates.credit_balance = Math.max(0, (user.credit_balance ?? 0) - appliedCredit)
    }

    // 5. Apply user updates
    if (Object.keys(updates).length > 0) {
      await admin.from('users').update(updates).eq('id', userId)
    }

    // 6. Referral credit (first purchase only)
    if (isFirstPurchase && user.referred_by) {
      await creditReferrer({ admin, referralCode: user.referred_by, referredId: userId })
    }

    const finalCreditBalance =
      (updates.credit_balance as number | undefined) ?? user.credit_balance ?? 0
    const emailAddress = emailOverride ?? user.email

    // 7. Confirmation email — non-fatal
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
        console.error('[fulfillOrder] confirmation email failed:', err)
      }
    }

    return { memberNumber, founderStatus: grantedFounderStatus, creditBalance: finalCreditBalance }
  } catch (err) {
    // Any failure after the claim (other than the explicit releases above) must
    // release the claim so Stripe's retry can complete the order.
    try { await releaseClaim() } catch { /* ignore */ }
    throw err
  }
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
  const { data: referrer } = await admin
    .from('users')
    .select('id, credit_balance')
    .eq('referral_code', referralCode)
    .single()

  if (!referrer) return

  // No self-referral — a user cannot credit themselves.
  if (referrer.id === referredId) return

  // Idempotency guard
  const { data: existing } = await admin
    .from('referrals')
    .select('credited')
    .eq('referrer_id', referrer.id)
    .eq('referred_id', referredId)
    .maybeSingle()

  if (existing?.credited) return

  // Cap at 3 credited referrals
  const { count } = await admin
    .from('referrals')
    .select('*', { count: 'exact', head: true })
    .eq('referrer_id', referrer.id)
    .eq('credited', true)

  if ((count ?? 0) >= 3) return

  await admin.from('referrals').upsert(
    { referrer_id: referrer.id, referred_id: referredId, credited: true },
    { onConflict: 'referrer_id,referred_id' }
  )

  await admin
    .from('users')
    .update({ credit_balance: (referrer.credit_balance ?? 0) + 5 })
    .eq('id', referrer.id)
}
