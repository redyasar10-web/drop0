'use client'

import { Suspense, useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { signupAction, type AuthState } from '@/app/actions/auth'
import { createClient } from '@/lib/supabase/client'
import { Logo, SocialButton, TextField, PasswordField, PrimaryButton, IconAlert, IconCheck } from '../AuthFields'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const BENEFITS = [
  { n: '01', t: 'First access to every drop, 24 hours before the public window.' },
  { n: '02', t: '$30 in Drop 1 credit for your $20 founding spot. Never expires.' },
  { n: '03', t: 'Duties paid. Ships from Austin. Free returns on Drop 1.' },
]

function SubmitButton({ canSubmit }: { canSubmit: boolean }) {
  const { pending } = useFormStatus()
  return <PrimaryButton loading={pending} disabled={!canSubmit}>Join the list</PrimaryButton>
}

function SignupForm() {
  const [state, formAction] = useFormState<AuthState, FormData>(signupAction, null)
  const params = useSearchParams()
  const ref = params.get('ref') || ''

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [reveal, setReveal] = useState(false)
  const [agree, setAgree] = useState(false)
  const [oauthMsg, setOauthMsg] = useState<string | null>(null)

  const emailValid = email.trim() !== '' && EMAIL_RE.test(email.trim())
  const passOk = password.length >= 8
  const canSubmit = name.trim() !== '' && email.trim() !== '' && password !== '' && agree

  async function oauth(provider: 'google' | 'apple') {
    setOauthMsg(null)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      })
      if (error) setOauthMsg(`${provider === 'google' ? 'Google' : 'Apple'} sign-up isn't set up yet — use your email below.`)
    } catch {
      setOauthMsg(`${provider === 'google' ? 'Google' : 'Apple'} sign-up isn't set up yet — use your email below.`)
    }
  }

  const bannerText = state?.error ?? oauthMsg

  return (
    <div className="authx" data-theme="v3" data-accent="default" data-corner="sharp">
      <div className="auth auth--signup" data-imgside="left">
        {/* editorial image */}
        <div className="auth__visual auth__visual--signup">
          <img className="auth__img" src="/auth/join.jpg" alt="1NRI editorial, Accra" />
          <div className="auth__scrim auth__scrim--signup" />
          <div className="auth__visual-top">
            <span className="auth__visual-tag auth__visual-tag--urgent">Drop 0 · Closes June 14</span>
            <span className="auth__visual-index">No. 0 / SS25</span>
          </div>
          <div className="auth__visual-bottom">
            <p className="auth__statement">Where did you<br />get that?</p>
            <div className="auth__credit">
              <span>1NRI</span><span>The founding drop</span><span>Accra → Austin</span>
            </div>
          </div>
        </div>

        {/* dark form panel */}
        <div className="auth__formwrap formpanel--dark">
          <form className="form form--signup" action={formAction} noValidate>
            <div className="form__brand"><Logo tone="white" /></div>

            <p className="form__eyebrow">By invitation</p>
            <h1 className="form__title">Join the list.</h1>
            <p className="form__lead">Membership is how you get there first. Claim your founding spot before Drop 0 closes.</p>

            <ul className="benefits">
              {BENEFITS.map((b) => (
                <li className="benefit" key={b.n}>
                  <span className="benefit__n">{b.n}</span>
                  <span className="benefit__t">{b.t}</span>
                </li>
              ))}
            </ul>

            {bannerText && (
              <div className="formbanner formbanner--error" role="status">
                <IconAlert /><span>{bannerText}</span>
              </div>
            )}

            <div className="social">
              <SocialButton provider="google" onClick={() => oauth('google')} />
              <SocialButton provider="apple" onClick={() => oauth('apple')} />
            </div>

            <div className="divider">or join with email</div>

            {/* hidden: mirror password to confirm + carry referral */}
            <input type="hidden" name="confirm_password" value={password} />
            {ref && <input type="hidden" name="referred_by" value={ref} />}

            <TextField
              id="su-name" name="name" label="Full name" autoComplete="name" placeholder="Ama Owusu"
              value={name} onChange={setName}
            />
            <TextField
              id="su-email" name="email" label="Email" type="email" inputMode="email" autoComplete="email"
              placeholder="you@email.com" value={email} valid={emailValid} onChange={setEmail}
            />
            <div className="field--tight">
              <PasswordField
                id="su-password" name="password" label="Password" value={password} autoComplete="new-password"
                onChange={setPassword} reveal={reveal} onToggleReveal={() => setReveal((r) => !r)}
              />
              <div className={'req' + (passOk ? ' req--ok' : '')}>
                <span className="req__tick"><IconCheck /></span>
                <span>At least 8 characters</span>
              </div>
            </div>

            <div className="optrow optrow--top">
              <label className="check check--terms" htmlFor="su-terms">
                <input id="su-terms" name="tc_agreed" type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                <span className="check__box"><IconCheck /></span>
                <span className="check__label check__label--terms">
                  I agree to Chariot&rsquo;s <Link href="/terms" target="_blank">Terms</Link> and <Link href="/privacy" target="_blank">Privacy Notice</Link>.
                </span>
              </label>
            </div>

            <SubmitButton canSubmit={canSubmit} />

            <div className="form__foot">
              <p className="form__newuser">Already a member? <Link href="/login">Sign in</Link></p>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  )
}
