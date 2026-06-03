import './landing.css'
import { createServerClient } from '@/lib/supabase/server'
import LandingNav from './LandingNav'
import Reveal from './Reveal'
import Link from 'next/link'

const PRODUCTS = [
  { img: '/products/dusk-tee-black.jpg', brand: '1NRI', name: 'Dusk Before Dawn Tee', retail: 65, credit: 35 },
  { img: '/products/intercessory-fur-black.jpg', brand: '1NRI', name: 'Intercessory Dept Fur Tee', retail: 65, credit: 35 },
  { img: '/products/sackcloth-clay.jpg', brand: '1NRI', name: 'Sackcloth Tee', retail: 58, credit: 28 },
  { img: '/products/flare-sweatpants-khaki.jpg', brand: '1NRI', name: 'Flare Sweatpants', retail: 68, credit: 38 },
  { img: '/products/varsity-jersey.jpg', brand: '1NRI', name: 'Varsity Jersey 2.0', retail: 72, credit: 42 },
  { img: '/products/acid-washed-shorts-red.jpg', brand: '1NRI', name: 'Acid Washed Shorts', retail: 62, credit: 32 },
]

const COMPARE = [
  { label: 'Shipping', direct: '$45+ per parcel', chariot: 'Free — included' },
  { label: 'Wait', direct: '3 weeks from Accra', chariot: '~3 days from Austin' },
  { label: 'Customs & duties', direct: 'Surprise fees at your door', chariot: 'Paid by us · AGOA 0%' },
  { label: 'Returns', direct: 'Cross-border, on you', chariot: 'Free, domestic' },
  { label: 'Price at checkout', direct: 'Varies — fees added', chariot: 'The price you see is the price you pay' },
]

export default async function HomePage() {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const ctaHref = user ? '/checkout' : '/signup'

  return (
    <div className="lp">
      <LandingNav isAuthed={!!user} />

      {/* Sticky mobile claim bar */}
      <div className="stickycta">
        <div className="stickycta__l">
          <span className="stickycta__price">$20</span>
          <span className="stickycta__note">Founding spot · closes Jun 14</span>
        </div>
        <Link href={ctaHref} className="btn btn--sm">Claim Your Spot</Link>
      </div>

      {/* 1 · HERO */}
      <header className="hero" id="top">
        <div className="hero__media">
          <video
            className="hero__video"
            autoPlay
            muted
            loop
            playsInline
            poster="/hero/hero-1nri.jpg"
          >
            <source src="/hero/hero.mp4" type="video/mp4" />
          </video>
          <img className="hero__poster" src="/hero/hero-1nri.jpg" alt="1NRI, worn in Accra" />
        </div>
        <div className="hero__scrim" />
        <div className="hero__inner">
          <span className="eyebrow eyebrow--light">Drop 0 · The Founding Fifty · Closes June 14</span>
          <h1 className="hero__title">
            The founding fifty
            <span className="ital">get in first — for life.</span>
          </h1>
          <p className="hero__sub">
            1NRI, direct from Accra. No customs, no three-week wait.
            $20 now gets you $30 in Drop&nbsp;1 credit, a permanent founding spot,
            and 24-hour early access to every drop.
          </p>
          <div className="hero__cta">
            <Link href={ctaHref} className="btn btn--lg">
              Claim Your Spot — $20 <span className="arr" aria-hidden="true">→</span>
            </Link>
          </div>
          <p className="hero__trust">
            Ships from Austin · Duties included · Free returns · Refundable anytime before Drop&nbsp;1
          </p>
        </div>
      </header>

      {/* Marquee — provenance strip */}
      <div className="marquee" aria-hidden="true">
        <div className="marquee__track">
          {Array.from({ length: 2 }).map((_, i) => (
            <span className="marquee__row" key={i}>
              <span>Designed in Accra</span><span className="dot">✦</span>
              <span>Shipped from Austin</span><span className="dot">✦</span>
              <span>1NRI</span><span className="dot">✦</span>
              <span>Made to order</span><span className="dot">✦</span>
              <span>AGOA 0% duty</span><span className="dot">✦</span>
              <span>Stripe-secured</span><span className="dot">✦</span>
            </span>
          ))}
        </div>
      </div>

      {/* 2 · WHAT YOU GET */}
      <section className="section section--paper" id="offer">
        <div className="wrap">
          <Reveal className="head">
            <span className="eyebrow">The founding deal</span>
            <h2 className="h2">Pay $20. Walk away with more than you paid.</h2>
          </Reveal>
          <div className="b3">
            <Reveal as="article" className="b3card" delay={0}>
              <span className="b3card__amt">$30</span>
              <h3 className="b3card__h">Store credit</h3>
              <p className="b3card__p">Apply it to any Drop&nbsp;1 piece. Never expires. Rolls forward to every drop after.</p>
            </Reveal>
            <Reveal as="article" className="b3card" delay={90}>
              <span className="b3card__amt">∞</span>
              <h3 className="b3card__h">First access, for life</h3>
              <p className="b3card__p">24 hours before anyone else, on every Chariot drop. Permanent — not a subscription.</p>
            </Reveal>
            <Reveal as="article" className="b3card" delay={180}>
              <span className="b3card__amt">50</span>
              <h3 className="b3card__h">Founding status</h3>
              <p className="b3card__p">One of the first fifty. Your spot in the founding crew is yours, in the order you joined.</p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 3 · THE BRANDS */}
      <section className="section section--ink" id="brands">
        <div className="wrap">
          <Reveal className="head head--light">
            <span className="eyebrow">Their first US drop</span>
            <h2 className="h2 h2--light">The label Accra already wears.</h2>
          </Reveal>

          <Reveal className="brandfeat">
            <div className="brandfeat__img">
              <img src="/brands/brand-1nri.jpg" alt="1NRI campaign, worn in Accra" loading="lazy" />
            </div>
            <div className="brandfeat__body">
              <span className="brandfeat__name">1NRI</span>
              <span className="brandfeat__loc">Berekuso, Accra · Since 2018</span>
              <p className="brandfeat__p">
                Faith-rooted streetwear by Nana Kwadwo Osei Nyarko, built out of Ashesi University.
                Six years dressing Accra&rsquo;s creative class. Tees, jerseys, sweats — heavyweight cotton, quiet detail.
              </p>
              <blockquote className="quote">
                &ldquo;If your idea is really powerful and strong, why are you part-timing it?&rdquo;
                <cite>Nana Kwadwo Osei Nyarko · Founder, 1NRI</cite>
              </blockquote>
              <Link href={ctaHref} className="link-arrow">Join 1NRI&rsquo;s first US drop <span aria-hidden="true">→</span></Link>
            </div>
          </Reveal>

          <Reveal as="p" className="brandfeat__more">More Accra labels join at Drop&nbsp;1 — founding members get them first.</Reveal>
        </div>
      </section>

      {/* 4 · WHAT YOUR $30 BUYS */}
      <section className="section section--cream" id="selection">
        <div className="wrap">
          <Reveal className="head">
            <span className="eyebrow">Drop 1 · July</span>
            <h2 className="h2">What your <span className="ital">$30</span> walks into.</h2>
            <p className="head__sub">Founding price shown. Credit applies the moment Drop&nbsp;1 opens.</p>
          </Reveal>
          <div className="lookbook">
            {PRODUCTS.map((p, i) => (
              <Reveal as="article" className="lb" key={p.name} delay={(i % 3) * 70}>
                <div className="lb__img">
                  <img src={p.img} alt={`${p.name}, ${p.brand}`} loading="lazy" />
                  <span className="lb__brand">{p.brand}</span>
                </div>
                <div className="lb__meta">
                  <span className="lb__name">{p.name}</span>
                  <div className="lb__price">
                    <span className="lb__credit">${p.credit}</span>
                    <span className="lb__retail">Retail ${p.retail}</span>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <p className="lookbook__note">Ships from Austin, TX. Duties paid. Free returns. The price you see is the price you pay.</p>
        </div>
      </section>

      {/* 5 · DIRECT vs CHARIOT */}
      <section className="section section--paper" id="compare">
        <div className="wrap wrap--narrow">
          <Reveal className="head">
            <span className="eyebrow">Why not just buy direct</span>
            <h2 className="h2">Buying from Accra yourself vs. Chariot.</h2>
          </Reveal>
          <Reveal className="compare">
            <div className="compare__head">
              <span />
              <span className="compare__col compare__col--direct">Direct from Accra</span>
              <span className="compare__col compare__col--us">With Chariot</span>
            </div>
            {COMPARE.map((row) => (
              <div className="compare__row" key={row.label}>
                <span className="compare__label">{row.label}</span>
                <span className="compare__direct">{row.direct}</span>
                <span className="compare__us">
                  <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3.5 8.5 6.5 11.5 12.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  {row.chariot}
                </span>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* 6 · PROCESS DOSSIER */}
      <section className="section section--ink" id="process">
        <div className="wrap">
          <Reveal className="head head--light">
            <span className="eyebrow">How it actually gets here</span>
            <h2 className="h2 h2--light">We absorb the border. You don&rsquo;t see it.</h2>
          </Reveal>
          <div className="dossier">
            {[
              { k: 'Accra', t: 'The brand cuts & sews', d: '1NRI makes to our wholesale order. Real product, made on demand — no dropshipping.' },
              { k: 'Aquantuo', t: 'Diaspora courier', d: 'Consolidated freight from Accra to the US. We clear it. You never see a customs form.' },
              { k: 'AGOA', t: '0% import duty', d: 'Ghanaian cotton apparel enters duty-free under the AGOA treaty through December 2026. We pass the saving on.' },
              { k: 'Austin', t: 'Ships domestic', d: 'Warehoused in Texas. Your piece ships from Austin — not Accra. Free returns, like any US store.' },
            ].map((s, i) => (
              <Reveal as="article" className="dnode" key={s.k} delay={i * 80}>
                <span className="dnode__n">{String(i + 1).padStart(2, '0')}</span>
                <span className="dnode__k">{s.k}</span>
                <h3 className="dnode__t">{s.t}</h3>
                <p className="dnode__d">{s.d}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 7 · TIMELINE */}
      <section className="section section--cream" id="timeline">
        <div className="wrap wrap--narrow">
          <Reveal className="head">
            <span className="eyebrow">The timeline</span>
            <h2 className="h2">Fifty spots. One window. It closes June 14.</h2>
            <p className="head__sub">June 14 is the day we place the wholesale order in Accra. After that, the founding price is gone.</p>
          </Reveal>
          <div className="tl">
            <Reveal as="div" className="tl__node tl__node--now">
              <span className="tl__when">Now</span>
              <span className="tl__what">Founding window open</span>
            </Reveal>
            <Reveal as="div" className="tl__node" delay={70}>
              <span className="tl__when">June 14</span>
              <span className="tl__what">We order from Accra</span>
            </Reveal>
            <Reveal as="div" className="tl__node" delay={140}>
              <span className="tl__when">July</span>
              <span className="tl__what">Drop 1 opens — founders 24h early</span>
            </Reveal>
            <Reveal as="div" className="tl__node" delay={210}>
              <span className="tl__when">August</span>
              <span className="tl__what">Ships from Austin</span>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 8 · FINAL CTA */}
      <section className="section final" id="claim">
        <div className="hero__media final__media">
          <img src="/hero/cta-1nri.jpg" alt="Worn in Accra" loading="lazy" />
        </div>
        <div className="hero__scrim" />
        <Reveal className="final__inner">
          <span className="eyebrow eyebrow--light">The founding fifty</span>
          <h2 className="final__h">Your spot is still open.</h2>
          <p className="final__p">
            $20 now. $30 in credit when Drop&nbsp;1 lands. First access, for life.
          </p>
          <Link href={ctaHref} className="btn btn--lg">
            Claim Your Spot — $20 <span className="arr" aria-hidden="true">→</span>
          </Link>
          <p className="hero__trust">Stripe-secured · Refundable anytime before Drop&nbsp;1 · No subscription · Stays $20</p>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="footer">
        <img className="footer__mark" src="/chariot-wordmark-white.png" alt="Chariot" />
        <p className="footer__slogan">Accra. Austin. What the rest of the world is already wearing.</p>
        <div className="footer__links">
          <a href="https://chariotarchive.com">chariotarchive.com</a>
          <a href="https://instagram.com">Instagram</a>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
        </div>
        <span className="footer__copy">© 2026 Chariot Archive Inc.</span>
      </footer>
    </div>
  )
}
