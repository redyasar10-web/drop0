import './landing.css'
import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import LandingNav from './LandingNav'
import Link from 'next/link'

const TOTAL_SPOTS = 50

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
  const supabase = createServerClient()
  const [{ data: { user } }, claimedCount] = await Promise.all([
    supabase.auth.getUser(),
    getClaimedCount(),
  ])

  const ctaHref = user ? '/checkout' : '/signup'
  const remaining = Math.max(0, TOTAL_SPOTS - claimedCount)

  return (
    <div className="lp">
      <LandingNav />

      {/* 1. Hero */}
      <header className="hero" id="top">
        <div className="hero__bg">
          <img src="/assets/jireh/campaign-10.jpg" alt="1NRI and Jireh pieces worn in Accra" />
        </div>
        <div className="hero__inner">
          <div className="hero__mark">Chariot</div>
          <span className="eyebrow hero__eyebrow">Drop 0 · Founding Member · 50 Spots</span>
          <h1 className="hero__headline">What the rest of the world is already wearing.</h1>
          <p className="hero__sub">
            1NRI and Jireh, from Accra to the US. Pay $20. Get $30 in credit on Drop 1.
            First access, permanent founding number, for life.
          </p>
          <div className="hero__cta-wrap">
            <Link href={ctaHref} className="btn">
              Become a Founding Member — $20 <span className="arr" aria-hidden="true">→</span>
            </Link>
          </div>
          <p className="hero__line">50 founding spots. Window closes June 14.</p>
        </div>
      </header>

      {/* 2. Product — what the $30 credit gets you */}
      <section className="section section--paper" id="selection">
        <div className="section__wrap">
          <div className="section__head">
            <h2 className="section__title">
              What your <span className="amt">$30</span> credit gets you
            </h2>
            <span className="eyebrow">Drop 1 — 1NRI + Jireh</span>
          </div>

          <div className="pgrid">
            <article className="pcard">
              <div className="pcard__img">
                <img src="/assets/products/dusk-tee-black.jpg" alt="SMS Tee, 1NRI" />
              </div>
              <div className="pcard__meta">
                <span className="pcard__brand">1NRI</span>
                <span className="pcard__name">SMS Tee</span>
                <div className="pcard__prices">
                  <span className="pcard__retail">$65</span>
                  <span className="pcard__credit">$35 with credit</span>
                </div>
              </div>
            </article>

            <article className="pcard">
              <div className="pcard__img">
                <img src="/assets/products/intercessory-fur-black.jpg" alt="Intercessory Dept Fur Tee, 1NRI" />
              </div>
              <div className="pcard__meta">
                <span className="pcard__brand">1NRI</span>
                <span className="pcard__name">Intercessory Dept Fur Tee</span>
                <div className="pcard__prices">
                  <span className="pcard__retail">$65</span>
                  <span className="pcard__credit">$35 with credit</span>
                </div>
              </div>
            </article>

            <article className="pcard">
              <div className="pcard__img">
                <img src="/assets/products/flare-sweatpants-khaki.jpg" alt="Flare Sweatpants, 1NRI" />
              </div>
              <div className="pcard__meta">
                <span className="pcard__brand">1NRI</span>
                <span className="pcard__name">Flare Sweatpants</span>
                <div className="pcard__prices">
                  <span className="pcard__retail">$68</span>
                  <span className="pcard__credit">$38 with credit</span>
                </div>
              </div>
            </article>

            <article className="pcard">
              <div className="pcard__img">
                <img src="/assets/products/acid-washed-shorts-red.jpg" alt="Acid Washed Shorts, 1NRI" />
              </div>
              <div className="pcard__meta">
                <span className="pcard__brand">1NRI</span>
                <span className="pcard__name">Acid Washed Shorts</span>
                <div className="pcard__prices">
                  <span className="pcard__retail">$62</span>
                  <span className="pcard__credit">$32 with credit</span>
                </div>
              </div>
            </article>

            <article className="pcard">
              <div className="pcard__img">
                <img src="/assets/jireh/battle-angel-black-grey.jpg" alt="Battle Angel Tee, Jireh" />
              </div>
              <div className="pcard__meta">
                <span className="pcard__brand">Jireh</span>
                <span className="pcard__name">Battle Angel Tee</span>
                <div className="pcard__prices">
                  <span className="pcard__retail">$58</span>
                  <span className="pcard__credit">$28 with credit</span>
                </div>
              </div>
            </article>

            <article className="pcard">
              <div className="pcard__img">
                <img src="/assets/products/varsity-jersey.jpg" alt="Varsity Jersey 2.0, 1NRI" />
              </div>
              <div className="pcard__meta">
                <span className="pcard__brand">1NRI</span>
                <span className="pcard__name">Varsity Jersey 2.0</span>
                <div className="pcard__prices">
                  <span className="pcard__retail">$72</span>
                  <span className="pcard__credit">$42 with credit</span>
                </div>
              </div>
            </article>
          </div>

          <p className="product__note">
            Ships from Austin, TX. Duties paid. Free returns. The price you see is the price you pay.
          </p>
        </div>
      </section>

      {/* 3. Founding Member offer */}
      <section className="section section--ink" id="offer">
        <div className="section__wrap">
          <div className="section__head">
            <h2 className="section__title section__title--light">Founding Member</h2>
            <p className="offer__sub">Fifty spots. $20. Once they are gone, they are gone.</p>
            <span className="offer__counter">{remaining} of {TOTAL_SPOTS} remaining</span>
          </div>

          <div className="benefits">
            <article className="benefit">
              <h3 className="benefit__h">$30 Store Credit</h3>
              <p className="benefit__p">Apply to any Drop 1 piece. Pay $20 now. Spend $30 later.</p>
            </article>
            <article className="benefit">
              <h3 className="benefit__h">Your Number</h3>
              <p className="benefit__p">Founding Member #001 through #050. Permanent.</p>
            </article>
            <article className="benefit">
              <h3 className="benefit__h">First Access</h3>
              <p className="benefit__p">Every Chariot drop. 24 hours early. For life.</p>
            </article>
          </div>

          <div className="referral">
            <span className="referral__tag">Referral</span>
            <p className="referral__body">
              Refer a friend: they get the same deal. You get $5 extra credit.
              Maximum 3 referrals — $15 total additional credit.
            </p>
          </div>

          <div className="offer__cta-wrap">
            <Link href={ctaHref} className="btn">
              Become a Founding Member — $20 <span className="arr" aria-hidden="true">→</span>
            </Link>
            <span className="offer__note">Stripe-secured. If Drop 1 is cancelled, full refund.</span>
          </div>
        </div>
      </section>

      {/* 4. Brands */}
      <section className="section section--cream" id="brands">
        <div className="section__wrap">
          <div className="section__head">
            <h2 className="section__title">The Brands</h2>
          </div>
          <div className="brands">
            <article className="brandcard">
              <div className="brandcard__body">
                <div className="brandcard__name">1NRI</div>
                <span className="brandcard__loc">Osu, Accra · Since 2018</span>
                <p className="brandcard__p">
                  Faith-based streetwear by Nana Kwadwo Osei Nyarko, Ashesi University.
                  Tees, sweatpants, jerseys. Ships to three countries.
                </p>
              </div>
              <div className="brandcard__img">
                <img src="/assets/products/life-and-death-burgundy.jpg" alt="1NRI piece" />
              </div>
            </article>
            <article className="brandcard">
              <div className="brandcard__body">
                <div className="brandcard__name">Jireh</div>
                <span className="brandcard__loc">East Legon, Accra · Since 2021</span>
                <p className="brandcard__p">
                  Graphic streetwear label. The Battle Angel series — high-contrast,
                  character-driven artwork on heavyweight cotton.
                </p>
              </div>
              <div className="brandcard__img">
                <img src="/assets/jireh/campaign-01.jpg" alt="Jireh Battle Angel" />
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* 5. How it works */}
      <section className="section section--paper" id="how">
        <div className="section__wrap">
          <div className="section__head">
            <h2 className="section__title">How Chariot works</h2>
          </div>
          <div className="hiw">
            <div className="hiw__step">
              <span className="hiw__n">01</span>
              <p>We go to Accra. We work directly with the brand.</p>
            </div>
            <div className="hiw__step">
              <span className="hiw__n">02</span>
              <p>We handle customs, duties, and import. You do not.</p>
            </div>
            <div className="hiw__step">
              <span className="hiw__n">03</span>
              <p>Your piece ships from Austin, TX. Not Accra.</p>
            </div>
            <div className="hiw__step">
              <span className="hiw__n">04</span>
              <p>The price you see is the price you pay. Returns are free.</p>
            </div>
          </div>
          <p className="hiw__note">
            Shipping via Aquantuo diaspora courier ($81–$197, Accra to Texas).
            AGOA treaty: 0% import duty on Ghanaian cotton apparel through December 2026.
          </p>
        </div>
      </section>

      {/* 6. Timeline */}
      <section className="section section--ink" id="timeline">
        <div className="section__wrap">
          <div className="section__head">
            <h2 className="section__title">The Timeline</h2>
          </div>
          <div className="timeline">
            <div className="tl tl--now">
              <div className="tl__what">Founding Member window</div>
              <span className="tl__when">Open now</span>
            </div>
            <div className="tl">
              <div className="tl__what">Community vote on Drop 1 pieces</div>
              <span className="tl__when">June 2026</span>
            </div>
            <div className="tl">
              <div className="tl__what">Drop 1 opens</div>
              <span className="tl__when">July 2026</span>
            </div>
            <div className="tl">
              <div className="tl__what">Ships from Austin</div>
              <span className="tl__when">August 2026</span>
            </div>
          </div>
          <p className="timeline__line">Founding Members shop Drop 1 before anyone else.</p>
          <div className="timeline__cta">
            <Link href={ctaHref} className="btn">
              Become a Founding Member — $20 <span className="arr" aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* 7. Footer */}
      <footer className="footer">
        <div className="footer__mark">Chariot</div>
        <div className="footer__links">
          <a href="https://chariotarchive.com">chariotarchive.com</a>
          <a href="#">Instagram</a>
          <p className="footer__slogan">Accra. Austin. What the rest of the world is already wearing.</p>
          <span className="footer__copy">© 2026 Chariot</span>
        </div>
      </footer>
    </div>
  )
}
