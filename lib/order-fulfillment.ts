import { createAdminClient } from '@/lib/supabase/admin'
import { sendOrderConfirmation } from '@/lib/email'
import { logAudit } from '@/lib/audit'

export interface FulfillOrderResult {
  memberNumber: number
  founderStatus: boolean
  creditBalanceCents: number
}

type FulfillOrderInput = {
  userId: string
  source: 'stripe' | 'promo_zarathustra'
  stripePaymentIntentId?: string | null
  eventId?: string | null        // Stripe event.id — webhook dedup (PAY-3)
  eventType?: string | null
  promoCode?: string | null      // free path only; paid path reads it from the order
  // Money fields used ONLY by the recovery branch in fulfill_order (where the
  // PI-creation order insert was lost and the function must defensively
  // create the order row from webhook data). On the normal path, the existing
  // order row's values are used and these are ignored.
  amountChargedCents?: number | null
  appliedCreditCents?: number | null
  emailOverride?: string | null
}

type FulfillRpcResult = {
  already_processed: boolean
  member_number: number
  founder_status: boolean
  credit_balance: number
  email: string | null
  referral_code: string | null
}

/**
 * Shared fulfillment entry point for BOTH the Stripe webhook (paid) and the
 * zarathustra free path. All money/identity side effects run inside a single
 * DB transaction in the Postgres function `fulfill_order` (fail closed,
 * idempotent). This wrapper only invokes that function and, after it commits,
 * sends the confirmation email — which is non-fatal and never rolls back
 * fulfillment (PAY-8, EMAIL-5). Never call from client code.
 */
export async function fulfillOrder(input: FulfillOrderInput): Promise<FulfillOrderResult> {
  const admin = createAdminClient()

  const { data, error } = await admin.rpc('fulfill_order', {
    p_user_id: input.userId,
    p_source: input.source,
    p_stripe_payment_intent_id: input.stripePaymentIntentId ?? null,
    p_event_id: input.eventId ?? null,
    p_event_type: input.eventType ?? null,
    p_promo_code: input.promoCode ?? null,
    p_amount_charged_cents: input.amountChargedCents ?? null,
    p_applied_credit_cents: input.appliedCreditCents ?? null,
  })

  if (error || !data) {
    throw new Error(`fulfill_order failed: ${error?.message ?? 'null result'}`)
  }

  const result = data as FulfillRpcResult

  // Audit the fulfillment that actually completed the order (NF-6). No sensitive data.
  if (!result.already_processed) {
    await logAudit({
      event: 'order.fulfilled',
      level: 'info',
      userId: input.userId,
      detail: {
        source: input.source,
        member_number: result.member_number,
        founder: result.founder_status,
      },
    })
  }

  // Confirmation email — only on the run that actually completed the order
  // (avoids duplicate emails on webhook retries). Failure is logged, not fatal.
  const emailAddress = input.emailOverride ?? result.email
  if (!result.already_processed && emailAddress && result.referral_code) {
    try {
      await sendOrderConfirmation({
        to: emailAddress,
        memberNumber: result.member_number,
        isFounder: result.founder_status,
        referralCode: result.referral_code,
        // RPC returns cents; the email displays whole dollars.
        creditBalance: Math.floor(result.credit_balance / 100),
      })
    } catch (err) {
      console.error('[fulfillOrder] confirmation email failed:', err)
    }
  }

  return {
    memberNumber: result.member_number,
    founderStatus: result.founder_status,
    creditBalanceCents: result.credit_balance,
  }
}
