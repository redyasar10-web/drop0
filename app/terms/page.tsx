import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms & Conditions — Chariot',
  description: 'Terms governing your use of chariotarchive.com and any purchase from Chariot Archive.',
}

export default function TermsPage() {
  return (
    <div className="terms-shell">

      <header className="terms-nav">
        <div className="terms-nav__inner">
          <Link href="/" className="terms-wordmark">Chariot</Link>
        </div>
      </header>

      <main className="terms-main">
        <div className="terms-article">

          <div className="terms-header">
            <h1 className="terms-title">Terms &amp; Conditions</h1>
            <p className="terms-effective">Effective: [Date at launch]</p>
          </div>

          <p className="terms-p terms-p--lead">
            These terms govern your use of chariotarchive.com and any purchase you make from Chariot Archive
            (&ldquo;Chariot,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;). By creating an account or completing
            a purchase, you agree to these terms.
          </p>

          <section className="terms-section">
            <h2 className="terms-h2">1. Who we are</h2>
            <p className="terms-p">
              Chariot Archive is a cross-border commerce platform based in Austin, Texas. We import
              independent international fashion brands to U.S. customers. Drop 0 — our first launch —
              features curated pieces from Ghana-based brands 1NRI and Jireh.
            </p>
          </section>

          <section className="terms-section">
            <h2 className="terms-h2">2. Accounts</h2>
            <p className="terms-p">
              You must be 18 or older to create an account. You agree to provide accurate information
              and keep your password secure. You are responsible for activity that happens under your
              account. One account per person. We may suspend or close accounts for fraud, abuse, or
              breach of these terms.
            </p>
          </section>

          <section className="terms-section">
            <h2 className="terms-h2">3. Drop 0 — the Founding Member spot</h2>
            <p className="terms-p">
              The Founding Member spot is a $20 purchase that grants you three things:
            </p>
            <ul className="terms-ul">
              <li>
                A permanent Founding Member number between #001 and #050, assigned in the order
                purchases are completed and never reassigned.
              </li>
              <li>A $30 store credit usable on Drop 1.</li>
              <li>
                First access to every Chariot drop, twenty-four hours before public release, for
                as long as your account remains active.
              </li>
            </ul>
            <p className="terms-p">
              There are 50 Founding Member spots. Once they are sold, no more will be issued.
            </p>
          </section>

          <section className="terms-section">
            <h2 className="terms-h2">4. Payment</h2>
            <p className="terms-p">
              Payments are processed by Stripe. We do not store your card details. By submitting
              payment, you authorize the charge shown at checkout. Prices are in U.S. dollars. Sales
              tax may apply depending on your shipping address.
            </p>
          </section>

          <section className="terms-section">
            <h2 className="terms-h2">5. Store credit</h2>
            <p className="terms-p">
              The $30 credit issued with your Founding Member spot is applied at checkout on a future
              Chariot order. Credit has no cash value, cannot be transferred, cannot be refunded for
              cash, and cannot be combined with promo codes unless we say so. Credit does not expire
              while your account remains active.
            </p>
          </section>

          <section className="terms-section">
            <h2 className="terms-h2">6. Refunds</h2>
            <p className="terms-p">
              Your $20 Founding Member purchase is refundable in full before Drop 1 launches. After
              Drop 1 launches, the purchase becomes non-refundable, but your Founding Member number,
              $30 credit, and first-access status remain yours.
            </p>
            <p className="terms-p">
              If Chariot cancels Drop 1, we will refund your Founding Member purchase in full.
            </p>
            <p className="terms-p">
              Returns on Drop 1 garments will follow the return window posted at the time of that drop.
            </p>
          </section>

          <section className="terms-section">
            <h2 className="terms-h2">7. Referrals</h2>
            <p className="terms-p">
              Each account is issued a unique referral link. When a friend signs up through your link
              and completes a Founding Member purchase, you receive an additional $5 store credit. Each
              account may earn referral credit on a maximum of three referred purchases, for a maximum
              of $15 in referral credit on top of the base $30. We may withhold or reverse referral
              credit if we identify fraud, self-referral, or abuse.
            </p>
          </section>

          <section className="terms-section">
            <h2 className="terms-h2">8. Promo codes</h2>
            <p className="terms-p">
              Promo codes are issued at our discretion and may be limited in number, time, or use. The
              promo code &ldquo;zarathustra&rdquo; grants free access to a Founding Member spot and is
              limited to ten total redemptions. Codes are non-transferable and cannot be combined unless
              we say so.
            </p>
          </section>

          <section className="terms-section">
            <h2 className="terms-h2">9. Shipping and duties</h2>
            <p className="terms-p">
              Drop 1 garments will ship from Austin, Texas. We pay import duties on the inbound side
              so the price you see at checkout is the price you pay.
            </p>
          </section>

          <section className="terms-section">
            <h2 className="terms-h2">10. Brands and products</h2>
            <p className="terms-p">
              Garments are produced by the partner brands. Photos and descriptions are our best effort
              to represent each piece. Slight variation in color, fit, or finish is normal for
              small-batch production.
            </p>
          </section>

          <section className="terms-section">
            <h2 className="terms-h2">11. Intellectual property</h2>
            <p className="terms-p">
              The Chariot name, wordmark, and site content are ours. The garments and brand identity
              of 1NRI, Jireh, and any future partner remain theirs. Nothing on the site grants you a
              license to reproduce, resell, or commercially use any of it.
            </p>
          </section>

          <section className="terms-section">
            <h2 className="terms-h2">12. Acceptable use</h2>
            <p className="terms-p">
              Do not use the site to break the law, attempt to gain unauthorized access, scrape at
              scale, resell, harass other users, or interfere with how the site runs.
            </p>
          </section>

          <section className="terms-section">
            <h2 className="terms-h2">13. Privacy</h2>
            <p className="terms-p">
              We collect the email, hashed password, and account data you give us, along with payment
              data handled by Stripe and account data handled by Supabase. We use this to run your
              account, process orders, send transactional email, and improve the service. We do not
              sell your data. A fuller privacy policy lives at{' '}
              <Link href="/privacy">/privacy</Link>.
            </p>
          </section>

          <section className="terms-section">
            <h2 className="terms-h2">14. Disclaimers</h2>
            <p className="terms-p">
              The site and service are provided as is. We make no guarantee of uninterrupted
              availability, of specific drop dates, or that any individual piece will be in stock. We
              are not liable for indirect or consequential damages. Nothing here limits rights you have
              under applicable consumer law.
            </p>
          </section>

          <section className="terms-section">
            <h2 className="terms-h2">15. Governing law</h2>
            <p className="terms-p">
              These terms are governed by the laws of the State of Texas. Disputes will be resolved in
              the state or federal courts located in Travis County, Texas.
            </p>
          </section>

          <section className="terms-section">
            <h2 className="terms-h2">16. Changes</h2>
            <p className="terms-p">
              We may update these terms. If we make a material change, we will notify you by email or
              on-site notice. Continued use after the change means you accept the new version.
            </p>
          </section>

          <section className="terms-section">
            <h2 className="terms-h2">17. Termination</h2>
            <p className="terms-p">
              You may close your account at any time by contacting us. We may close or suspend an
              account for breach of these terms; in that case, unused store credit may be forfeited.
            </p>
          </section>

          <section className="terms-section">
            <h2 className="terms-h2">18. Contact</h2>
            <p className="terms-p">
              <a href="mailto:caleb@chariotarchive.com">caleb@chariotarchive.com</a>
            </p>
          </section>

        </div>
      </main>

      <footer className="terms-footer">
        <p className="terms-footer__copy">&copy; 2026 Chariot Archive</p>
      </footer>

    </div>
  )
}
