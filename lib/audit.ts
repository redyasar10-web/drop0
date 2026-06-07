import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { hashEmail, hashIp } from '@/lib/hash'

// ============================================================
// Structured audit logging (NF-6 / OWASP A09 / ASVS 7.1).
//
// Writes a queryable row to audit_log AND emits a structured console line
// (captured by Vercel log drains for alerting). NEVER pass sensitive data
// (passwords, card data, tokens) in `detail`. Audit failures are swallowed —
// logging must never break the operation it observes.
//
// PII discipline: callers pass raw `email` / `ip` and this layer hashes them
// before persistence so audit_log + Vercel log drains never carry the raw
// address. Correlation across calls still works (same input → same hash).
// ============================================================

export type AuditLevel = 'info' | 'warn' | 'alert'

const PII_FIELDS = new Set(['email', 'submitter_email', 'recipient_email', 'to'])
const IP_FIELDS  = new Set(['ip', 'client_ip', 'x_forwarded_for'])

function scrub(detail: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(detail)) {
    if (typeof v === 'string') {
      if (PII_FIELDS.has(k)) { out[k + '_hash'] = hashEmail(v); continue }
      if (IP_FIELDS.has(k))  { out[k + '_hash'] = hashIp(v);    continue }
    }
    out[k] = v
  }
  return out
}

export async function logAudit(params: {
  event: string
  level?: AuditLevel
  userId?: string | null
  detail?: Record<string, unknown>
}): Promise<void> {
  const { event, level = 'info', userId = null, detail = {} } = params
  const scrubbed = scrub(detail)

  // Structured console line (alerting can key off level=alert).
  const line = JSON.stringify({ audit: true, event, level, userId, detail: scrubbed, ts: new Date().toISOString() })
  if (level === 'alert' || level === 'warn') console.warn(line)
  else console.log(line)

  try {
    const admin = createAdminClient()
    await admin.from('audit_log').insert({ event, level, user_id: userId, detail: scrubbed })
  } catch (err) {
    console.error('[audit] failed to persist audit_log row:', err)
  }
}
