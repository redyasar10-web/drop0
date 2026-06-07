import 'server-only'
import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// ============================================================
// Admin role guard for /admin pages and /api/admin/* routes.
//
// Reads `users.is_admin` server-side via the service role so an attacker
// cannot tamper with their own row to elevate. The session user is still
// fetched via `supabase.auth.getUser()` so the check is bound to a real
// authenticated session, not a stale cookie or a guessed UUID.
//
// requireAdmin() returns the user on success; throws on failure so callers
// can wrap with a NextResponse.json error in route handlers or redirect
// in server components.
// ============================================================

export class AdminAuthError extends Error {
  constructor(message: string, public statusCode = 403) {
    super(message)
    this.name = 'AdminAuthError'
  }
}

export type AdminUser = {
  id: string
  email: string | null
}

export async function requireAdmin(): Promise<AdminUser> {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new AdminAuthError('Not signed in', 401)

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    console.error('[admin-guard] users lookup failed:', error.message)
    throw new AdminAuthError('Admin check failed', 500)
  }
  if (!data?.is_admin) throw new AdminAuthError('Not an admin', 403)

  return { id: user.id, email: user.email ?? null }
}

export async function isAdmin(): Promise<boolean> {
  try {
    await requireAdmin()
    return true
  } catch {
    return false
  }
}
