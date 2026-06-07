import '../(site)/chariot.css'
import '../(site)/account.page.css'
import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { signoutAction } from '@/app/actions/auth'
import SiteFooter from '../(site)/SiteFooter'
import SiteScripts from '../(site)/SiteScripts'

export const dynamic = 'force-dynamic'

interface UserProfile {
  id: string
  email: string
  member_number: number | null
  referral_code: string
  created_at: string
  founder_status: boolean
}

interface CreditEvent {
  amount_cents: number
  reason: 'founding_member_grant' | 'referral_grant' | 'checkout_redemption' | 'reconciliation_adjust'
  created_at: string
}

interface OrderRow {
  amount_charged_cents: number
  status: string
  created_at: string
}

const REASON_LABELS: Record<CreditEvent['reason'], string> = {
  founding_member_grant: 'Founding credit applied',
  referral_grant: 'Referral credit',
  checkout_redemption: 'Credit applied at checkout',
  reconciliation_adjust: 'Balance adjustment',
}

function money(cents: number): string {
  return `$${(Math.abs(cents) / 100).toFixed(2)}`
}
function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}
function nameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? email
  return local.charAt(0).toUpperCase() + local.slice(1)
}

export default async function AccountPage() {
  const supabase = createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { count: referralCount }, { data: balanceCents }, { data: events }, { data: orders }] =
    await Promise.all([
      supabase.from('users').select('*').eq('id', user.id).single<UserProfile>(),
      supabase
        .from('referrals')
        .select('*', { count: 'exact', head: true })
        .eq('referrer_id', user.id)
        .eq('credited', true),
      supabase.rpc('available_balance', { p_user_id: user.id }), // ledger-derived (BAL-2), cents
      supabase
        .from('credit_events')
        .select('amount_cents, reason, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .returns<CreditEvent[]>(),
      supabase
        .from('orders')
        .select('amount_charged_cents, status, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .returns<OrderRow[]>(),
    ])

  const email = user.email ?? profile?.email ?? ''
  const displayName = nameFromEmail(email)
  const creditDollars = Math.floor(((balanceCents as number | null) ?? 0) / 100)
  const credited = Math.min(referralCount ?? 0, 3)
  const memberNo = profile?.member_number != null ? String(profile.member_number).padStart(3, '0') : null
  const tier = profile?.founder_status ? 'Founding Member' : 'Member'
  const memberSince = profile?.created_at ? shortDate(profile.created_at) : '—'
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://chariotarchive.com'
  const refLink = profile?.referral_code ? `${siteUrl.replace(/^https?:\/\//, '')}/ref/${profile.referral_code}` : null

  // Activity ledger: completed orders (deposits) + credit events, newest first.
  type Activity = { when: string; what: string; amt: string; credit: boolean }
  const activity: Activity[] = [
    ...(orders ?? [])
      .filter((o) => o.status === 'completed' && o.amount_charged_cents > 0)
      .map((o) => ({
        when: shortDate(o.created_at),
        what: 'Founding deposit — Drop 0',
        amt: money(o.amount_charged_cents),
        credit: false,
      })),
    ...(events ?? []).map((e) => ({
      when: shortDate(e.created_at),
      what: REASON_LABELS[e.reason] ?? 'Credit',
      amt: `${e.amount_cents >= 0 ? '+ ' : '- '}${money(e.amount_cents)}`,
      credit: e.amount_cents >= 0,
    })),
  ]

  return (
    <>
      <header className="nav is-scrolled" data-nav data-nav-solid>
        <div className="nav__row">
          <nav className="nav__links nav__links--left" aria-label="Primary">
            <a className="nav__link" href="/#selection">The Drop</a>
            <a className="nav__link" href="/#brands">The Brand</a>
            <a className="nav__link" href="/#process">How It Works</a>
          </nav>
          <button className="nav__burger" data-burger aria-label="Open menu" aria-expanded="false">
            <span></span><span></span><span></span>
          </button>
          <a className="nav__wordmark" href="/" aria-label="Chariot home">
            <span className="wm" aria-hidden="true">
              <img className="wm__full wm__full--light" src="/chariot-wm-tight-white.png" alt="" />
              <img className="wm__full wm__full--dark" src="/chariot-wm-tight-dark.png" alt="" />
              <img className="wm__mark" src="/chariot-o-dark.png" alt="" />
            </span>
          </a>
          <nav className="nav__links nav__links--right" aria-label="Secondary">
            <a className="nav__link" href="/about">About</a>
            <a className="nav__link" href="/support">Support</a>
            <div className="nav__acct" data-acct>
              <button className="nav__link nav__acct-btn" type="button" data-acct-btn aria-haspopup="true" aria-expanded="false" aria-current="page">
                Account <span className="nav__caret" aria-hidden="true"></span>
              </button>
              <div className="nav__menu" role="menu">
                <div className="nav__menu-head">
                  <span className="nav__menu-name">{displayName}</span>
                  <span className="nav__menu-meta">
                    {tier}{memberNo ? ` · No. ${memberNo}` : ''}
                  </span>
                </div>
                <a className="nav__menu-link" href="#activity" role="menuitem">
                  Orders &amp; credit <span className="m">${creditDollars}</span>
                </a>
                <a className="nav__menu-link" href="#referral" role="menuitem">
                  Referrals <span className="m">{credited} / 3</span>
                </a>
                <div className="nav__menu-sep"></div>
                <form action={signoutAction}>
                  <button type="submit" className="nav__menu-link nav__menu-link--quiet" role="menuitem" style={{ width: '100%', textAlign: 'left' }}>
                    Sign out
                  </button>
                </form>
              </div>
            </div>
          </nav>
        </div>
        <div className="nav__overlay" aria-hidden="true">
          <a className="nav__overlaylink" href="/#selection">The Drop</a>
          <a className="nav__overlaylink" href="/#brands">The Brand</a>
          <a className="nav__overlaylink" href="/#process">How It Works</a>
          <a className="nav__overlaylink" href="/about">About</a>
          <a className="nav__overlaylink" href="/support">Support</a>
        </div>
      </header>

      <main className="acct" id="top">
        <div className="wrap acct__inner">
          <div className="acct-head reveal">
            <span className="eyebrow">Membership</span>
            <h1 className="acct-head__title">Welcome back, {displayName}.</h1>
            <p className="acct-head__sub">
              {memberNo
                ? 'Your founding spot is held. Drop 1 opens to you 24 hours early.'
                : 'Claim your founding spot to lock in your member number and $30 in Drop 1 credit.'}
            </p>
          </div>

          <section className="mcard reveal" aria-label="Membership card">
            <div className="mcard__mark"><img src="/chariot-mark-tight.png" alt="" /></div>
            <div className="mcard__l">
              <span className="mcard__tier">{tier}</span>
              <div className="mcard__name">{displayName}</div>
              <div className="mcard__meta">
                <span>{email}</span>
                <span>Member since {memberSince}</span>
              </div>
            </div>
            <div className="mcard__no">
              <span className="mcard__no-k">Member No.</span>
              <span className="mcard__no-v">{memberNo ?? '—'}</span>
            </div>
          </section>

          <div className="acct-panels reveal" id="referral">
            <div className="panel">
              <div className="panel__k">Credit balance</div>
              <div className="panel__credit">${creditDollars}</div>
              <p className="panel__note">Applies automatically at Drop&nbsp;1 checkout. Never expires.</p>
            </div>
            <div className="panel">
              <div className="panel__k">Referrals — {credited} of 3</div>
              {refLink && (
                <div className="refl__row">
                  <span className="refl__link" data-ref-link>{refLink}</span>
                  <button className="refl__copy" data-copy aria-label="Copy referral link">Copy</button>
                </div>
              )}
              <div className="refl__progress" aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <span key={i} className={`refl__pip${i < credited ? ' is-on' : ''}`}></span>
                ))}
              </div>
              <p className="refl__meta">$5 credit per friend who claims a founding spot.</p>
            </div>
          </div>

          <section className="acct-activity" id="activity">
            <div className="acct-activity__k">Recent activity</div>
            {activity.length > 0 ? (
              activity.map((a, i) => (
                <div className="acct-row" key={i}>
                  <span className="acct-row__when">{a.when}</span>
                  <span className="acct-row__what">{a.what}</span>
                  <span className={`acct-row__amt${a.credit ? ' acct-row__amt--credit' : ''}`}>{a.amt}</span>
                </div>
              ))
            ) : (
              <div className="acct-row">
                <span className="acct-row__what">No activity yet.</span>
              </div>
            )}
          </section>

          <div className="acct-actions reveal">
            {memberNo ? (
              <a className="btn" href="/#selection">Preview Drop 1 <span className="arr" aria-hidden="true">→</span></a>
            ) : (
              <a className="btn" href="/checkout">Claim your spot — $20 <span className="arr" aria-hidden="true">→</span></a>
            )}
            <a className="btn btn--ghost" href="/support">Get support</a>
            <form action={signoutAction}>
              <button type="submit" className="acct-actions__signout">Sign out</button>
            </form>
          </div>
        </div>
      </main>

      <SiteFooter />
      <SiteScripts />
    </>
  )
}
