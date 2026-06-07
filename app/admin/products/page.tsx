import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin-guard'
import ArchiveButton from './ArchiveButton'

export const dynamic = 'force-dynamic'

type ProductRow = {
  id: string
  sku: string
  slug: string
  name: string
  price_cents: number
  retail_cents: number | null
  currency: string
  status: 'draft' | 'active' | 'archived'
  sort_order: number
  stripe_product_id: string | null
  stripe_price_id: string | null
  brands: { name: string | null } | null
  drops:  { name: string | null; number: number | null } | null
  product_images: { url: string; is_primary: boolean }[] | null
}

function money(cents: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase(), maximumFractionDigits: 2 })
    .format(cents / 100)
}

export default async function ProductsAdminPage() {
  await requireAdmin()
  const admin = createAdminClient()
  const { data: products } = await admin
    .from('products')
    .select(`
      id, sku, slug, name, price_cents, retail_cents, currency,
      status, sort_order, stripe_product_id, stripe_price_id,
      brands ( name ),
      drops  ( name, number ),
      product_images ( url, is_primary )
    `)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })
    .returns<ProductRow[]>()

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Products</h1>
          <p className="admin-head__sub">
            Edits sync to Stripe automatically. Price changes mint a new Stripe Price; the old one is archived.
          </p>
        </div>
        <Link href="/admin/products/new" className="admin-btn">+ New product</Link>
      </div>

      {!products || products.length === 0 ? (
        <div className="admin-card admin-empty">
          <p>No products yet.</p>
          <Link href="/admin/products/new" className="admin-btn">Add your first product</Link>
        </div>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th></th>
              <th>Name</th>
              <th>SKU</th>
              <th>Brand</th>
              <th>Drop</th>
              <th>Price</th>
              <th>Status</th>
              <th>Stripe</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const img = p.product_images?.find((i) => i.is_primary) ?? p.product_images?.[0]
              return (
                <tr key={p.id}>
                  <td>{img && <img className="admin-thumb" src={img.url} alt="" />}</td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--ad-fg-2)' }}>/{p.slug}</div>
                  </td>
                  <td><code style={{ fontSize: 12 }}>{p.sku}</code></td>
                  <td>{p.brands?.name ?? '—'}</td>
                  <td>{p.drops?.name ?? '—'}</td>
                  <td>
                    <div>{money(p.price_cents, p.currency)}</div>
                    {p.retail_cents != null && p.retail_cents > p.price_cents && (
                      <div style={{ fontSize: 11, color: 'var(--ad-fg-2)', textDecoration: 'line-through' }}>
                        {money(p.retail_cents, p.currency)}
                      </div>
                    )}
                  </td>
                  <td><span className={`admin-status admin-status--${p.status}`}>{p.status}</span></td>
                  <td>
                    {p.stripe_product_id ? (
                      <span title={p.stripe_product_id} style={{ fontSize: 11, fontFamily: 'Menlo, monospace' }}>
                        {p.stripe_product_id.slice(0, 10)}…
                      </span>
                    ) : <span style={{ color: 'var(--ad-bad)', fontSize: 12 }}>not synced</span>}
                  </td>
                  <td style={{ display: 'flex', gap: 8 }}>
                    <Link href={`/admin/products/${p.id}`} className="admin-btn admin-btn--ghost">Edit</Link>
                    {p.status !== 'archived' && <ArchiveButton id={p.id} />}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </>
  )
}
