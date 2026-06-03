'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { useState } from 'react'
import Link from 'next/link'
import { loginAction, type AuthState } from '@/app/actions/auth'
import { createClient } from '@/lib/supabase/client'
import { Logo, SocialButton, TextField, PasswordField, Checkbox, PrimaryButton, IconAlert } from '../AuthFields'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function SubmitButton({ canSubmit }: { canSubmit: boolean }) {
  const { pending } = useFormStatus()
  return <PrimaryButton loading={pending} disabled={!canSubmit}>Log in</PrimaryButton>
}

export default function LoginPage() {
  const [state, formAction] = useFormState<AuthState, FormData>(loginAction, null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [reveal, setReveal] = useState(false)
  const [remember, setRemember] = useState(true)
  const [oauthMsg, setOauthMsg] = useState<string | null>(null)

  const emailValid = email.trim() !== '' && EMAIL_RE.test(email.trim())
  const canSubmit = email.trim() !== '' && password !== ''

  async function oauth(provider: 'google' | 'apple') {
    setOauthMsg(null)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      })
      if (error) setOauthMsg(`${provider === 'google' ? 'Google' : 'Apple'} sign-in isn't set up yet — use your email below.`)
    } catch {
      setOauthMsg(`${provider === 'google' ? 'Google' : 'Apple'} sign-in isn't set up yet — use your email below.`)
    }
  }

  const bannerText = state?.error ?? oauthMsg

  return (
    <div className="authx" data-theme="v3" data-accent="default" data-corner="sharp">
      <div className="auth" data-imgside="left">
        {/* editorial visual */}
        <div className="auth__visual">
          <img className="auth__img" src="/auth/login-hero.jpg" alt="1NRI editorial, Accra" />
          <div className="auth__scrim" />
          <div className="auth__visual-top">
            <span className="auth__visual-tag">Drop 0 · Founding Fifty</span>
          </div>
          <div className="auth__visual-bottom">
            <p className="auth__quote">What the rest of the world is already wearing.</p>
            <div className="auth__credit">
              <span>1NRI</span><span>Time &amp; Chance SS25</span><span>Accra</span>
              <span>Made in Accra · Ships from Austin</span>
            </div>
          </div>
        </div>

        {/* form */}
        <div className="auth__formwrap">
          <form className="form" action={formAction} noValidate>
            <div className="form__brand"><Logo tone="dark" /></div>

            <p className="form__eyebrow">Members</p>
            <h1 className="form__title">Welcome back.</h1>
            <p className="form__lead">
              <em>You&rsquo;re already wearing it.</em> Sign in to pick up your founding spot and the pieces with your name on them.
            </p>

            {bannerText && (
              <div className="formbanner formbanner--error" role="status">
                <IconAlert /><span>{bannerText}</span>
              </div>
            )}

            <div className="social">
              <SocialButton provider="google" onClick={() => oauth('google')} />
              <SocialButton provider="apple" onClick={() => oauth('apple')} />
            </div>

            <div className="divider">or</div>

            <TextField
              id="email" name="email" label="Email" type="email" inputMode="email" autoComplete="email"
              placeholder="you@email.com" value={email} valid={emailValid} onChange={setEmail}
            />
            <PasswordField
              id="password" name="password" label="Password" value={password} autoComplete="current-password"
              onChange={setPassword} reveal={reveal} onToggleReveal={() => setReveal((r) => !r)}
              rightLink={<Link href="/forgot-password" className="field__link">Forgot password?</Link>}
            />

            <div className="optrow">
              <Checkbox id="remember" label="Remember me" checked={remember} onChange={setRemember} />
            </div>

            <SubmitButton canSubmit={canSubmit} />

            <div className="form__foot">
              <p className="form__newuser">New to Chariot? <Link href="/signup">Create an account</Link></p>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
