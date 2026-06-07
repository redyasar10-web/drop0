import 'server-only'
import { createHash } from 'crypto'

// ============================================================
// Peppered SHA-256 hashing for PII in audit / log surfaces.
//
// Use case: we still need to correlate "this email failed login 5 times" and
// "this IP fired 200 contact submissions" in audit_log + Vercel logs without
// storing the raw values long-term. Hashing with a server-side pepper makes
// rainbow-table reverse-lookup costly while keeping aggregation queries
// (GROUP BY email_hash) cheap.
//
// EMAIL_HASH_PEPPER must be set in production. In dev/test we fall back to a
// fixed string so the function is total — never throws — and tests don't have
// to seed an env var.
// ============================================================

const PEPPER =
  process.env.EMAIL_HASH_PEPPER ?? 'chariot-dev-pepper-do-not-use-in-prod'

export function hashEmail(email: string | null | undefined): string | null {
  if (!email) return null
  const normalised = email.trim().toLowerCase()
  if (!normalised) return null
  return 'sha256:' + createHash('sha256').update(PEPPER + normalised).digest('hex').slice(0, 32)
}

export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null
  const trimmed = ip.trim()
  if (!trimmed || trimmed === 'unknown') return trimmed || null
  return 'sha256:' + createHash('sha256').update(PEPPER + trimmed).digest('hex').slice(0, 16)
}
