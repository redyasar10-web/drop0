import Link from 'next/link'
import './privacy.css'

export const metadata = {
  title: 'Privacy Notice — Chariot',
  description: 'How Chariot Archive collects, uses, and protects your information.',
}

const UPDATED = '2026-06-07'

export default function PrivacyPage() {
  return (
    <main className="legal">
      <div className="legal__inner">
        <p className="legal__eyebrow">Last updated · {UPDATED}</p>
        <h1 className="legal__title">Privacy Notice</h1>
        <p className="legal__lede">
          This notice explains what Chariot Archive Inc. (&ldquo;Chariot&rdquo;, &ldquo;we&rdquo;) collects when you visit
          chariotarchive.com, how we use it, who we share it with, and what choices you have. We try to be plain about it.
        </p>

        <h2>1. Who we are</h2>
        <p>
          Chariot Archive Inc. is a Delaware corporation operating out of Austin, Texas. We are the importer of record for
          the apparel we sell. If you want to reach us about anything in this notice, email
          {' '}<a href="mailto:hello@chariotarchive.com">hello@chariotarchive.com</a>.
        </p>

        <h2>2. What we collect</h2>
        <ul>
          <li><strong>Account information</strong> &mdash; the email address and password you create at signup, the date you agreed to our terms, and your assigned member number.</li>
          <li><strong>Order information</strong> &mdash; the items you order, the amount you paid, any promotional code you redeemed, the store credit applied, and your order status.</li>
          <li><strong>Payment information</strong> &mdash; processed by Stripe. We never see or store your full card number. Stripe shares with us only what we need to recognise your order (the payment intent ID, last four digits of the card, country).</li>
          <li><strong>Shipping information (Drop&nbsp;1 onward)</strong> &mdash; the name and address you provide for delivery. We share this with our carrier (USPS or UPS) to deliver your order.</li>
          <li><strong>Referral information</strong> &mdash; a short referral code we generate for your account, and a record of friends who used your link to sign up.</li>
          <li><strong>Support communications</strong> &mdash; if you write to us, we keep the message and our reply so we can resolve the issue.</li>
          <li><strong>Technical data</strong> &mdash; your IP address, browser type, and the pages you visit, captured automatically by our hosting provider (Vercel) and used for abuse-prevention rate-limiting.</li>
          <li><strong>Audit log</strong> &mdash; security-relevant events (failed logins, fulfillment runs, manual corrections). We hash your email and IP before storing them in this log so the entries are not directly identifying.</li>
        </ul>

        <h2>3. How we use what we collect</h2>
        <ul>
          <li>To create and operate your Chariot account.</li>
          <li>To process and ship your orders, including paying duties and applying store credit.</li>
          <li>To send transactional email (order confirmations, shipping notifications, password resets).</li>
          <li>To detect and stop abuse &mdash; failed-login throttling, promo-code redemption caps, contact-form spam.</li>
          <li>To meet legal and tax obligations &mdash; we have to keep order records and pay sales tax.</li>
          <li>With your separate consent only, to send drop announcements by email.</li>
        </ul>

        <h2>4. Who we share it with</h2>
        <p>We use the following service providers. They process your information only on our instructions and only to provide their service to us.</p>
        <ul>
          <li><strong>Stripe, Inc.</strong> &mdash; payment processing. <a href="https://stripe.com/privacy" target="_blank" rel="noreferrer">Stripe privacy policy</a>.</li>
          <li><strong>Supabase Inc.</strong> &mdash; database and authentication. <a href="https://supabase.com/privacy" target="_blank" rel="noreferrer">Supabase privacy policy</a>.</li>
          <li><strong>Resend Inc.</strong> &mdash; transactional email delivery. <a href="https://resend.com/legal/privacy-policy" target="_blank" rel="noreferrer">Resend privacy policy</a>.</li>
          <li><strong>Vercel Inc.</strong> &mdash; website hosting and request logs. <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noreferrer">Vercel privacy policy</a>.</li>
          <li><strong>Carrier (Drop&nbsp;1 onward)</strong> &mdash; USPS or UPS for delivery.</li>
        </ul>
        <p>
          We do not sell your personal information. We do not run third-party advertising trackers on this site. We do not
          share your information with advertisers or data brokers.
        </p>

        <h2>5. How long we keep it</h2>
        <ul>
          <li><strong>Order records</strong>: at least 7 years from the order date, to meet tax recordkeeping requirements.</li>
          <li><strong>Account information</strong>: until you ask us to delete it (see Section&nbsp;7).</li>
          <li><strong>Hashed audit log entries</strong>: 30 days for routine events, longer for entries connected to fraud or disputes.</li>
          <li><strong>Webhook event records</strong>: 30 days for de-duplication.</li>
          <li><strong>Rate-limit buckets</strong>: less than 1 hour.</li>
        </ul>

        <h2>6. Where we store it</h2>
        <p>
          Our Supabase database, Vercel hosting, Stripe, and Resend infrastructure are all located in the United States. If
          you are using the site from outside the US, the information you provide is transferred to the US for processing.
        </p>

        <h2>7. Your rights and choices</h2>
        <p>Wherever you live, you can:</p>
        <ul>
          <li><strong>Access</strong> your account information through your account dashboard.</li>
          <li><strong>Correct</strong> wrong information by editing it in your account or emailing us.</li>
          <li><strong>Delete</strong> your account by emailing <a href="mailto:hello@chariotarchive.com">hello@chariotarchive.com</a>. We will delete identifying information within 30 days, except for order records we are legally required to keep (see Section&nbsp;5).</li>
          <li><strong>Export</strong> your data &mdash; email us and we will send you a copy of everything we have on you within 30 days.</li>
          <li><strong>Opt out of marketing email</strong> at any time by using the unsubscribe link.</li>
        </ul>
        <p>
          If you live in California, the EU, or another jurisdiction with stronger rights (CCPA, GDPR, similar), the rights
          above apply to you. You may also have the right to object to specific processing, to restrict it, or to lodge a
          complaint with your data protection authority. Email us if you want to do any of those.
        </p>

        <h2>8. How we protect what we collect</h2>
        <ul>
          <li>Passwords are hashed using bcrypt by Supabase &mdash; we never see your password.</li>
          <li>Payments use Stripe&apos;s tokenized iframes &mdash; your card details never touch our server.</li>
          <li>All requests use HTTPS with strict transport security (HSTS preload).</li>
          <li>The browser is locked down against framing, cross-site script injection, and click-jacking through a strict Content Security Policy.</li>
          <li>Server access uses the principle of least privilege &mdash; only a small set of server-side functions can write money or identity fields, with row-level security enforced in the database.</li>
        </ul>

        <h2>9. Cookies and similar technologies</h2>
        <p>
          We use a small set of strictly necessary cookies for authentication, security (rate-limit fingerprinting), and
          remembering your shopping intent. We do not run any advertising, tracking, or analytics cookies. We do not need
          your consent for the necessary cookies because they exist only to make the site work.
        </p>

        <h2>10. Children</h2>
        <p>
          Chariot is intended for adults aged 18 and older. We do not knowingly collect information from anyone under 13.
          If you believe a child has provided us with their information, email us and we will delete it.
        </p>

        <h2>11. Changes to this notice</h2>
        <p>
          We may update this notice from time to time. If we make material changes we will email account holders and
          update the &ldquo;Last updated&rdquo; date at the top of this page.
        </p>

        <h2>12. Contact</h2>
        <p>
          Email: <a href="mailto:hello@chariotarchive.com">hello@chariotarchive.com</a><br />
          Postal: Chariot Archive Inc., Austin, Texas, USA
        </p>

        <p className="legal__back">
          <Link href="/">&larr; Back to Chariot</Link>
        </p>
      </div>
    </main>
  )
}
