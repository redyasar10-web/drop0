import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

/**
 * Handles Supabase auth redirects from BOTH link styles:
 *  - PKCE / magic-link: ?code=...           -> exchangeCodeForSession
 *  - Default email OTP:  ?token_hash=&type=  -> verifyOtp  (signup confirm, recovery, etc.)
 * The default Supabase "Confirm your email" / "Reset password" templates use the
 * token_hash + type form, so we must support it or signup/reset dead-ends.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/account'

  if (!code && !tokenHash) {
    return NextResponse.redirect(new URL('/login?error=missing_code', origin))
  }

  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { error } = tokenHash
    ? await supabase.auth.verifyOtp({ type: type ?? 'email', token_hash: tokenHash })
    : await supabase.auth.exchangeCodeForSession(code!)

  if (error) {
    return NextResponse.redirect(new URL('/login?error=auth_failed', origin))
  }

  return NextResponse.redirect(new URL(next, origin))
}
