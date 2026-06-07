import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin-guard'
import ProductForm from '../ProductForm'

export const dynamic = 'force-dynamic'

export default async function NewProductPage() {
  await requireAdmin()
  const admin = createAdminClient()

  const [{ data: brands }, { data: drops }] = await Promise.all([
    admin.from('brands').select('id, name').order('sort_order', { ascending: true }),
    admin.from('drops').select('id, name, number').order('number', { ascending: true }),
  ])

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>New product</h1>
          <p className="admin-head__sub">Created here syncs to Stripe (Product + Price) automatically.</p>
        </div>
      </div>
      <div className="admin-card">
        <ProductForm
          mode="create"
          brands={brands ?? []}
          drops={drops ?? []}
        />
      </div>
    </>
  )
}
