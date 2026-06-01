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

export default async function AccountPage({
  searchParams,
}: {
  searchParams: { order?: string }
}) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [{ data: profile }, { count: referralCount }] = await Promise.all([
    supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single<UserProfile>(),
    supabase
      .from('referrals')
      .select('*', { count: 'exact', head: true })
      .eq('referrer_id', user.id)
      .eq('credited', true),
  ])

  const orderConfirmed = searchParams.order === 'confirmed'

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://chariotarchive.com'
  const referralLink = profile?.referral_code
    ? `${siteUrl}/ref/${profile.referral_code}`
    : null

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      })
    : null

  return (
    <main className="account-page">
      <div className="account-inner">
        {orderConfirmed && (
          <div className="account-success-banner">
            Order confirmed — your member number has been assigned.
          </div>
        )}

        <h1 className="account-heading">Account</h1>
        <p className="account-email">{user.email}</p>

        {profile?.founder_status && (
          <div className="account-founder-badge">
            Founding Member
          </div>
        )}

        <p className="account-section-label">Member Details</p>

        <div className="account-grid">
          <div className="account-stat">
            <span className="account-stat-label">Member No.</span>
            {profile?.member_number != null ? (
              <span className="account-stat-value account-stat-value--gold">
                #{String(profile.member_number).padStart(3, '0')}
              </span>
            ) : (
              <span className="account-stat-value account-stat-value--muted">
                Assigned at purchase
              </span>
            )}
          </div>

          <div className="account-stat">
            <span className="account-stat-label">Credit Balance</span>
            <span className="account-stat-value">
              ${profile?.credit_balance ?? 0}
            </span>
          </div>

          <div className="account-stat">
            <span className="account-stat-label">Member Since</span>
            <span className="account-stat-value" style={{ fontSize: 'var(--fs-16)' }}>
              {memberSince ?? '—'}
            </span>
          </div>

          <div className="account-stat">
            <span className="account-stat-label">Status</span>
            <span className="account-stat-value" style={{ fontSize: 'var(--fs-14)' }}>
              {profile?.founder_status ? 'Founding Member' : 'Member'}
            </span>
          </div>
        </div>

        {profile?.referral_code && (
          <>
            <p className="account-section-label">Referral</p>
            <div className="account-referral-block">
              <p className="account-referral-label">Your link</p>
              {referralLink && (
                <>
                  <p className="account-referral-link">{referralLink}</p>
                  <CopyButton text={referralLink} />
                </>
              )}
              <p className="account-referral-meta">
                {referralCount ?? 0} of 3 referrals credited &mdash; $5 per friend who purchases
              </p>
            </div>
          </>
        )}

        {profile?.member_number == null && (
          <>
            <p className="account-section-label">Drop 0</p>
            <Link href="/checkout" className="auth-btn" style={{ display: 'inline-flex', width: 'auto', textDecoration: 'none' }}>
              Shop Drop 0
            </Link>
          </>
        )}

        {!profile && (
          <p style={{ color: 'rgba(250,250,248,0.4)', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-13)' }}>
            Profile loading. If this persists, contact seth@chariotarchive.com.
          </p>
        )}
      </div>
    </main>
  )
}
