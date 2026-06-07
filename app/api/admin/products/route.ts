import 'server-only'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, AdminAuthError } from '@/lib/admin-guard'
import { syncProductToStripe, archiveProductOnStripe, type LocalProduct } from '@/lib/stripe-products'
import { logAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ============================================================
// /api/admin/products
//
//   GET   — list all products (admin sees draft + archived too)
//   POST  — create a product + sync to Stripe
//   PATCH — update fields + re-sync to Stripe if price/name/status changed
//   DELETE — soft-archive (no hard delete; preserves order history FK)
//
// All writes go through the service-role admin client (RLS bypassed). The
// admin guard runs FIRST so unauthenticated requests don't even touch the DB.
// Stripe sync is best-effort: if Stripe fails, the local row stays and we
// surface the error so the operator can retry the sync.
// ============================================================

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 })
}
function authErrorToResponse(err: unknown): NextResponse | null {
  if (err instanceof AdminAuthError) {
    return NextResponse.json({ ok: false, error: err.message }, { status: err.statusCode })
  }
  return null
}

// Origin check — SameSite=Lax already blocks cross-origin POST cookie auth,
// but this is a cheap defence-in-depth in case of a same-site XSS.
function originAllowed(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return true  // Same-origin browser fetch + non-browser tools
  const expected = process.env.NEXT_PUBLIC_SITE_URL
  if (!expected) return true  // Dev/preview without SITE_URL set
  try {
    return new URL(origin).origin === new URL(expected).origin
  } catch {
    return false
  }
}

// Only allow relative same-origin paths OR https:// URLs for product images.
// Without this, an admin could store `javascript:alert(1)` or a tracking
// pixel URL that fires on render. Defence in depth — not exploitable today
// since the admin is a trusted role.
function safeImageUrl(raw: string | null): string | null {
  if (raw == null || !raw) return null
  if (raw.startsWith('/')) {
    if (raw.startsWith('//')) return null  // protocol-relative
    return raw
  }
  try {
    const u = new URL(raw)
    return u.protocol === 'https:' ? u.toString() : null
  } catch {
    return null
  }
}

type CreateBody = {
  sku: string
  slug: string
  name: string
  subtitle?: string
  description?: string
  brand_id?: string | null
  drop_id?: string | null
  price_cents: number
  retail_cents?: number | null
  currency?: string
  status?: 'draft' | 'active' | 'archived'
  sort_order?: number
  metadata?: Record<string, unknown>
  primary_image_url?: string | null
  primary_image_alt?: string | null
}

function coerceCreate(raw: unknown): { ok: true; body: CreateBody } | { ok: false; error: string } {
  if (typeof raw !== 'object' || !raw) return { ok: false, error: 'Body must be a JSON object.' }
  const r = raw as Record<string, unknown>
  const sku = typeof r.sku === 'string' ? r.sku.trim() : ''
  const slug = typeof r.slug === 'string' ? r.slug.trim() : ''
  const name = typeof r.name === 'string' ? r.name.trim() : ''
  const price_cents = typeof r.price_cents === 'number' ? Math.round(r.price_cents) : NaN
  if (!sku || sku.length > 64) return { ok: false, error: 'sku is required (≤64 chars).' }
  if (!slug || slug.length > 96) return { ok: false, error: 'slug is required (≤96 chars).' }
  if (!name || name.length > 200) return { ok: false, error: 'name is required (≤200 chars).' }
  // > 0 not ≥ 0 — Stripe does not accept zero-amount prices, so a 0 here
  // would create a DB row that can never be synced to Stripe. Better to
  // reject at the boundary than leave the row in a permanently broken
  // state.
  if (!Number.isFinite(price_cents) || price_cents <= 0) return { ok: false, error: 'price_cents must be > 0.' }
  const status = r.status === 'active' || r.status === 'archived' ? r.status : 'draft'
  return {
    ok: true,
    body: {
      sku, slug, name, price_cents, status,
      subtitle:     typeof r.subtitle    === 'string' ? r.subtitle.trim().slice(0, 200) : undefined,
      description:  typeof r.description === 'string' ? r.description.trim().slice(0, 4000) : undefined,
      brand_id:     typeof r.brand_id    === 'string' ? r.brand_id : null,
      drop_id:      typeof r.drop_id     === 'string' ? r.drop_id  : null,
      retail_cents: typeof r.retail_cents === 'number' ? Math.round(r.retail_cents) : null,
      currency:     typeof r.currency    === 'string' && /^[a-z]{3}$/.test(r.currency) ? r.currency : 'usd',
      sort_order:   typeof r.sort_order  === 'number' ? Math.round(r.sort_order) : 100,
      metadata:     typeof r.metadata    === 'object' && r.metadata ? r.metadata as Record<string, unknown> : {},
      primary_image_url: safeImageUrl(typeof r.primary_image_url === 'string' ? r.primary_image_url.trim() : null),
      primary_image_alt: typeof r.primary_image_alt === 'string' ? r.primary_image_alt.trim() : null,
    },
  }
}

// ----- GET ---------------------------------------------------------------

export async function GET() {
  try { await requireAdmin() } catch (err) { const r = authErrorToResponse(err); if (r) return r; throw err }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('products')
    .select(`
      id, sku, slug, name, subtitle, description,
      brand_id, drop_id, price_cents, retail_cents, currency,
      status, sort_order, stripe_product_id, stripe_price_id,
      metadata, created_at, updated_at,
      brands ( id, name, slug ),
      drops  ( id, name, slug, number ),
      product_images ( id, url, alt, sort_order, is_primary )
    `)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[admin/products] list failed:', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, products: data })
}

// ----- POST --------------------------------------------------------------

export async function POST(request: Request) {
  if (!originAllowed(request)) return NextResponse.json({ ok: false, error: 'Forbidden origin' }, { status: 403 })
  let actor
  try { actor = await requireAdmin() } catch (err) { const r = authErrorToResponse(err); if (r) return r; throw err }

  let raw: unknown
  try { raw = await request.json() } catch { return badRequest('Invalid JSON body.') }
  const parsed = coerceCreate(raw)
  if (!parsed.ok) return badRequest(parsed.error)
  const body = parsed.body

  const admin = createAdminClient()

  const { data: created, error: createErr } = await admin
    .from('products')
    .insert({
      sku: body.sku, slug: body.slug, name: body.name,
      subtitle: body.subtitle, description: body.description,
      brand_id: body.brand_id, drop_id: body.drop_id,
      price_cents: body.price_cents, retail_cents: body.retail_cents,
      currency: body.currency, status: body.status, sort_order: body.sort_order,
      metadata: body.metadata,
    })
    .select('*')
    .single<LocalProduct & { id: string }>()

  if (createErr || !created) {
    console.error('[admin/products] insert failed:', createErr)
    return NextResponse.json(
      { ok: false, error: createErr?.message ?? 'Insert failed.' },
      { status: 500 },
    )
  }

  // Optional primary image. Catches the partial-unique-violation (23505) on
  // product_images_one_primary if a parallel POST already inserted a primary.
  if (body.primary_image_url) {
    const { error: imgErr } = await admin.from('product_images').insert({
      product_id: created.id,
      url: body.primary_image_url,
      alt: body.primary_image_alt,
      is_primary: true,
      sort_order: 1,
    })
    if (imgErr && imgErr.code !== '23505') {
      // Other errors are non-fatal: the product row exists; the operator
      // can add an image later from the edit page.
      console.error('[admin/products] primary image insert failed:', imgErr.message)
    }
  }

  // Stripe sync (best-effort, non-fatal).
  let stripeSync: { stripe_product_id: string; stripe_price_id: string } | null = null
  let stripeError: string | null = null
  try {
    const result = await syncProductToStripe(created)
    await admin
      .from('products')
      .update({ stripe_product_id: result.stripe_product_id, stripe_price_id: result.stripe_price_id })
      .eq('id', created.id)
    stripeSync = { stripe_product_id: result.stripe_product_id, stripe_price_id: result.stripe_price_id }
  } catch (err) {
    stripeError = err instanceof Error ? err.message : String(err)
    console.error('[admin/products] Stripe sync failed:', stripeError)
  }

  await logAudit({
    event: 'admin.product_created',
    level: 'info',
    userId: actor.id,
    detail: { product_id: created.id, sku: created.sku, stripe_error: stripeError },
  })

  return NextResponse.json({
    ok: true,
    product: { ...created, ...(stripeSync ?? {}) },
    stripe_error: stripeError,
  })
}

// ----- PATCH -------------------------------------------------------------

type PatchBody = Partial<CreateBody> & { id: string }

export async function PATCH(request: Request) {
  if (!originAllowed(request)) return NextResponse.json({ ok: false, error: 'Forbidden origin' }, { status: 403 })
  let actor
  try { actor = await requireAdmin() } catch (err) { const r = authErrorToResponse(err); if (r) return r; throw err }

  let raw: unknown
  try { raw = await request.json() } catch { return badRequest('Invalid JSON body.') }
  if (typeof raw !== 'object' || !raw) return badRequest('Body must be a JSON object.')
  const r = raw as Record<string, unknown>
  const id = typeof r.id === 'string' ? r.id : ''
  if (!id) return badRequest('id is required.')

  const admin = createAdminClient()
  const { data: existing, error: lookupErr } = await admin
    .from('products')
    .select('*')
    .eq('id', id)
    .single<LocalProduct & { id: string }>()
  if (lookupErr || !existing) return NextResponse.json({ ok: false, error: 'Product not found.' }, { status: 404 })

  const patch: Record<string, unknown> = {}
  if (typeof r.name === 'string')          patch.name = r.name.trim().slice(0, 200)
  if (typeof r.subtitle === 'string')      patch.subtitle = r.subtitle.trim().slice(0, 200)
  if (typeof r.description === 'string')   patch.description = r.description.trim().slice(0, 4000)
  if (typeof r.price_cents === 'number') {
    // Mirror the POST constraint: zero or negative would leave the row
    // permanently un-syncable to Stripe.
    const cents = Math.round(r.price_cents)
    if (cents <= 0) return badRequest('price_cents must be > 0.')
    patch.price_cents = cents
  }
  // Allow explicit null to CLEAR the retail price (admin removes the
  // strikethrough). typeof null === 'object' so the prior `=== 'number'`
  // check silently dropped the clear.
  if (typeof r.retail_cents === 'number')  patch.retail_cents = Math.max(0, Math.round(r.retail_cents))
  else if (r.retail_cents === null)        patch.retail_cents = null
  if (r.status === 'draft' || r.status === 'active' || r.status === 'archived') patch.status = r.status
  if (typeof r.sort_order === 'number')    patch.sort_order = Math.round(r.sort_order)
  if (typeof r.brand_id === 'string' || r.brand_id === null) patch.brand_id = r.brand_id
  if (typeof r.drop_id === 'string'  || r.drop_id === null)  patch.drop_id = r.drop_id

  if (Object.keys(patch).length === 0) return badRequest('No updatable fields supplied.')

  const { data: updated, error: updateErr } = await admin
    .from('products')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single<LocalProduct & { id: string }>()
  if (updateErr || !updated) {
    return NextResponse.json({ ok: false, error: updateErr?.message ?? 'Update failed.' }, { status: 500 })
  }

  // Re-sync Stripe (idempotent — no-ops if nothing material changed).
  let stripeError: string | null = null
  try {
    const result = await syncProductToStripe(updated)
    if (result.productChanged || result.priceRotated) {
      await admin
        .from('products')
        .update({ stripe_product_id: result.stripe_product_id, stripe_price_id: result.stripe_price_id })
        .eq('id', updated.id)
    }
  } catch (err) {
    stripeError = err instanceof Error ? err.message : String(err)
  }

  await logAudit({
    event: 'admin.product_updated',
    level: 'info',
    userId: actor.id,
    detail: { product_id: updated.id, sku: updated.sku, stripe_error: stripeError, fields: Object.keys(patch) },
  })

  return NextResponse.json({ ok: true, product: updated, stripe_error: stripeError })
}

// ----- DELETE (soft archive) ---------------------------------------------

export async function DELETE(request: Request) {
  if (!originAllowed(request)) return NextResponse.json({ ok: false, error: 'Forbidden origin' }, { status: 403 })
  let actor
  try { actor = await requireAdmin() } catch (err) { const r = authErrorToResponse(err); if (r) return r; throw err }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return badRequest('id query param is required.')

  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('products')
    .select('id, sku, stripe_product_id')
    .eq('id', id)
    .maybeSingle()
  if (!existing) return NextResponse.json({ ok: false, error: 'Product not found.' }, { status: 404 })

  const { error } = await admin
    .from('products')
    .update({ status: 'archived' })
    .eq('id', id)
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  if (existing.stripe_product_id) {
    try { await archiveProductOnStripe(existing.stripe_product_id) } catch (err) {
      console.error('[admin/products] Stripe archive failed (soft-continuing):', err)
    }
  }

  await logAudit({
    event: 'admin.product_archived',
    level: 'info',
    userId: actor.id,
    detail: { product_id: id, sku: existing.sku },
  })

  return NextResponse.json({ ok: true })
}
