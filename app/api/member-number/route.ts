import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * Returns the logged-in user's assigned member number (or null if not yet
 * assigned). The checkout success screen polls this after a paid/wallet
 * payment, since fulfillment (and number assignment) happens asynchronously
 * in the Stripe webhook — so we must read the real number rather than guess.
 */
export async function GET() {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data } = await admin
    .from('users')
    .select('member_number, credit_balance')
    .eq('id', user.id)
    .single()

  return NextResponse.json({
    memberNumber: data?.member_number ?? null,
    creditBalance: data?.credit_balance ?? 0,
  })
}
