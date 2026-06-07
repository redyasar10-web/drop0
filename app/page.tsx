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
//
// Returns null on read failure so the caller can fall back to a neutral
// message — silently returning 0 would tell every visitor "0 of 50 claimed"
// during a Supabase outage and reset the social-proof anchor on every
// session.
async function getClaimedCount(): Promise<number | null> {
  // 3-second cap on the Supabase round-trip. Without this, a Supabase outage
  // makes the entire landing page TTFB hang at the platform timeout (60s on
  // Vercel Pro). The fallback below renders "Founding spots — closing soon".
  const TIMEOUT_MS = 3000
  try {
    const admin = createAdminClient()
    const query = admin
      .from('users')
      .select('*', { count: 'exact', head: true })
      .not('member_number', 'is', null)
    const result = await Promise.race([
      query,
      new Promise<{ count: null; error: { message: string } }>((resolve) =>
        setTimeout(
          () => resolve({ count: null, error: { message: 'claimed-count timeout' } }),
          TIMEOUT_MS,
        ),
      ),
    ])
    const { count, error } = result as { count: number | null; error: { message: string } | null }
    if (error) {
      console.error('[home] claimed-count fetch failed:', error.message)
      return null
    }
    return count ?? 0
  } catch (err) {
    console.error('[home] claimed-count fetch threw:', err)
    return null
  }
}

export default async function HomePage() {
  const rawCount = await getClaimedCount()
  const haveCount = rawCount != null
  const claimed = haveCount ? Math.min(rawCount, CONFIG.TOTAL_FOUNDING_SPOTS) : 0
  const pct = haveCount
    ? Math.min(100, Math.round((claimed / CONFIG.TOTAL_FOUNDING_SPOTS) * 100))
    : 0

  const html = LANDING_HTML
    .replace(
      '<b>17</b> of 50 spots claimed',
      haveCount
        ? `<b>${claimed}</b> of ${CONFIG.TOTAL_FOUNDING_SPOTS} spots claimed`
        : `Founding spots — closing soon`
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
