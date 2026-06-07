import '../(site)/chariot.css'
import '../(site)/login.page.css'

// Design-truth auth chrome: editorial visual + form column. Individual routes
// (login, signup, forgot/reset, verify) render a <form className="form"> inside.
// OAuth/social is intentionally omitted — email + password only for v1 (PRD §8).
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth" data-mode="login" data-authwrap>
      <div className="auth__visual">
        <img className="auth__img auth__img--login" src="/lib/ed-01.jpg" alt="1NRI editorial, photographed in Accra" />
        <div className="auth__scrim"></div>
        <div className="auth__visual-top">
          <span className="auth__visual-tag">Drop 0 · Founding Fifty</span>
        </div>
        <div className="auth__visual-bottom">
          <p className="auth__quote">What the rest of the world is already wearing.</p>
          <div className="auth__credit">
            <span>1NRI</span><span>Time &amp; Chance SS25</span><span>Made in Accra</span><span>Ships from Austin</span>
          </div>
        </div>
      </div>
      <div className="auth__formwrap">
        <a className="form__brand" href="/" aria-label="Chariot home">
          <img src="/chariot-wm-tight-dark.png" alt="Chariot" />
        </a>
        {children}
      </div>
    </div>
  )
}
