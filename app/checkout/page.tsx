import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'
import CheckoutForm from './CheckoutForm'

export default async function CheckoutPage() {
  const supabase = createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('credit_balance')
    .eq('id', user.id)
    .single()

  return (
    <div className="checkout-shell">
      <header className="checkout-header">
        <Link href="/account" className="checkout-wordmark">Chariot</Link>
      </header>

      <main className="checkout-main">
        <CheckoutForm creditBalance={profile?.credit_balance ?? 0} />
      </main>
    </div>
  )
}
