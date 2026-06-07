import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { fulfillOrder } from '@/lib/order-fulfillment'
import { logAudit } from '@/lib/audit'
import { CONFIG } from '@/lib/config'

export const dynamic = 'force-dynamic'

// ============================================================
// Reconciliation job (§3.9). Scheduled via Vercel Cron (vercel.json).
// Idempotent and safe to run repeatedly (REC-4):
//   REC-3  pending orders past timeout -> failed
//   REC-1  Stripe succeeded PIs without a completed order -> fulfill
//   REC-2  recompute drifted balances from the ledger + alert
// ============================================================

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const admin = createAdminClient()
  const summary = { pendingFailed: 0, reconciled: 0, reconcileErrors: 0, driftCorrected: 0 }

  // ── REC-3: expire stale pending orders ───────────────────────────────────
  const cutoff = new Date(
    Date.now() - CONFIG.PENDING_ORDER_TIMEOUT_MINUTES * 60 * 1000
  ).toISOString()
  const { data: expired, error: expireErr } = await admin
    .from('orders')
    .update({ status: 'failed' })
    .eq('status', 'pending')
    .lt('created_at', cutoff)
    .select('id')
  if (expireErr) {
    await logAudit({ event: 'reconcile.pending_expire_failed', level: 'alert', detail: { message: expireErr.message } })
  } else {
    summary.pendingFailed = expired?.length ?? 0
  }

  // ── REC-1: fulfill Stripe-succeeded payments missing a completed order ────
  const sinceSecs = Math.floor(Date.now() / 1000) - CONFIG.RECONCILE_LOOKBACK_HOURS * 3600
  try {
    const pis = await stripe.paymentIntents.list({ created: { gte: sinceSecs }, limit: 100 })
    for (const pi of pis.data) {
      if (pi.status !== 'succeeded') continue
      const userId = pi.metadata?.user_id
      if (!userId) continue

      const { data: order } = await admin
        .from('orders')
        .select('id, status')
        .eq('stripe_payment_intent_id', pi.id)
        .maybeSingle()

      if (order?.status === 'completed') continue

      try {
        await fulfillOrder({
          userId,
          source: 'stripe',
          stripePaymentIntentId: pi.id,
          eventId: `reconcile:${pi.id}`,
          eventType: 'reconcile',
          emailOverride: pi.receipt_email,
        })
        summary.reconciled += 1
        await logAudit({
          event: 'reconcile.order_fulfilled',
          level: 'alert',
          userId,
          detail: { payment_intent: pi.id },
        })
      } catch (err) {
        summary.reconcileErrors += 1
        await logAudit({
          event: 'reconcile.fulfill_failed',
          level: 'alert',
          userId,
          detail: { payment_intent: pi.id, message: String(err) },
        })
      }
    }
  } catch (err) {
    await logAudit({ event: 'reconcile.stripe_list_failed', level: 'alert', detail: { message: String(err) } })
  }

  // ── REC-2: correct denormalized balance drift from the ledger ─────────────
  const { data: drift, error: driftErr } = await admin.rpc('detect_balance_drift')
  if (driftErr) {
    await logAudit({ event: 'reconcile.drift_detect_failed', level: 'alert', detail: { message: driftErr.message } })
  } else {
    for (const row of (drift ?? []) as { user_id: string; cache_cents: number; ledger_cents: number }[]) {
      await admin.rpc('recompute_credit_balance', { p_user_id: row.user_id })
      summary.driftCorrected += 1
      await logAudit({
        event: 'reconcile.balance_drift_corrected',
        level: 'alert',
        userId: row.user_id,
        detail: { cache_cents: row.cache_cents, ledger_cents: row.ledger_cents },
      })
    }
  }

  await logAudit({ event: 'reconcile.run_complete', level: 'info', detail: summary })
  return NextResponse.json({ ok: true, ...summary })
}
