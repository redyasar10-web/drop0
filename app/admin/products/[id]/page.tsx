import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin-guard'
import ProductForm from '../ProductForm'
import ResyncButton from './ResyncButton'

export const dynamic = 'force-dynamic'

export default async function EditProductPage({ params }: { params: { id: string } }) {
  await requireAdmin()
  const admin = createAdminClient()
  const [productRes, brandsRes, dropsRes] = await Promise.all([
    admin.from('products').select('*').eq('id', params.id).maybeSingle(),
    admin.from('brands').select('id, name').order('sort_order', { ascending: true }),
    admin.from('drops').select('id, name, number').order('number', { ascending: true }),
  ])

  if (!productRes.data) notFound()
  const p = productRes.data as {
    id: string; sku: string; slug: string; name: string;
    subtitle: string | null; description: string | null;
    brand_id: string | null; drop_id: string | null;
    price_cents: number; retail_cents: number | null; currency: string;
    status: 'draft' | 'active' | 'archived'; sort_order: number;
    stripe_product_id: string | null; stripe_price_id: string | null;
  }

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>{p.name}</h1>
          <p className="admin-head__sub">SKU <code>{p.sku}</code> · /{p.slug}</p>
        </div>
      </div>
      <div className="admin-card">
        <ProductForm
          mode="edit"
          initial={p}
          brands={brandsRes.data ?? []}
          drops={dropsRes.data ?? []}
        />
      </div>

      <div className="admin-card" style={{ marginTop: 24 }}>
        <h2 style={{ marginTop: 0 }}>Stripe sync state</h2>
        <dl className="admin-kv">
          <dt>Stripe product ID</dt><dd>{p.stripe_product_id ?? '— not synced —'}</dd>
          <dt>Stripe price ID</dt><dd>{p.stripe_price_id ?? '— not synced —'}</dd>
        </dl>
        <div style={{ marginTop: 18 }}>
          <ResyncButton id={p.id} />
        </div>
      </div>
    </>
  )
}
