import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { CONFIG } from '@/lib/config'

// ============================================================
// Auth rate limiting (ACC-7). Calls the DB-backed limiter
// (006_m1_rate_limit.sql) via the service role so limits hold
// across serverless instances.
// ============================================================

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function getClientIp(): string {
  const h = headers()
  const fwd = h.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return h.get('x-real-ip') ?? 'unknown'
}

/**
 * Returns true if the attempt is ALLOWED, false if it should be REJECTED.
 * Fails OPEN on limiter infrastructure errors: the limiter is a protection
 * layer, and a DB hiccup should not deny all legitimate auth attempts.
 */
async function allow(key: string, max: number, windowSeconds: number): Promise<boolean> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc('check_rate_limit', {
      p_key: key,
      p_max: max,
      p_window_seconds: windowSeconds,
    })
    if (error) {
      console.error('[rate-limit] check_rate_limit error (failing open):', error.message)
      return true
    }
    return data === true
  } catch (err) {
    console.error('[rate-limit] check_rate_limit threw (failing open):', err)
    return true
  }
}

/**
 * Enforce the per-IP AND per-account limit for an auth action.
 * `action` namespaces the buckets (e.g. 'login', 'signup', 'reset').
 * Returns true if the attempt may proceed.
 */
export async function checkAuthRateLimit(action: string, email?: string | null): Promise<boolean> {
  const max = CONFIG.AUTH_RATE_LIMIT_PER_IP_PER_MIN
  const windowSeconds = 60

  const ip = getClientIp()
  const ipOk = await allow(`${action}:ip:${ip}`, max, windowSeconds)

  let emailOk = true
  if (email) {
    emailOk = await allow(`${action}:email:${email.trim().toLowerCase()}`, max, windowSeconds)
  }

  return ipOk && emailOk
}
