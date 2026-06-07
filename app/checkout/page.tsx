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
  // Each call wrapped in a 3s timeout so a Supabase outage degrades the
  // checkout to safe defaults (zero credit, member-number guess of 1)
  // instead of blocking the entire page render at the Vercel function
  // timeout. The CheckoutForm polls /api/member-number after the
  // PaymentIntent fires anyway, which corrects the displayed number.
  const TIMEOUT = 3000
  const timeoutValue = <T,>(value: T): Promise<{ data: T }> =>
    new Promise((resolve) => setTimeout(() => resolve({ data: value }), TIMEOUT))

  const [balanceResult, seqResult] = await Promise.all([
    Promise.race([
      admin.rpc('available_balance', { p_user_id: user.id }),
      timeoutValue<number | null>(null),
    ]),
    Promise.race([
      admin.from('member_sequence').select('next_number').single(),
      timeoutValue<{ next_number: number } | null>(null),
    ]),
  ])
  const { data: balanceCents } = balanceResult as { data: number | null }
  const { data: seq } = seqResult as { data: { next_number: number } | null }

  return (
    <CheckoutForm
      creditBalance={Math.floor((balanceCents ?? 0) / 100)}
      userEmail={user.email ?? ''}
      nextMemberNo={seq?.next_number ?? 1}
    />
  )
}
