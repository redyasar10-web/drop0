'use server'

import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { validatePassword } from '@/lib/password'
import { checkAuthRateLimit } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit'

export type AuthState = { error?: string; success?: boolean; email?: string } | null

const RATE_LIMIT_MESSAGE = 'Too many attempts. Please wait a minute and try again.'

// Uppercase alphanumeric, no ambiguous chars (0/O, 1/I/L)
function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export async function signupAction(prevState: AuthState, formData: FormData): Promise<AuthState> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirm_password') as string
  const tcAgreed = formData.get('tc_agreed') === 'on'
  const referredByCode = ((formData.get('referred_by') as string) || '').trim().toUpperCase() || null

  if (!tcAgreed) {
    return { error: 'You must agree to the Terms & Conditions to create an account.' }
  }

  if (!email || !password) {
    return { error: 'Email and password are required.' }
  }

  // Validate input BEFORE consuming a rate-limit token, otherwise honest typos
  // burn the user's per-minute budget (ARCH-H1).
  if (password !== confirmPassword) {
    return { error: 'Passwords do not match.' }
  }

  // Length (>=12) + breached-password check; no composition rules (ACC-6)
  const pwCheck = await validatePassword(password)
  if (!pwCheck.ok) {
    return { error: pwCheck.error }
  }

  // Rate limit per IP and per account (ACC-7) — runs AFTER input validation.
  if (!(await checkAuthRateLimit('signup', email))) {
    return { error: RATE_LIMIT_MESSAGE }
  }

  const supabase = createServerClient()

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  })

  if (error) {
    return { error: error.message }
  }

  if (!data.user) {
    return { error: 'Failed to create account. Please try again.' }
  }

  // Insert user profile using service role to bypass RLS
  const admin = createAdminClient()
  const referralCode = generateReferralCode()
  const tcAgreedAt = new Date().toISOString()

  // Resolve the public referral code to the referrer's user id (uuid).
  // referred_by stores the id, never the code (PRD §4). Self-reference is
  // impossible here (the new account has no code yet).
  let referredById: string | null = null
  if (referredByCode) {
    const { data: referrer } = await admin
      .from('users')
      .select('id')
      .eq('referral_code', referredByCode)
      .maybeSingle()
    referredById = referrer?.id ?? null
  }

  const { error: profileError } = await admin.from('users').insert({
    id: data.user.id,
    email,
    referral_code: referralCode,
    referred_by: referredById,
    tc_agreed_at: tcAgreedAt,
  })

  if (profileError) {
    // Auth user created but profile failed: an orphan auth user can log in
    // but every downstream query that joins public.users (account page,
    // fulfill_order's FOR UPDATE on users) breaks until the row exists.
    // Delete the auth user so the customer can retry signup cleanly, rather
    // than ending up wedged in a partial state.
    console.error('[signup] profile insert failed, rolling back auth user:', profileError.message)
    try {
      await admin.auth.admin.deleteUser(data.user.id)
    } catch (cleanupErr) {
      // If cleanup itself fails, the user lands in the broken state we were
      // trying to avoid — log loudly so ops can intervene manually.
      console.error('[signup] orphan auth user cleanup failed:', cleanupErr)
    }
    return { error: 'Could not finish account creation. Please try again.' }
  }

  redirect(`/verify-email?email=${encodeURIComponent(email)}`)
}

export async function loginAction(prevState: AuthState, formData: FormData): Promise<AuthState> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Email and password are required.' }
  }

  // Rate limit per IP and per account to resist brute force / credential stuffing (ACC-7)
  if (!(await checkAuthRateLimit('login', email))) {
    return { error: RATE_LIMIT_MESSAGE }
  }

  const supabase = createServerClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    // Audit failed sign-in for brute-force / credential-stuffing monitoring (NF-6).
    await logAudit({ event: 'auth.login_failure', level: 'warn', detail: { email } })
    if (error.message.toLowerCase().includes('email not confirmed')) {
      return {
        error: 'Please verify your email before signing in.',
        email,
      }
    }
    return { error: 'Invalid email or password.' }
  }

  await logAudit({ event: 'auth.login_success', level: 'info', detail: { email } })
  redirect('/account')
}

export async function forgotPasswordAction(prevState: AuthState, formData: FormData): Promise<AuthState> {
  const email = formData.get('email') as string

  if (!email) {
    return { error: 'Email is required.' }
  }

  // Rate limit reset requests per IP and per account (ACC-7)
  if (!(await checkAuthRateLimit('reset', email))) {
    return { error: RATE_LIMIT_MESSAGE }
  }

  const supabase = createServerClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/reset-password`,
  })

  // Always respond identically whether or not the email exists — Supabase's
  // raw error message previously revealed registered vs. unregistered status
  // (ASVS 2.5.6). Log server-side instead.
  if (error) {
    console.error('[forgotPassword] error:', error.message)
  }

  return { success: true, email }
}

export async function resetPasswordAction(prevState: AuthState, formData: FormData): Promise<AuthState> {
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirm_password') as string

  if (!password) {
    return { error: 'Password is required.' }
  }

  if (password !== confirmPassword) {
    return { error: 'Passwords do not match.' }
  }

  // Length (>=12) + breached-password check; no composition rules (ACC-6)
  const pwCheck = await validatePassword(password)
  if (!pwCheck.ok) {
    return { error: pwCheck.error }
  }

  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  // updateUser({ password }) succeeds for ANY logged-in user, not only those
  // who arrived via the password-recovery link. Without this guard, any user
  // already holding a normal session could POST here and change their own
  // password without the additional verification expected of a reset.
  // recovery_sent_at is set by Supabase when a recovery email is issued and
  // cleared once the recovery session is used; if it's nullish, this isn't
  // a recovery session and we refuse.
  if (!user || !user.recovery_sent_at) {
    return { error: 'Invalid or expired password reset link.' }
  }

  // Rate-limit by user id so a leaked recovery session can't be used to spray
  // password updates.
  if (!(await checkAuthRateLimit('reset_complete', user.id))) {
    return { error: RATE_LIMIT_MESSAGE }
  }

  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    return { error: error.message }
  }

  redirect('/account')
}

export async function signoutAction() {
  const supabase = createServerClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function resendVerificationAction(prevState: AuthState, formData: FormData): Promise<AuthState> {
  const email = formData.get('email') as string

  if (!email) {
    return { error: 'Email is required.' }
  }

  // Without this gate any client could call this in a tight loop for any
  // email and rack up unbounded Resend cost + Supabase auth spam.
  if (!(await checkAuthRateLimit('resend', email))) {
    return { error: RATE_LIMIT_MESSAGE }
  }

  const supabase = createServerClient()
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  })

  if (error) {
    // Don't leak whether the email is registered. Log server-side for ops
    // visibility, return a generic success-style response either way.
    console.error('[resendVerification] error:', error.message)
  }

  return { success: true, email }
}
