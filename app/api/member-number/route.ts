import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Member-number lookup for the post-payment success state. The Stripe webhook
// assigns the number asynchronously (and the synchronous Zarathustra path
// assigns it inline), so the checkout success screen polls this endpoint
// instead of trusting a guessed number from the page-load time.
//
// Returns { memberNumber: number | null }. Cache control disabled — this is
// polled and must always reflect the latest write.
export async function GET() {
  const supabase = createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Admin client because the users row may be slightly out of sync with the
  // RLS-visible view during the brief window between the Stripe webhook firing
  // and the user's session refreshing.
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('users')
    .select('member_number')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    console.error('[member-number] lookup failed:', error)
    return NextResponse.json({ memberNumber: null }, { status: 500 })
  }

  return NextResponse.json(
    { memberNumber: data?.member_number ?? null },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
