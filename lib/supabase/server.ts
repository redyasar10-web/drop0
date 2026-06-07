import 'server-only'
import { createServerClient as createSSRClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { SUPABASE_COOKIE_OPTIONS } from '@/lib/supabase/cookie-options'

// ============================================================
// Test-only auth bypass. ONLY active when:
//   * NODE_ENV !== 'production'
//   * MOCK_AUTH env var === '1'
//   * the request carries the `chariot_mock_user` cookie
//
// All three must hold. The cookie value is the email to mock. Used by
// the e2e test harness so we can walk authenticated UI flows without
// running a real Supabase instance. Hard-coded to refuse in production
// so a misconfigured env var can never bypass real auth on the live
// site.
// ============================================================
const MOCK_ENABLED =
  process.env.NODE_ENV !== 'production' && process.env.MOCK_AUTH === '1'

type MockUser = {
  id: string
  email: string
  created_at: string
  recovery_sent_at: string | null
}

function getMockUserFromCookie(): MockUser | null {
  if (!MOCK_ENABLED) return null
  const email = cookies().get('chariot_mock_user')?.value
  if (!email) return null
  return {
    id: '00000000-0000-0000-0000-000000000001',
    email,
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    recovery_sent_at: null,
  }
}

export function createServerClient() {
  const cookieStore = cookies()

  const client = createSSRClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: SUPABASE_COOKIE_OPTIONS,
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch {
            // Called from a Server Component — middleware will refresh the session
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch {
            // Called from a Server Component — middleware will refresh the session
          }
        },
      },
    }
  )

  // Wrap auth.getUser() to return a synthetic user in test mode. All other
  // methods pass through unchanged so the DB queries still hit the real
  // Supabase (or the dummy URL, which returns the existing graceful fallbacks).
  if (MOCK_ENABLED) {
    const mockUser = getMockUserFromCookie()
    if (mockUser) {
      const originalGetUser = client.auth.getUser.bind(client.auth)
      ;(client.auth as unknown as { getUser: unknown }).getUser = async () => ({
        data: { user: mockUser },
        error: null,
      })
      // Preserve a reference for tests that need it
      void originalGetUser
    }
  }

  return client
}
