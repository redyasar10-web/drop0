import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import CopyButton from './CopyButton'

interface UserProfile {
  id: string
  email: string
  member_number: number | null
  credit_balance: number
  referral_code: string
  referred_by: string | null
  created_at: string
  founder_status: boolean
  tc_agreed_at: string
}

function pad3(n: number) {
  return String(n).padStart(3, '0')
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: { order?: string }
}) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [{ data: profile }, { count: referralCount }] = await Promise.all([
    supabase.from('users').select('*').eq('id', user.id).single<UserProfile>(),
    supabase
      .from('referrals')
      .select('*', { count: 'exact', head: true })
      .eq('referrer_id', user.id)
      .eq('credited', true),
  ])

  const orderConfirmed = searchParams.order === 'confirmed'
  const hasNumber = profile?.member_number != null
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://chariotarchive.com'
  const referralLink = profile?.referral_code ? `${siteUrl}/ref/${profile.referral_code}` : null
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null

  return (
    <main className="account-page">
      <div className="account-inner">
        {orderConfirmed && (
          <div className="account-success-banner">
            Order confirmed — your member number has been assigned.
          </div>
        )}

        {/* Membership credential */}
        <section className="cred" aria-label="Membership credential">
          <div className="cred__head">
            <span className="cred__brand">Chariot</span>
            <span className="cred__tier">{profile?.founder_status ? 'Founding Member' : 'Member'}</span>
          </div>

          <div className="cred__numberwrap">
            <span className="cred__kicker">Member Number</span>
            {hasNumber ? (
              <span className="cred__number">{pad3(profile!.member_number!)}</span>
            ) : (
              <span className="cred__number cred__number--pending">— — —</span>
            )}
            {!hasNumber && (
              <span className="cred__pendingnote">Assigned the moment you claim your spot</span>
            )}
          </div>

          <div className="cred__foot">
            <div className="cred__field">
              <span className="cred__label">Holder</span>
              <span className="cred__value">{user.email}</span>
            </div>
            <div className="cred__field cred__field--right">
              <span className="cred__label">Member Since</span>
              <span className="cred__value">{memberSince ?? '—'}</span>
            </div>
          </div>
        </section>

        {/* Stats */}
        <div className="account-grid">
          <div className="account-stat">
            <span className="account-stat-label">Credit Balance</span>
            <span className="account-stat-value account-stat-value--gold">
              ${profile?.credit_balance ?? 0}
            </span>
          </div>
          <div className="account-stat">
            <span className="account-stat-label">Referrals Credited</span>
            <span className="account-stat-value">{referralCount ?? 0}<span className="account-stat-sub"> / 3</span></span>
          </div>
          <div className="account-stat">
            <span className="account-stat-label">Status</span>
            <span className="account-stat-value account-stat-value--sm">
              {profile?.founder_status ? 'Founding Member' : hasNumber ? 'Member' : 'Pending'}
            </span>
          </div>
        </div>

        {/* Referral */}
        {referralLink && (
          <div className="account-referral-block">
            <p className="account-referral-label">Your referral link</p>
            <p className="account-referral-link">{referralLink}</p>
            <CopyButton text={referralLink} />
            <p className="account-referral-meta">
              {referralCount ?? 0} of 3 credited &mdash; $5 credit per friend who claims a spot
            </p>
          </div>
        )}

        {/* CTA — only before purchase */}
        {!hasNumber && (
          <div className="account-cta">
            <Link href="/checkout" className="account-cta-btn">Claim your founding spot — $20</Link>
          </div>
        )}

        {!profile && (
          <p className="account-fallback">
            Profile loading. If this persists, contact support@chariotarchive.com.
          </p>
        )}
      </div>
    </main>
  )
}
