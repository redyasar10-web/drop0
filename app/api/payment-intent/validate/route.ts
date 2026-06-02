import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const DROP0_PRICE_CENTS = parseInt(process.env.DROP0_PRICE_CENTS ?? '2000', 10)

export async function POST(request: Request) {
  const supabase = createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ valid: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { promoCode } = await request.json()
  const cleanPromo = ((promoCode as string | null) ?? '').trim().toLowerCase()

  if (!cleanPromo) {
    return NextResponse.json({ valid: false, error: 'Enter a promo code.' })
  }

  const admin = createAdminClient()
  const { data: promo } = await admin
    .from('promo_codes')
    .select('active, use_count, max_uses')
    .eq('code', cleanPromo)
    .single()

  if (!promo || !promo.active || promo.use_count >= promo.max_uses) {
    return NextResponse.json({ valid: false, error: 'That code is invalid or has expired.' })
  }

  if (cleanPromo === 'zarathustra') {
    return NextResponse.json({
      valid: true,
      label: 'Founding Member code — full cost covered',
      discountCents: DROP0_PRICE_CENTS,
    })
  }

  return NextResponse.json({ valid: true, label: 'Code applied', discountCents: 0 })
}
