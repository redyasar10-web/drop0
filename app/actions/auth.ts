'use server'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type AuthState = { error?: string; success?: boolean; email?: string } | null

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
  const cookieStore = cookies()
  const referredBy =
    ((formData.get('referred_by') as string) || '').trim().toUpperCase() ||
    cookieStore.get('chariot_ref')?.value ||
    null

  if (!tcAgreed) {
    return { error: 'You must agree to the Terms & Conditions to create an account.' }
  }

  if (!email || !password) {
    return { error: 'Email and password are required.' }
  }

  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters.' }
  }

  if (password !== confirmPassword) {
    return { error: 'Passwords do not match.' }
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

  // Insert user profile using service role to bypass RLS.
  // Retry on referral_code unique collisions; if it still fails, roll back the
  // auth user so we never strand an account with no profile row (which would
  // silently break /account and checkout fulfillment).
  const admin = createAdminClient()
  const tcAgreedAt = new Date().toISOString()

  let profileCreated = false
  for (let attempt = 0; attempt < 5; attempt++) {
    const { error: profileError } = await admin.from('users').insert({
      id: data.user.id,
      email,
      referral_code: generateReferralCode(),
      referred_by: referredBy,
      tc_agreed_at: tcAgreedAt,
    })
    if (!profileError) { profileCreated = true; break }
    // 23505 = unique_violation. A referral_code collision is retryable; a
    // duplicate id/email means the row already exists (treat as created).
    if (profileError.code === '23505' && /referral_code/.test(profileError.message)) continue
    if (profileError.code === '23505') { profileCreated = true; break }
    console.error('[signup] profile insert failed:', profileError.message)
    break
  }

  if (!profileCreated) {
    await admin.auth.admin.deleteUser(data.user.id).catch(() => {})
    return { error: 'We could not finish creating your account. Please try again.' }
  }

  // Referral captured — clear the cookie so it can't leak into a later signup.
  cookieStore.set('chariot_ref', '', { path: '/', maxAge: 0 })

  redirect(`/verify-email?email=${encodeURIComponent(email)}`)
}

export async function loginAction(prevState: AuthState, formData: FormData): Promise<AuthState> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Email and password are required.' }
  }

  const supabase = createServerClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    if (error.message.toLowerCase().includes('email not confirmed')) {
      return {
        error: 'Please verify your email before signing in.',
        email,
      }
    }
    return { error: 'Invalid email or password.' }
  }

  redirect('/account')
}

export async function forgotPasswordAction(prevState: AuthState, formData: FormData): Promise<AuthState> {
  const email = formData.get('email') as string

  if (!email) {
    return { error: 'Email is required.' }
  }

  const supabase = createServerClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/reset-password`,
  })

  if (error) {
    return { error: error.message }
  }

  return { success: true, email }
}

export async function resetPasswordAction(prevState: AuthState, formData: FormData): Promise<AuthState> {
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirm_password') as string

  if (!password) {
    return { error: 'Password is required.' }
  }

  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters.' }
  }

  if (password !== confirmPassword) {
    return { error: 'Passwords do not match.' }
  }

  const supabase = createServerClient()
  // Guard: updateUser only works with a valid recovery session (set by the
  // /auth/callback recovery link). Without it, surface a friendly message
  // instead of leaking Supabase's raw "Auth session missing!" error.
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Your reset link has expired or is invalid. Please request a new password reset.' }
  }

  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    return { error: 'Could not update your password. Please request a new reset link.' }
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

  const supabase = createServerClient()
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  })

  if (error) {
    return { error: error.message }
  }

  return { success: true, email }
}
