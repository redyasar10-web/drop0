import 'server-only'
import { stripe } from '@/lib/stripe'

// ============================================================
// Stripe Products + Prices sync (idempotent).
//
// Pattern:
//   1. Local DB is the source of truth — name, description, status.
//   2. Stripe is the price-of-record at checkout. When local price_cents
//      changes we create a NEW Stripe Price (Stripe prices are immutable)
//      and rotate stripe_price_id. The old Price stays archived so any
//      in-flight PaymentIntents keep working.
//   3. sku is the stable key in Stripe metadata for human reconciliation.
//
// Each helper is safe to call repeatedly: it short-circuits if the Stripe
// object already matches the local state.
// ============================================================

export type LocalProduct = {
  id: string
  sku: string
  name: string
  description: string | null
  status: 'draft' | 'active' | 'archived'
  price_cents: number
  currency: string
  stripe_product_id: string | null
  stripe_price_id: string | null
}

export type StripeSyncResult = {
  stripe_product_id: string
  stripe_price_id: string
  productChanged: boolean
  priceRotated: boolean
}

// ----- product -----------------------------------------------------------

function isStripeNotFound(err: unknown): boolean {
  const e = err as { code?: string; type?: string; statusCode?: number }
  return e?.code === 'resource_missing' || e?.statusCode === 404
}

async function createOrUpdateStripeProduct(p: LocalProduct): Promise<{ id: string; changed: boolean }> {
  if (p.stripe_product_id) {
    try {
      const existing = await stripe.products.retrieve(p.stripe_product_id)
      const needs =
        existing.name !== p.name ||
        (existing.description ?? null) !== (p.description ?? null) ||
        existing.active !== (p.status === 'active')
      if (!needs) return { id: existing.id, changed: false }

      await stripe.products.update(p.stripe_product_id, {
        name: p.name,
        description: p.description ?? undefined,
        active: p.status === 'active',
        metadata: { sku: p.sku, product_id: p.id },
      })
      return { id: existing.id, changed: true }
    } catch (err) {
      // Stripe object deleted out from under us — fall through to create a
      // fresh product. Surfaces a self-healing path for "stripe_product_id
      // is set in DB but archived/deleted in Stripe".
      if (!isStripeNotFound(err)) throw err
    }
  }

  const created = await stripe.products.create({
    name: p.name,
    description: p.description ?? undefined,
    active: p.status === 'active',
    metadata: { sku: p.sku, product_id: p.id },
  })
  return { id: created.id, changed: true }
}

// ----- price -------------------------------------------------------------

async function getActivePrice(stripeProductId: string, expectedCents: number, currency: string) {
  // Stripe prices are immutable, so the "current" price is the active price
  // attached to the product. We look it up and compare amount to decide
  // whether we need to mint a new one.
  const prices = await stripe.prices.list({
    product: stripeProductId,
    active: true,
    limit: 5,
  })
  return prices.data.find(
    (pr) => pr.unit_amount === expectedCents && pr.currency === currency,
  )
}

async function rotatePriceIfChanged(
  p: LocalProduct,
  stripeProductId: string,
  currentPriceId: string | null,
): Promise<{ id: string; rotated: boolean }> {
  if (currentPriceId) {
    try {
      const existing = await stripe.prices.retrieve(currentPriceId)
      if (
        existing.unit_amount === p.price_cents &&
        existing.currency === p.currency &&
        existing.active
      ) {
        return { id: currentPriceId, rotated: false }
      }
      // Same amount + currency but inactive (e.g. archived in dashboard) —
      // reactivate instead of minting a duplicate. Avoids cluttering Stripe
      // with prices that all map to the same dollar amount.
      if (
        existing.unit_amount === p.price_cents &&
        existing.currency === p.currency &&
        !existing.active
      ) {
        await stripe.prices.update(currentPriceId, { active: true })
        return { id: currentPriceId, rotated: false }
      }
      // Different price — archive old, mint new below.
      if (existing.active) {
        await stripe.prices.update(currentPriceId, { active: false })
      }
    } catch (err) {
      // Old price was deleted in Stripe — fall through and create fresh.
      if (!isStripeNotFound(err)) throw err
    }
  } else {
    const found = await getActivePrice(stripeProductId, p.price_cents, p.currency)
    if (found) return { id: found.id, rotated: true }
  }

  const created = await stripe.prices.create({
    product: stripeProductId,
    unit_amount: p.price_cents,
    currency: p.currency,
    metadata: { sku: p.sku, product_id: p.id },
  })
  return { id: created.id, rotated: true }
}

// ----- entry point -------------------------------------------------------

export async function syncProductToStripe(p: LocalProduct): Promise<StripeSyncResult> {
  if (p.price_cents <= 0) {
    throw new Error(`syncProductToStripe: price_cents must be > 0 (got ${p.price_cents})`)
  }

  const prod = await createOrUpdateStripeProduct(p)
  const price = await rotatePriceIfChanged(p, prod.id, p.stripe_price_id)

  return {
    stripe_product_id: prod.id,
    stripe_price_id: price.id,
    productChanged: prod.changed,
    priceRotated: price.rotated,
  }
}

// Archive (soft-delete) — keeps Stripe history intact, hides from new
// purchases. Called from the admin "archive" action.
export async function archiveProductOnStripe(stripeProductId: string): Promise<void> {
  await stripe.products.update(stripeProductId, { active: false })
}

// Probe whether the configured Stripe account is fully activated. Returns
// shape useful for an /api/admin/diagnostics route. Surfaces the exact
// blocker (e.g. "details_submitted: false") rather than a generic "no".
export async function probeStripeAccount() {
  // The newer Stripe SDK types make the no-arg form unavailable to
  // TS even though `GET /v1/account` works fine at runtime. Bypass
  // the typing by calling the typed helper through an unknown cast.
  const accountsApi = stripe.accounts as unknown as {
    retrieve: () => Promise<Awaited<ReturnType<typeof stripe.accounts.retrieve>>>
  }
  const acct = await accountsApi.retrieve()
  return {
    id: acct.id,
    livemode: !!(acct as { livemode?: boolean }).livemode,
    chargesEnabled: acct.charges_enabled,
    payoutsEnabled: acct.payouts_enabled,
    detailsSubmitted: acct.details_submitted,
    country: acct.country,
    defaultCurrency: acct.default_currency,
    requirements: acct.requirements ?? null,
  }
}
