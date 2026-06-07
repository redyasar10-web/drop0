'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

type Option = { id: string; name: string; number?: number | null }

type Initial = {
  id?: string
  sku?: string
  slug?: string
  name?: string
  subtitle?: string | null
  description?: string | null
  brand_id?: string | null
  drop_id?: string | null
  price_cents?: number
  retail_cents?: number | null
  currency?: string
  status?: 'draft' | 'active' | 'archived'
  sort_order?: number
}

interface Props {
  mode: 'create' | 'edit'
  initial?: Initial
  brands: Option[]
  drops:  Option[]
}

function dollars(cents?: number | null) {
  return cents != null ? (cents / 100).toFixed(2) : ''
}

export default function ProductForm({ mode, initial = {}, brands, drops }: Props) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk]   = useState<string | null>(null)

  // Local form state.
  const [sku, setSku]               = useState(initial.sku ?? '')
  const [slug, setSlug]             = useState(initial.slug ?? '')
  const [name, setName]             = useState(initial.name ?? '')
  const [subtitle, setSubtitle]     = useState(initial.subtitle ?? '')
  const [description, setDescription] = useState(initial.description ?? '')
  const [brandId, setBrandId]       = useState(initial.brand_id ?? '')
  const [dropId, setDropId]         = useState(initial.drop_id ?? '')
  const [priceDollars, setPrice]    = useState(dollars(initial.price_cents))
  const [retailDollars, setRetail]  = useState(dollars(initial.retail_cents ?? null))
  const [status, setStatus]         = useState(initial.status ?? 'draft')
  const [sortOrder, setSortOrder]   = useState(String(initial.sort_order ?? 100))
  const [imageUrl, setImageUrl]     = useState('')
  const [imageAlt, setImageAlt]     = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    // Guard against double-submit via Enter-key (which bypasses disabled on
    // the button) — without this, two parallel fetches can race the DB and
    // create duplicate rows on `mode === 'create'`.
    if (pending) return
    setErr(null); setOk(null)
    const priceN  = Math.round(parseFloat(priceDollars || '0') * 100)
    const retailN = retailDollars ? Math.round(parseFloat(retailDollars) * 100) : null

    if (!Number.isFinite(priceN) || priceN < 0) { setErr('Price must be a non-negative number.'); return }
    if (mode === 'create') {
      if (!sku.trim() || !slug.trim() || !name.trim()) { setErr('SKU, slug, and name are required.'); return }
    }

    start(async () => {
      const body: Record<string, unknown> = {
        sku, slug, name,
        subtitle: subtitle || null,
        description: description || null,
        brand_id: brandId || null,
        drop_id: dropId || null,
        price_cents: priceN,
        retail_cents: retailN,
        status,
        sort_order: parseInt(sortOrder || '100', 10) || 100,
      }
      if (mode === 'create' && imageUrl) {
        body.primary_image_url = imageUrl
        body.primary_image_alt = imageAlt || name
      }
      if (mode === 'edit') body.id = initial.id

      const res = await fetch('/api/admin/products', {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        setErr(data.error ?? 'Save failed.')
        return
      }
      if (data.stripe_error) {
        setOk(`Saved, but Stripe sync failed: ${data.stripe_error}. Retry from the edit page.`)
      } else {
        setOk(mode === 'create' ? 'Created and synced to Stripe.' : 'Saved and synced to Stripe.')
      }
      if (mode === 'create' && data.product?.id) {
        router.push(`/admin/products/${data.product.id}`)
      } else {
        router.refresh()
      }
    })
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      {err && <div className="admin-banner admin-banner--err">{err}</div>}
      {ok  && <div className="admin-banner admin-banner--ok">{ok}</div>}

      <div className="admin-form__row">
        <div className="admin-field">
          <label>SKU</label>
          <input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="dusk-tee-black" required disabled={mode === 'edit'} />
          {mode === 'edit' && <span className="admin-field__hint">SKU is locked after creation.</span>}
        </div>
        <div className="admin-field">
          <label>Slug (URL)</label>
          <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="dusk-before-dawn-tee" required disabled={mode === 'edit'} />
        </div>
      </div>

      <div className="admin-field">
        <label>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Dusk Before Dawn Tee" required />
      </div>

      <div className="admin-field">
        <label>Subtitle (optional)</label>
        <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Heavyweight cotton · Made in Accra" />
      </div>

      <div className="admin-field">
        <label>Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short copy shown on the product detail page." />
      </div>

      <div className="admin-form__row">
        <div className="admin-field">
          <label>Brand</label>
          <select value={brandId} onChange={(e) => setBrandId(e.target.value)}>
            <option value="">— none —</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div className="admin-field">
          <label>Drop</label>
          <select value={dropId} onChange={(e) => setDropId(e.target.value)}>
            <option value="">— none —</option>
            {drops.map((d) => <option key={d.id} value={d.id}>{d.name}{d.number != null ? ` (#${d.number})` : ''}</option>)}
          </select>
        </div>
      </div>

      <div className="admin-form__row">
        <div className="admin-field">
          <label>Price (USD)</label>
          <input type="number" step="0.01" min="0" value={priceDollars} onChange={(e) => setPrice(e.target.value)} placeholder="35.00" required />
          <span className="admin-field__hint">Charged to the customer at checkout.</span>
        </div>
        <div className="admin-field">
          <label>Retail (USD, optional)</label>
          <input type="number" step="0.01" min="0" value={retailDollars} onChange={(e) => setRetail(e.target.value)} placeholder="65.00" />
          <span className="admin-field__hint">Shown struck-through next to the price.</span>
        </div>
      </div>

      <div className="admin-form__row">
        <div className="admin-field">
          <label>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as 'draft' | 'active' | 'archived')}>
            <option value="draft">Draft (hidden)</option>
            <option value="active">Active (live)</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <div className="admin-field">
          <label>Sort order</label>
          <input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
          <span className="admin-field__hint">Lower numbers appear first.</span>
        </div>
      </div>

      {mode === 'create' && (
        <>
          <div className="admin-field">
            <label>Primary image URL (optional)</label>
            <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="/products/dusk-tee-black.jpg" />
            <span className="admin-field__hint">Path under /public, or an absolute URL.</span>
          </div>
          <div className="admin-field">
            <label>Image alt</label>
            <input value={imageAlt} onChange={(e) => setImageAlt(e.target.value)} placeholder="Dusk Before Dawn Tee" />
          </div>
        </>
      )}

      <div className="admin-form__actions">
        <button type="submit" className="admin-btn" disabled={pending}>
          {pending ? 'Saving…' : mode === 'create' ? 'Create product' : 'Save changes'}
        </button>
        <a href="/admin/products" className="admin-btn admin-btn--ghost">Cancel</a>
      </div>
    </form>
  )
}
