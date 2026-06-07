import 'server-only'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, AdminAuthError } from '@/lib/admin-guard'
import { syncProductToStripe, type LocalProduct } from '@/lib/stripe-products'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Re-run the Stripe Product + Price sync for a single local product.
// Idempotent — used when the initial sync failed (network blip, Stripe
// rate limit) or after editing the local row while Stripe was down.
export async function POST(request: Request) {
  try { await requireAdmin() } catch (err) {
    if (err instanceof AdminAuthError) return NextResponse.json({ ok: false, error: err.message }, { status: err.statusCode })
    throw err
  }

  let body: { id?: string }
  try { body = await request.json() } catch { return NextResponse.json({ ok: false, error: 'Invalid JSON.' }, { status: 400 }) }
  const id = body?.id
  if (!id) return NextResponse.json({ ok: false, error: 'id is required.' }, { status: 400 })

  const admin = createAdminClient()
  const { data: product, error } = await admin
    .from('products')
    .select('*')
    .eq('id', id)
    .maybeSingle<LocalProduct & { id: string }>()
  if (error || !product) return NextResponse.json({ ok: false, error: 'Product not found.' }, { status: 404 })

  try {
    const result = await syncProductToStripe(product)
    if (result.productChanged || result.priceRotated) {
      await admin
        .from('products')
        .update({ stripe_product_id: result.stripe_product_id, stripe_price_id: result.stripe_price_id })
        .eq('id', id)
    }
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    )
  }
}
