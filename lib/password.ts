import { createHash } from 'crypto'
import { CONFIG } from '@/lib/config'

// ============================================================
// Password policy (ACC-6 / NIST SP 800-63B / ASVS 2.1.1, 2.1.7)
//
//   * Minimum length only (>= 12). No forced composition rules.
//   * Reject passwords found in known-breach corpora via the
//     HaveIBeenPwned range API using k-anonymity (only the first
//     5 chars of the SHA-1 hash ever leave this server).
// ============================================================

export type PasswordCheck = { ok: true } | { ok: false; error: string }

const HIBP_RANGE_URL = 'https://api.pwnedpasswords.com/range/'

/**
 * Server-only. Validates length, then checks the breach corpus.
 * Network failures fail OPEN (length still enforced) so a HIBP
 * outage cannot lock out all signups — the breach check is a
 * protection layer, not the authentication itself.
 */
export async function validatePassword(password: string): Promise<PasswordCheck> {
  if (!password || password.length < CONFIG.MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `Password must be at least ${CONFIG.MIN_PASSWORD_LENGTH} characters.` }
  }

  const breached = await isBreachedPassword(password)
  if (breached) {
    return {
      ok: false,
      error:
        'This password has appeared in a known data breach. Please choose a different one.',
    }
  }

  return { ok: true }
}

/**
 * k-anonymity breach check. SHA-1 the password, send only the first
 * 5 hex chars of the hash to HIBP, and look for the remaining suffix
 * in the response. Returns false on any network/parse error (fail-open).
 */
export async function isBreachedPassword(password: string): Promise<boolean> {
  try {
    const sha1 = createHash('sha1').update(password).digest('hex').toUpperCase()
    const prefix = sha1.slice(0, 5)
    const suffix = sha1.slice(5)

    const res = await fetch(`${HIBP_RANGE_URL}${prefix}`, {
      headers: { 'Add-Padding': 'true' },
      // Don't let a slow third party hang the request indefinitely.
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) return false

    // HIBP's "Add-Padding" response is usually ~30 KB; legitimate replies
    // never exceed ~250 KB. If a compromised intermediary serves a much
    // larger body, refuse to read it into memory.
    const contentLength = parseInt(res.headers.get('content-length') ?? '0', 10)
    if (contentLength > 256 * 1024) return false

    const body = await res.text()
    for (const line of body.split('\n')) {
      const [hashSuffix, countStr] = line.trim().split(':')
      if (hashSuffix === suffix) {
        const count = parseInt(countStr ?? '0', 10)
        return count > 0
      }
    }
    return false
  } catch (err) {
    console.error('[password] HIBP breach check failed (failing open):', err)
    return false
  }
}
