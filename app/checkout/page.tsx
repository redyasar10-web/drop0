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

  const [{ data: profile }, { data: seq }] = await Promise.all([
    admin.from('users').select('credit_balance').eq('id', user.id).single(),
    admin.from('member_sequence').select('next_number').single(),
  ])

  return (
    <CheckoutForm
      creditBalance={profile?.credit_balance ?? 0}
      userEmail={user.email ?? ''}
      nextMemberNo={seq?.next_number ?? 1}
    />
  )
}
