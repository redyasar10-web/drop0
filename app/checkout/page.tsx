import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import CheckoutForm from './CheckoutForm'
import './checkout.css'

export default async function CheckoutPage() {
  const supabase = createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const admin = createAdminClient()

  // Balance is ledger-derived (BAL-2): SUM(credit_events) in cents.
  const [{ data: balanceCents }, { data: seq }] = await Promise.all([
    admin.rpc('available_balance', { p_user_id: user.id }),
    admin.from('member_sequence').select('next_number').single(),
  ])

  return (
    <CheckoutForm
      creditBalance={Math.floor((balanceCents ?? 0) / 100)}
      userEmail={user.email ?? ''}
      nextMemberNo={seq?.next_number ?? 1}
    />
  )
}
