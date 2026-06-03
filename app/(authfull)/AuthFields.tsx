'use client'

import { useState } from 'react'

/* ---------- Icons ---------- */
export function IconEye() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="2.6" />
    </svg>
  )
}
export function IconEyeOff() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 3l18 18" /><path d="M10.6 6.2A9.7 9.7 0 0 1 12 5c6.5 0 10 7 10 7a16.9 16.9 0 0 1-3.5 4.2" />
      <path d="M6.5 7.8C3.8 9.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 4.1-.9" /><path d="M9.9 9.9a2.6 2.6 0 0 0 3.7 3.7" />
    </svg>
  )
}
export function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 12.5l5 5L20 6.5" />
    </svg>
  )
}
export function IconCircleCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" /><path d="M8 12.2l2.6 2.6L16 9.4" />
    </svg>
  )
}
export function IconAlert() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3.2 1.8 20.5h20.4L12 3.2Z" /><path d="M12 9.6v4.6" /><path d="M12 17.3v.1" strokeWidth="2" />
    </svg>
  )
}
export function IconArrow() {
  return (
    <svg className="pbtn__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="17" height="17" aria-hidden="true">
      <path d="M4 12h15" /><path d="M13 6l6 6-6 6" />
    </svg>
  )
}
export function IconGoogle() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.5 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.22-4.74 3.22-8.09Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.24 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.46 1.46 14.97.5 12 .5A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 4.75 12 4.75Z" />
    </svg>
  )
}
export function IconApple() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.36 12.78c.02 2.55 2.23 3.4 2.26 3.41-.02.06-.35 1.22-1.17 2.41-.7 1.03-1.44 2.05-2.6 2.07-1.14.02-1.5-.68-2.8-.68-1.3 0-1.7.66-2.78.7-1.12.04-1.97-1.11-2.68-2.13-1.45-2.1-2.56-5.93-1.07-8.52a4.15 4.15 0 0 1 3.5-2.13c1.1-.02 2.13.74 2.8.74.67 0 1.93-.92 3.25-.78.55.02 2.1.22 3.1 1.68-.08.05-1.85 1.08-1.83 3.23M14.2 4.86c.59-.72 1-1.72.88-2.71-.85.03-1.88.57-2.5 1.28-.55.63-1.03 1.65-.9 2.62.95.07 1.92-.48 2.52-1.19" />
    </svg>
  )
}
export function Spinner() { return <span className="spinner" aria-hidden="true" /> }

export function Logo({ tone = 'dark' }: { tone?: 'dark' | 'white' }) {
  const src = tone === 'white' ? '/chariot-wordmark-white.png' : '/chariot-wordmark.png'
  return <img className="logo" src={src} alt="Chariot" />
}

/* ---------- Social button ---------- */
export function SocialButton({ provider, disabled, onClick }: {
  provider: 'google' | 'apple'; disabled?: boolean; onClick?: () => void
}) {
  const Icon = provider === 'google' ? IconGoogle : IconApple
  const label = provider === 'google' ? 'Continue with Google' : 'Continue with Apple'
  return (
    <button type="button" className="sbtn" disabled={disabled} onClick={onClick}>
      <Icon /><span>{label}</span>
    </button>
  )
}

/* ---------- Field message ---------- */
export function FieldMsg({ id, error }: { id: string; error?: string }) {
  if (error) {
    return (
      <div className="field__msg field__msg--error" id={id} role="alert">
        <IconAlert /><span>{error}</span>
      </div>
    )
  }
  return <div className="field__msg" id={id} aria-hidden="true" />
}

/* ---------- Text field ---------- */
export function TextField(props: {
  id: string; name: string; label: string; type?: string; value: string;
  onChange: (v: string) => void; onBlur?: (v: string) => void;
  placeholder?: string; error?: string; valid?: boolean; disabled?: boolean;
  autoComplete?: string; inputMode?: 'email' | 'text';
}) {
  const [focus, setFocus] = useState(false)
  const shell = 'input-shell' + (focus ? ' is-focus' : '') + (props.error ? ' is-error' : '') + (props.disabled ? ' is-disabled' : '')
  return (
    <div className="field">
      <div className="field__labelrow">
        <label className="field__label" htmlFor={props.id}>{props.label}</label>
      </div>
      <div className={shell}>
        <input
          id={props.id} name={props.name} type={props.type ?? 'text'} value={props.value}
          placeholder={props.placeholder} autoComplete={props.autoComplete} inputMode={props.inputMode}
          disabled={props.disabled} aria-invalid={!!props.error}
          onChange={(e) => props.onChange(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={(e) => { setFocus(false); props.onBlur?.(e.target.value) }}
        />
        {props.valid && !props.error && <span className="input-tick"><IconCircleCheck /></span>}
      </div>
      <FieldMsg id={props.id + '-msg'} error={props.error} />
    </div>
  )
}

/* ---------- Password field ---------- */
export function PasswordField(props: {
  id: string; name: string; label: string; value: string;
  onChange: (v: string) => void; onBlur?: (v: string) => void;
  error?: string; disabled?: boolean; autoComplete?: string;
  reveal: boolean; onToggleReveal: () => void; rightLink?: React.ReactNode;
}) {
  const [focus, setFocus] = useState(false)
  const shell = 'input-shell' + (focus ? ' is-focus' : '') + (props.error ? ' is-error' : '') + (props.disabled ? ' is-disabled' : '')
  return (
    <div className="field">
      <div className="field__labelrow">
        <label className="field__label" htmlFor={props.id}>{props.label}</label>
        {props.rightLink}
      </div>
      <div className={shell}>
        <input
          id={props.id} name={props.name} type={props.reveal ? 'text' : 'password'} value={props.value}
          autoComplete={props.autoComplete ?? 'current-password'} disabled={props.disabled}
          aria-invalid={!!props.error}
          onChange={(e) => props.onChange(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={(e) => { setFocus(false); props.onBlur?.(e.target.value) }}
        />
        <button
          type="button" className="input-icon-btn" tabIndex={props.disabled ? -1 : 0}
          aria-label={props.reveal ? 'Hide password' : 'Show password'} aria-pressed={props.reveal}
          onClick={props.onToggleReveal} disabled={props.disabled}
        >
          {props.reveal ? <IconEyeOff /> : <IconEye />}
        </button>
      </div>
      <FieldMsg id={props.id + '-msg'} error={props.error} />
    </div>
  )
}

/* ---------- Checkbox ---------- */
export function Checkbox({ id, name, label, checked, onChange }: {
  id: string; name?: string; label: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <label className="check" htmlFor={id}>
      <input id={id} name={name} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="check__box"><IconCheck /></span>
      <span className="check__label">{label}</span>
    </label>
  )
}

/* ---------- Primary button ---------- */
export function PrimaryButton({ children, loading, disabled, type = 'submit' }: {
  children: React.ReactNode; loading?: boolean; disabled?: boolean; type?: 'submit' | 'button'
}) {
  return (
    <button type={type} className="pbtn" data-loading={loading ? 'true' : 'false'} disabled={disabled || loading} aria-busy={loading}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
        {children}{!loading && <IconArrow />}
      </span>
      {loading && <span className="pbtn__spin"><Spinner /></span>}
    </button>
  )
}
