import './(site)/chariot.css'
import './(site)/landing.page.css'
import { createAdminClient } from '@/lib/supabase/admin'
import { CONFIG } from '@/lib/config'
import { LANDING_HTML } from './(site)/_markup/landing'
import SiteScripts from './(site)/SiteScripts'

export const metadata = {
  title: 'Chariot — Drop 0 · The Founding Fifty',
  description: 'What the rest of the world is already wearing. 1NRI, direct from Accra.',
}

// Spots-claimed must reflect live DB state, not build time (NF-8 funnel consistency).
export const dynamic = 'force-dynamic'

// Funnel consistency (NF-8): spots-claimed comes from the DB, the same source
// the checkout and member numbering use. member_number is set only on a completed
// purchase, so this count never diverges from reality.
async function getClaimedCount(): Promise<number> {
  try {
    const admin = createAdminClient()
    const { count } = await admin
      .from('users')
      .select('*', { count: 'exact', head: true })
      .not('member_number', 'is', null)
    return count ?? 0
  } catch {
    return 0
  }
}

export default async function HomePage() {
  const claimed = Math.min(await getClaimedCount(), CONFIG.TOTAL_FOUNDING_SPOTS)
  const pct = Math.min(100, Math.round((claimed / CONFIG.TOTAL_FOUNDING_SPOTS) * 100))

  const html = LANDING_HTML
    .replace(
      '<b>17</b> of 50 spots claimed',
      `<b>${claimed}</b> of ${CONFIG.TOTAL_FOUNDING_SPOTS} spots claimed`
    )
    .replace(
      '<div class="hero__counter-fill"></div>',
      `<div class="hero__counter-fill" style="width:${pct}%"></div>`
    )

  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: html }} />
      <SiteScripts />
    </>
  )
}
