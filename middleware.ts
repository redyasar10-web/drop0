import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { SUPABASE_COOKIE_OPTIONS } from '@/lib/supabase/cookie-options'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: SUPABASE_COOKIE_OPTIONS,
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  // Refresh session — keeps cookies from expiring on active use
  let { data: { user } } = await supabase.auth.getUser()

  // Test-only mock auth (dev/test only, gated by MOCK_AUTH=1 env var).
  // Matches the same gate logic as lib/supabase/server.ts so middleware
  // and page-level auth checks agree about whether a mock session exists.
  if (!user && process.env.NODE_ENV !== 'production' && process.env.MOCK_AUTH === '1') {
    const mockEmail = request.cookies.get('chariot_mock_user')?.value
    if (mockEmail) {
      // Synthesise the minimal user shape the middleware needs to gate routes.
      user = {
        id: '00000000-0000-0000-0000-000000000001',
        aud: 'authenticated',
        email: mockEmail,
        app_metadata: {},
        user_metadata: {},
        created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
      } as unknown as typeof user
    }
  }

  const { pathname } = request.nextUrl

  // Protect /account/* and /checkout — redirect to /login if unauthenticated
  if ((pathname.startsWith('/account') || pathname.startsWith('/checkout')) && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Redirect authenticated users away from auth pages
  if (user && (pathname === '/login' || pathname === '/signup')) {
    return NextResponse.redirect(new URL('/account', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
