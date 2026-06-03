import Link from 'next/link'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-split">
      <aside className="auth-aside" aria-hidden="true">
        <div className="auth-aside__scrim" />
        <div className="auth-aside__content">
          <Link href="/" className="auth-aside__wordmark" aria-label="Chariot home">
            <img src="/chariot-wordmark-white.png" alt="Chariot" className="auth-logo" />
          </Link>
          <div>
            <span className="auth-aside__eyebrow">Drop 0 · The Founding Fifty</span>
            <h2 className="auth-aside__title">Join the founding fifty.</h2>
            <ul className="auth-aside__list">
              <li>$30 store credit on Drop 1 — never expires</li>
              <li>24-hour early access to every drop, for life</li>
              <li>A permanent founding spot, in the order you joined</li>
            </ul>
            <p className="auth-aside__trust">Ships from Austin · Duties included · Free returns</p>
          </div>
        </div>
      </aside>

      <main className="auth-main">
        <Link href="/" className="auth-wordmark auth-wordmark--mobile" aria-label="Chariot home">
          <img src="/chariot-wordmark-white.png" alt="Chariot" className="auth-logo" />
        </Link>
        {children}
      </main>
    </div>
  )
}
